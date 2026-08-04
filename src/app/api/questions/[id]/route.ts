import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { studentCanAccessQuestion } from "@/lib/assignments";

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
      },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submission = question.submissions[0] ?? null;
  const isTrainer = user.role === "TRAINER";

  return NextResponse.json({
    id: question.id,
    title: question.title,
    prompt: question.prompt,
    roundLabel: question.roundLabel,
    tags: question.tags,
    type: question.type,
    codeSnippet: question.codeSnippet,
    sortOrder: question.sortOrder,
    category: question.category,
    choices: question.choices.map((c) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sortOrder,
      ...(isTrainer ? { isCorrect: c.isCorrect } : {}),
    })),
    solution: isTrainer ? question.solution : undefined,
    submission,
  });
}
