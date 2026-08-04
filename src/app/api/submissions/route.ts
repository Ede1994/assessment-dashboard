import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";
import { studentCanAccessQuestion } from "@/lib/assignments";

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
    const valid = question.choices.some((c) => c.id === selectedChoiceId);
    if (!valid) {
      return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
    }
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
    },
    update: {
      textAnswer:
        question.type === QuestionType.FREE_TEXT ? textAnswer!.trim() : null,
      selectedChoiceId:
        question.type === QuestionType.MULTIPLE_CHOICE ? selectedChoiceId : null,
    },
  });

  return NextResponse.json({ ok: true, submission });
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
    return NextResponse.json({ submissions });
  }

  // Trainer: all student submissions with solutions
  const submissions = await prisma.submission.findMany({
    include: {
      user: {
        select: { id: true, username: true, displayName: true, role: true },
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
  });

  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      username: true,
      displayName: true,
      _count: { select: { submissions: true, assignments: true } },
    },
    orderBy: { username: "asc" },
  });

  const totalQuestions = await prisma.question.count();

  return NextResponse.json({
    submissions,
    students: students.map((s) => ({
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      answered: s._count.submissions,
      total: s._count.assignments > 0 ? s._count.assignments : totalQuestions,
      assigned: s._count.assignments,
    })),
  });
}
