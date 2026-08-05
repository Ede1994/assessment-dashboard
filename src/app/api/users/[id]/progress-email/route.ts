import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAssignedQuestionIds } from "@/lib/assignments";
import { computeProgressScore } from "@/lib/grading";
import { getSmtpConfig, isValidEmail, sendMail } from "@/lib/mail";
import { QuestionType } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

function buildProgressText(opts: {
  studentName: string;
  username: string;
  answered: number;
  total: number;
  freeTextAnswered: number;
  mcAnswered: number;
  mcCorrect: number;
  mcScorePct: number | null;
  lines: string[];
}): string {
  const mcLine =
    opts.mcAnswered === 0
      ? "MC score: — (no MC answers yet)"
      : `MC score: ${opts.mcCorrect}/${opts.mcAnswered} (${opts.mcScorePct}%)`;

  return [
    `Student progress — ${opts.studentName} (@${opts.username})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    `Completion: ${opts.answered}/${opts.total} assigned tasks answered`,
    `Free-text answers: ${opts.freeTextAnswered}`,
    mcLine,
    "",
    "Recent submissions:",
    ...(opts.lines.length ? opts.lines : ["  (none yet)"]),
    "",
    "— Student Assessment Platform",
  ].join("\n");
}

/** Trainer: email a progress digest for one student to a recipient address. */
export async function POST(request: Request, { params }: Params) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getSmtpConfig()) {
    return NextResponse.json(
      {
        error:
          "SMTP is not configured. Set SMTP_HOST and SMTP_FROM in the environment.",
      },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const to = String(body?.to ?? "").trim();
  if (!isValidEmail(to)) {
    return NextResponse.json(
      { error: "A valid recipient email (to) is required." },
      { status: 400 },
    );
  }

  const student = await prisma.user.findFirst({
    where: { id, role: "STUDENT" },
    select: { id: true, username: true, displayName: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const [assignedIds, submissions, bankTotal] = await Promise.all([
    getAssignedQuestionIds(student.id),
    prisma.submission.findMany({
      where: { userId: student.id },
      include: {
        question: {
          select: {
            title: true,
            type: true,
            category: { select: { name: true } },
          },
        },
        selectedChoice: { select: { label: true, isCorrect: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.question.count(),
  ]);

  const total = assignedIds === null ? bankTotal : assignedIds.length;
  const score = computeProgressScore(total, submissions);

  const lines = submissions.map((s) => {
    const when = s.updatedAt.toISOString().slice(0, 16).replace("T", " ");
    if (s.question.type === QuestionType.MULTIPLE_CHOICE) {
      const mark = s.selectedChoice?.isCorrect ? "correct" : "incorrect";
      return `  • [${s.question.category.name}] ${s.question.title} — MC ${mark} (${when})`;
    }
    const preview = (s.textAnswer ?? "").replace(/\s+/g, " ").slice(0, 80);
    return `  • [${s.question.category.name}] ${s.question.title} — free text: ${preview || "—"}${
      (s.textAnswer ?? "").length > 80 ? "…" : ""
    } (${when})`;
  });

  const text = buildProgressText({
    studentName: student.displayName,
    username: student.username,
    answered: score.answered,
    total: score.total,
    freeTextAnswered: score.freeTextAnswered,
    mcAnswered: score.mcAnswered,
    mcCorrect: score.mcCorrect,
    mcScorePct: score.mcScorePct,
    lines,
  });

  const sent = await sendMail({
    to,
    subject: `Progress: ${student.displayName} (@${student.username})`,
    text,
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    to,
    studentId: student.id,
    preview: text,
  });
}
