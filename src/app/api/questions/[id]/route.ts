import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { studentCanAccessQuestion } from "@/lib/assignments";
import { parseQuestionBody } from "@/lib/questionInput";
import { QuestionType } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (user.role === "STUDENT") {
    const allowed = await studentCanAccessQuestion(user.id, id);
    if (!allowed) {
      return NextResponse.json(
        { error: "This question is not assigned to you." },
        { status: 403 },
      );
    }
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      category: true,
      choices: { orderBy: { sortOrder: "asc" } },
      solution: true,
      submissions: {
        where: { userId: user.id },
        take: 1,
        include: { selectedChoice: { select: { isCorrect: true } } },
      },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const raw = question.submissions[0] ?? null;
  const isTrainer = user.role === "TRAINER";
  const mcCorrect =
    question.type === QuestionType.MULTIPLE_CHOICE && raw?.selectedChoice
      ? Boolean(raw.selectedChoice.isCorrect)
      : null;
  const released = Boolean(raw?.feedbackReleased);
  const submission = raw
    ? {
        id: raw.id,
        textAnswer: raw.textAnswer,
        selectedChoiceId: raw.selectedChoiceId,
        submittedAt: raw.submittedAt,
        updatedAt: raw.updatedAt,
        aiFeedback: isTrainer ? raw.aiFeedback : undefined,
        aiReviewedAt: isTrainer ? raw.aiReviewedAt : undefined,
        ...(isTrainer || released
          ? {
              trainerScore: raw.trainerScore,
              trainerPassed: raw.trainerPassed,
              trainerComment: raw.trainerComment,
              feedbackReleased: raw.feedbackReleased,
              trainerGradedAt: raw.trainerGradedAt,
            }
          : {}),
      }
    : null;

  return NextResponse.json({
    id: question.id,
    title: question.title,
    prompt: question.prompt,
    roundLabel: question.roundLabel,
    tags: question.tags,
    type: question.type,
    codeSnippet: question.codeSnippet,
    sortOrder: question.sortOrder,
    categoryId: question.categoryId,
    category: question.category,
    choices: question.choices.map((c) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sortOrder,
      ...(isTrainer ? { isCorrect: c.isCorrect } : {}),
    })),
    solution: isTrainer ? question.solution : undefined,
    mcCorrect,
    submission,
  });
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  // Clear choice FKs on submissions before replacing choices
  await prisma.submission.updateMany({
    where: { questionId: id },
    data: { selectedChoiceId: null },
  });
  await prisma.choice.deleteMany({ where: { questionId: id } });

  const question = await prisma.question.update({
    where: { id },
    data: {
      categoryId: data.categoryId,
      title: data.title,
      prompt: data.prompt,
      roundLabel: data.roundLabel,
      tags: data.tags,
      type: data.type,
      codeSnippet: data.codeSnippet,
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      solution: {
        upsert: {
          create: {
            idealAnswer: data.idealAnswer,
            explanation: data.explanation,
            codeSolution: data.codeSolution,
          },
          update: {
            idealAnswer: data.idealAnswer,
            explanation: data.explanation,
            codeSolution: data.codeSolution,
          },
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

  return NextResponse.json({ ok: true, question });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clear choice FKs first (SQLite / Prisma safety)
  await prisma.submission.updateMany({
    where: { questionId: id },
    data: { selectedChoiceId: null },
  });
  await prisma.question.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
