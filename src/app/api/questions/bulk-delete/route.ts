import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Trainer: delete many questions at once. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? [...new Set((body.ids as unknown[]).map(String).filter(Boolean))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids[] is required." }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json(
      { error: "Bulk delete is limited to 100 questions." },
      { status: 400 },
    );
  }

  await prisma.submission.updateMany({
    where: { questionId: { in: ids } },
    data: { selectedChoiceId: null },
  });
  const result = await prisma.question.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
