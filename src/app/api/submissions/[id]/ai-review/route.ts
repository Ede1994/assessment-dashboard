import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";
import { getAiConfig, requestAiFreeTextReview } from "@/lib/ai";

type Ctx = { params: Promise<{ id: string }> };

/** Trainer-only: ask Open WebUI / Ollama for a free-text review suggestion. */
export async function POST(_request: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getAiConfig()) {
    return NextResponse.json(
      {
        error:
          "AI assist is not configured. Set AI_BASE_URL and AI_API_KEY in the environment.",
      },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      question: { include: { solution: true } },
      user: { select: { username: true, displayName: true } },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.question.type !== QuestionType.FREE_TEXT) {
    return NextResponse.json(
      { error: "AI assist is only available for free-text answers." },
      { status: 400 },
    );
  }

  if (!submission.textAnswer?.trim()) {
    return NextResponse.json(
      { error: "Student has not provided a free-text answer yet." },
      { status: 400 },
    );
  }

  if (!submission.question.solution) {
    return NextResponse.json(
      { error: "No ideal solution is stored for this question." },
      { status: 400 },
    );
  }

  try {
    const result = await requestAiFreeTextReview({
      questionTitle: submission.question.title,
      questionPrompt: submission.question.prompt,
      idealAnswer: submission.question.solution.idealAnswer,
      explanation: submission.question.solution.explanation,
      studentAnswer: submission.textAnswer,
    });

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        aiFeedback: result.feedback,
        aiReviewedAt: new Date(),
      },
      select: {
        id: true,
        aiFeedback: true,
        aiReviewedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      model: result.model,
      submission: updated,
      student: submission.user,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI review failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
