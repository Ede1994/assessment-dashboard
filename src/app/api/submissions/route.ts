import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";
import { studentCanAccessQuestion, studentHasExamMode } from "@/lib/assignments";
import { getAssignedQuestionIds } from "@/lib/assignments";
import { computeProgressScore } from "@/lib/grading";
import {
  fillBlanks,
  gradeBlanks,
  parseBlankAnswers,
  parseCodingAnswer,
} from "@/lib/coding";

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
    include: { choices: true, solution: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  let isCorrect: boolean | null = null;
  let codingPassed: boolean | null = null;
  let codingGrade: ReturnType<typeof gradeBlanks> | null = null;
  let storedText: string | null = null;
  let storedChoice: string | null = null;

  if (question.type === QuestionType.FREE_TEXT) {
    if (!textAnswer || !textAnswer.trim()) {
      return NextResponse.json(
        { error: "Please provide a text answer." },
        { status: 400 },
      );
    }
    storedText = textAnswer.trim();
  } else if (question.type === QuestionType.CODING) {
    const parsed = parseCodingAnswer(textAnswer);
    const expected = parseBlankAnswers(question.solution?.blankAnswers);
    const actual = parsed?.blanks ?? [];
    if (expected.length === 0) {
      return NextResponse.json(
        { error: "This coding exercise is missing an answer key." },
        { status: 500 },
      );
    }
    if (actual.length !== expected.length) {
      return NextResponse.json(
        { error: `Fill all ${expected.length} blanks before submitting.` },
        { status: 400 },
      );
    }
    if (actual.some((blank) => !blank.trim())) {
      return NextResponse.json(
        { error: "Fill every blank before submitting." },
        { status: 400 },
      );
    }
    codingGrade = gradeBlanks(expected, actual);
    codingPassed = codingGrade.isCorrect;
    isCorrect = codingGrade.isCorrect;
    const filled =
      parsed?.code?.trim() || fillBlanks(question.starterCode ?? "", actual);
    storedText = JSON.stringify({
      v: 1,
      blanks: actual,
      code: filled,
    });
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
    storedChoice = selectedChoiceId;
  }

  const examLockable =
    question.type === QuestionType.MULTIPLE_CHOICE ||
    question.type === QuestionType.CODING;
  if (examLockable) {
    const examMode = await studentHasExamMode(user.id, questionId);
    if (examMode) {
      const existing = await prisma.submission.findUnique({
        where: { userId_questionId: { userId: user.id, questionId } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            error:
              "Exam mode is on — this answer cannot be changed after the first submit.",
          },
          { status: 403 },
        );
      }
    }
  }

  const submission = await prisma.submission.upsert({
    where: {
      userId_questionId: { userId: user.id, questionId },
    },
    create: {
      userId: user.id,
      questionId,
      textAnswer: storedText,
      selectedChoiceId: storedChoice,
      codingPassed,
      aiFeedback: null,
      aiReviewedAt: null,
      trainerScore: null,
      trainerPassed: null,
      trainerComment: null,
      feedbackReleased: false,
      trainerGradedAt: null,
    },
    update: {
      textAnswer: storedText,
      selectedChoiceId: storedChoice,
      codingPassed,
      aiFeedback: null,
      aiReviewedAt: null,
      trainerScore: null,
      trainerPassed: null,
      trainerComment: null,
      feedbackReleased: false,
      trainerGradedAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    submission,
    examMode: examLockable
      ? await studentHasExamMode(user.id, questionId)
      : false,
    grading:
      question.type === QuestionType.MULTIPLE_CHOICE
        ? { isCorrect: Boolean(isCorrect) }
        : question.type === QuestionType.CODING && codingGrade
          ? {
              isCorrect: codingGrade.isCorrect,
              correctCount: codingGrade.correctCount,
              total: codingGrade.total,
              blankResults: codingGrade.blankResults,
            }
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
        codingCorrect:
          s.question.type === QuestionType.CODING
            ? Boolean(s.codingPassed)
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
  const [submissions, students, totalQuestions, mcQuestionCount, timeRows] =
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
      prisma.timeSpent.findMany({
        select: { userId: true, questionId: true, timeSpentMs: true },
      }),
    ]);

  const timeByUserQuestion = new Map(
    timeRows.map((t) => [`${t.userId}:${t.questionId}`, t.timeSpentMs]),
  );
  const timeByUser = new Map<string, number>();
  for (const t of timeRows) {
    timeByUser.set(t.userId, (timeByUser.get(t.userId) ?? 0) + t.timeSpentMs);
  }

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
      timeSpentMs: timeByUser.get(s.id) ?? 0,
    };
  });

  return NextResponse.json({
    submissions: submissions.map((row) => ({
      ...row,
      timeSpentMs:
        timeByUserQuestion.get(`${row.userId}:${row.questionId}`) ?? 0,
    })),
    students: scoreboard,
    scoreboard,
    bank: {
      totalQuestions,
      mcQuestionCount,
    },
  });
}
