import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAssignedQuestionIds } from "@/lib/assignments";
import { blankAnswersJson, parseQuestionBody } from "@/lib/questionInput";
import { countBlanks } from "@/lib/coding";
import { QuestionType } from "@/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignedIds =
    user.role === "STUDENT" ? await getAssignedQuestionIds(user.id) : null;

  const [categories, questions, dueRow, timeRows] = await Promise.all([
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
            codingPassed: true,
            selectedChoice: { select: { isCorrect: true } },
          },
        },
      },
    }),
    user.role === "STUDENT"
      ? prisma.questionAssignment.findFirst({
          where: { userId: user.id, dueAt: { not: null } },
          select: { dueAt: true },
          orderBy: { dueAt: "asc" },
        })
      : Promise.resolve(null),
    user.role === "STUDENT"
      ? prisma.timeSpent.findMany({
          where: { userId: user.id },
          select: { questionId: true, timeSpentMs: true },
        })
      : Promise.resolve([]),
  ]);

  const timeByQuestion = new Map(
    timeRows.map((t) => [t.questionId, t.timeSpentMs]),
  );

  const payload = questions.map((q) => {
    const raw = q.submissions[0] ?? null;
    const mcCorrect =
      q.type === QuestionType.MULTIPLE_CHOICE && raw?.selectedChoice
        ? Boolean(raw.selectedChoice.isCorrect)
        : null;
    const codingCorrect =
      q.type === QuestionType.CODING && raw
        ? Boolean(raw.codingPassed)
        : null;
    const submission = raw
      ? {
          id: raw.id,
          textAnswer: raw.textAnswer,
          selectedChoiceId: raw.selectedChoiceId,
          submittedAt: raw.submittedAt,
          updatedAt: raw.updatedAt,
          codingPassed: raw.codingPassed,
        }
      : null;
    const timeSpentMs = timeByQuestion.get(q.id) ?? 0;
    return {
      id: q.id,
      title: q.title,
      prompt: q.prompt,
      roundLabel: q.roundLabel,
      tags: q.tags,
      type: q.type,
      codeSnippet: q.codeSnippet,
      starterCode: q.type === QuestionType.CODING ? q.starterCode : null,
      codingLanguage: q.codingLanguage,
      blankCount:
        q.type === QuestionType.CODING ? countBlanks(q.starterCode ?? "") : 0,
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
      mcCorrect,
      codingCorrect,
      timeSpentMs,
      submission,
    };
  });

  const mcAnswered = payload.filter(
    (q) => q.type === QuestionType.MULTIPLE_CHOICE && q.answered,
  ).length;
  const mcCorrectCount = payload.filter((q) => q.mcCorrect === true).length;
  const freeTextAnswered = payload.filter(
    (q) => q.type === QuestionType.FREE_TEXT && q.answered,
  ).length;
  const codingAnswered = payload.filter(
    (q) => q.type === QuestionType.CODING && q.answered,
  ).length;
  const codingCorrectCount = payload.filter((q) => q.codingCorrect === true)
    .length;
  const timeSpentMs = payload.reduce((sum, q) => sum + q.timeSpentMs, 0);

  return NextResponse.json({
    categories: categories.filter((c) =>
      payload.some((q) => q.category.id === c.id),
    ),
    questions: payload,
    assignmentMode: assignedIds !== null,
    dueAt: dueRow?.dueAt ?? null,
    progress: {
      answered: payload.filter((q) => q.answered).length,
      total: payload.length,
      freeTextAnswered,
      mcAnswered,
      mcCorrect: mcCorrectCount,
      mcScorePct:
        mcAnswered === 0
          ? null
          : Math.round((mcCorrectCount / mcAnswered) * 100),
      codingAnswered,
      codingCorrect: codingCorrectCount,
      codingScorePct:
        codingAnswered === 0
          ? null
          : Math.round((codingCorrectCount / codingAnswered) * 100),
      timeSpentMs,
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
      starterCode: data.starterCode ?? null,
      codingLanguage: data.codingLanguage ?? null,
      sortOrder,
      solution: {
        create: {
          idealAnswer: data.idealAnswer,
          explanation: data.explanation,
          codeSolution: data.codeSolution,
          blankAnswers: blankAnswersJson(data.blankAnswers),
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
