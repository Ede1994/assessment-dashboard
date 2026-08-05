import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

/** Trainer: score / pass-fail / comment a free-text submission; optionally release to student. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: { question: { select: { type: true } } },
  });
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (submission.question.type !== QuestionType.FREE_TEXT) {
    return NextResponse.json(
      { error: "Only free-text submissions can be manually graded." },
      { status: 400 },
    );
  }

  let trainerScore: number | null | undefined = undefined;
  if ("trainerScore" in (body ?? {})) {
    if (body.trainerScore === null || body.trainerScore === "") {
      trainerScore = null;
    } else {
      const n = Number(body.trainerScore);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json(
          { error: "Score must be a number from 0 to 100." },
          { status: 400 },
        );
      }
      trainerScore = Math.round(n);
    }
  }

  let trainerPassed: boolean | null | undefined = undefined;
  if ("trainerPassed" in (body ?? {})) {
    if (body.trainerPassed === null || body.trainerPassed === "") {
      trainerPassed = null;
    } else if (typeof body.trainerPassed === "boolean") {
      trainerPassed = body.trainerPassed;
    } else if (body.trainerPassed === "true" || body.trainerPassed === true) {
      trainerPassed = true;
    } else if (body.trainerPassed === "false" || body.trainerPassed === false) {
      trainerPassed = false;
    } else {
      return NextResponse.json(
        { error: "Pass/fail must be true, false, or null." },
        { status: 400 },
      );
    }
  }

  let trainerComment: string | null | undefined = undefined;
  if ("trainerComment" in (body ?? {})) {
    if (body.trainerComment === null) {
      trainerComment = null;
    } else {
      trainerComment = String(body.trainerComment).trim().slice(0, 4000) || null;
    }
  }

  let feedbackReleased: boolean | undefined = undefined;
  if ("feedbackReleased" in (body ?? {})) {
    feedbackReleased = Boolean(body.feedbackReleased);
  }

  const hasGradeField =
    trainerScore !== undefined ||
    trainerPassed !== undefined ||
    trainerComment !== undefined;

  const updated = await prisma.submission.update({
    where: { id },
    data: {
      ...(trainerScore !== undefined ? { trainerScore } : {}),
      ...(trainerPassed !== undefined ? { trainerPassed } : {}),
      ...(trainerComment !== undefined ? { trainerComment } : {}),
      ...(feedbackReleased !== undefined ? { feedbackReleased } : {}),
      ...(hasGradeField ? { trainerGradedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    submission: {
      id: updated.id,
      trainerScore: updated.trainerScore,
      trainerPassed: updated.trainerPassed,
      trainerComment: updated.trainerComment,
      feedbackReleased: updated.feedbackReleased,
      trainerGradedAt: updated.trainerGradedAt,
    },
  });
}
