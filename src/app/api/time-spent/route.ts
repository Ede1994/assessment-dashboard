import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { studentCanAccessQuestion } from "@/lib/assignments";
import { parseTimeDelta } from "@/lib/time";

/**
 * Student: increment time spent on a question (heartbeat / pagehide).
 * Does not create a submission, so viewing time is not treated as an answer.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionId = String(body?.questionId ?? "").trim();
  const deltaMs = parseTimeDelta(body?.deltaMs);

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required." }, { status: 400 });
  }
  if (deltaMs == null) {
    return NextResponse.json(
      { error: "deltaMs must be between 1000 and 120000." },
      { status: 400 },
    );
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
    select: { id: true },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const row = await prisma.timeSpent.upsert({
    where: { userId_questionId: { userId: user.id, questionId } },
    create: { userId: user.id, questionId, timeSpentMs: deltaMs },
    update: { timeSpentMs: { increment: deltaMs } },
  });

  return NextResponse.json({
    ok: true,
    questionId,
    timeSpentMs: row.timeSpentMs,
  });
}
