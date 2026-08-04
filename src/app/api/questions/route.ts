import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAssignedQuestionIds } from "@/lib/assignments";
import { parseQuestionBody } from "@/lib/questionInput";
import { QuestionType } from "@/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignedIds =
    user.role === "STUDENT" ? await getAssignedQuestionIds(user.id) : null;

  const [categories, questions] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.question.findMany({
      where:
        assignedIds === null
          ? undefined
          : { id: { in: assignedIds } },
      orderBy: { sortOrder: "asc" },
      include: {
        category: true,
        choices: { orderBy: { sortOrder: "asc" } },
        submissions: {
          where: { userId: user.id },
          select: {
            id: true,
            textAnswer: true,
            selectedChoiceId: true,
            submittedAt: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  const payload = questions.map((q) => {
    const submission = q.submissions[0] ?? null;
    return {
      id: q.id,
      title: q.title,
      prompt: q.prompt,
      roundLabel: q.roundLabel,
      tags: q.tags,
      type: q.type,
      codeSnippet: q.codeSnippet,
      sortOrder: q.sortOrder,
      category: {
        id: q.category.id,
        slug: q.category.slug,
        name: q.category.name,
        icon: q.category.icon,
        color: q.category.color,
      },
      choices: q.choices.map((c) => ({
        id: c.id,
        label: c.label,
        sortOrder: c.sortOrder,
        ...(user.role === "TRAINER" ? { isCorrect: c.isCorrect } : {}),
      })),
      answered: Boolean(submission),
      submission,
    };
  });

  return NextResponse.json({
    categories: categories.filter((c) =>
      payload.some((q) => q.category.id === c.id),
    ),
    questions: payload,
    assignmentMode: assignedIds !== null,
    progress: {
      answered: payload.filter((q) => q.answered).length,
      total: payload.length,
    },
  });
}

/** Trainer: create a question with solution (and choices if MC). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseQuestionBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const data = parsed.data;

  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const maxSort = await prisma.question.aggregate({ _max: { sortOrder: true } });
  const sortOrder = data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1;

  const question = await prisma.question.create({
    data: {
      categoryId: data.categoryId,
      title: data.title,
      prompt: data.prompt,
      roundLabel: data.roundLabel,
      tags: data.tags,
      type: data.type,
      codeSnippet: data.codeSnippet,
      sortOrder,
      solution: {
        create: {
          idealAnswer: data.idealAnswer,
          explanation: data.explanation,
          codeSolution: data.codeSolution,
        },
      },
      choices:
        data.type === QuestionType.MULTIPLE_CHOICE && data.choices
          ? {
              create: data.choices.map((ch, i) => ({
                label: ch.label,
                isCorrect: Boolean(ch.isCorrect),
                sortOrder: i,
              })),
            }
          : undefined,
    },
    include: {
      category: true,
      choices: { orderBy: { sortOrder: "asc" } },
      solution: true,
    },
  });

  return NextResponse.json({ ok: true, question }, { status: 201 });
}
