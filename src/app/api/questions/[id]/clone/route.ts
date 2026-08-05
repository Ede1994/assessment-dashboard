import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

/** Trainer: duplicate a question (with solution + choices). No assignments/submissions. */
export async function POST(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const source = await prisma.question.findUnique({
    where: { id },
    include: {
      choices: { orderBy: { sortOrder: "asc" } },
      solution: true,
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const maxSort = await prisma.question.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;
  const title = source.title.startsWith("Copy of ")
    ? source.title
    : `Copy of ${source.title}`;

  const question = await prisma.question.create({
    data: {
      categoryId: source.categoryId,
      title,
      prompt: source.prompt,
      roundLabel: source.roundLabel,
      tags: source.tags,
      type: source.type,
      codeSnippet: source.codeSnippet,
      sortOrder,
      solution: source.solution
        ? {
            create: {
              idealAnswer: source.solution.idealAnswer,
              explanation: source.solution.explanation,
              codeSolution: source.solution.codeSolution,
            },
          }
        : undefined,
      choices:
        source.type === QuestionType.MULTIPLE_CHOICE
          ? {
              create: source.choices.map((ch) => ({
                label: ch.label,
                isCorrect: ch.isCorrect,
                sortOrder: ch.sortOrder,
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

  return NextResponse.json({ ok: true, question }, { status: 201 });
}
