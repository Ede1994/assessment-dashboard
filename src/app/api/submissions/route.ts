import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";
import { studentCanAccessQuestion } from "@/lib/assignments";
import { getAssignedQuestionIds } from "@/lib/assignments";
import { computeProgressScore } from "@/lib/grading";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionId = String(body?.questionId ?? "");
  const textAnswer =
    body?.textAnswer === undefined || body?.textAnswer === null
      ? null
      : String(body.textAnswer);
  const selectedChoiceId =
    body?.selectedChoiceId === undefined || body?.selectedChoiceId === null
      ? null
      : String(body.selectedChoiceId);

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const allowed = await studentCanAccessQuestion(user.id, questionId);
  if (!allowed) {
    return NextResponse.json(
      { error: "This question is not assigned to you." },
      { status: 403 },
    );
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { choices: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let isCorrect: boolean | null = null;

  if (question.type === QuestionType.FREE_TEXT) {
    if (!textAnswer || !textAnswer.trim()) {
      return NextResponse.json(
        { error: "Please provide a text answer." },
        { status: 400 },
      );
    }
  } else {
    if (!selectedChoiceId) {
      return NextResponse.json(
        { error: "Please select an answer." },
        { status: 400 },
      );
    }
    const choice = question.choices.find((c) => c.id === selectedChoiceId);
    if (!choice) {
      return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
    }
    isCorrect = choice.isCorrect;
  }

  const submission = await prisma.submission.upsert({
    where: {
      userId_questionId: { userId: user.id, questionId },
    },
    create: {
      userId: user.id,
      questionId,
      textAnswer:
        question.type === QuestionType.FREE_TEXT ? textAnswer!.trim() : null,
      selectedChoiceId:
        question.type === QuestionType.MULTIPLE_CHOICE ? selectedChoiceId : null,
      // Clear any prior AI note when the student revises.
      aiFeedback: null,
      aiReviewedAt: null,
    },
    update: {
      textAnswer:
        question.type === QuestionType.FREE_TEXT ? textAnswer!.trim() : null,
      selectedChoiceId:
        question.type === QuestionType.MULTIPLE_CHOICE ? selectedChoiceId : null,
      aiFeedback: null,
      aiReviewedAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    submission,
    // Auto-grade MC only; never reveal which other choices were correct.
    grading:
      question.type === QuestionType.MULTIPLE_CHOICE
        ? { isCorrect: Boolean(isCorrect) }
        : null,
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === "STUDENT") {
    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      include: {
        question: { include: { category: true } },
        selectedChoice: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const assignedIds = await getAssignedQuestionIds(user.id);
    const total =
      assignedIds === null
        ? await prisma.question.count()
        : assignedIds.length;
    const score = computeProgressScore(total, submissions);

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        ...s,
        // Student-safe: only expose own MC correctness, not answer key.
        mcCorrect:
          s.question.type === QuestionType.MULTIPLE_CHOICE
            ? Boolean(s.selectedChoice?.isCorrect)
            : null,
        selectedChoice: s.selectedChoice
          ? {
              id: s.selectedChoice.id,
              label: s.selectedChoice.label,
            }
          : null,
      })),
      score,
    });
  }

  // Trainer: all student submissions with solutions + scoreboard
  const [submissions, students, totalQuestions, mcQuestionCount] =
    await Promise.all([
      prisma.submission.findMany({
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              role: true,
            },
          },
          question: {
            include: {
              category: true,
              solution: true,
              choices: { orderBy: { sortOrder: "asc" } },
            },
          },
          selectedChoice: true,
        },
        orderBy: [{ userId: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.user.findMany({
        where: { role: "STUDENT" },
        select: {
          id: true,
          username: true,
          displayName: true,
          assignments: { select: { questionId: true } },
          submissions: {
            include: {
              question: { select: { type: true } },
              selectedChoice: { select: { isCorrect: true } },
            },
          },
        },
        orderBy: { username: "asc" },
      }),
      prisma.question.count(),
      prisma.question.count({ where: { type: QuestionType.MULTIPLE_CHOICE } }),
    ]);

  const scoreboard = students.map((s) => {
    const total =
      s.assignments.length > 0 ? s.assignments.length : totalQuestions;
    const score = computeProgressScore(total, s.submissions);
    return {
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      answered: score.answered,
      total: score.total,
      freeTextAnswered: score.freeTextAnswered,
      mcAnswered: score.mcAnswered,
      mcCorrect: score.mcCorrect,
      mcScorePct: score.mcScorePct,
      assigned: s.assignments.length,
    };
  });

  return NextResponse.json({
    submissions,
    students: scoreboard,
    scoreboard,
    bank: {
      totalQuestions,
      mcQuestionCount,
    },
  });
}
