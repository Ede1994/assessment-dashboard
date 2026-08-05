import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Trainer: export full question bank as JSON (categories by slug). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      category: { select: { slug: true, name: true } },
      choices: { orderBy: { sortOrder: "asc" } },
      solution: true,
    },
  });

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: questions.map((q) => ({
      categorySlug: q.category.slug,
      title: q.title,
      prompt: q.prompt,
      roundLabel: q.roundLabel,
      tags: q.tags,
      type: q.type,
      codeSnippet: q.codeSnippet,
      sortOrder: q.sortOrder,
      choices: q.choices.map((c) => ({
        label: c.label,
        isCorrect: c.isCorrect,
        sortOrder: c.sortOrder,
      })),
      solution: q.solution
        ? {
            idealAnswer: q.solution.idealAnswer,
            explanation: q.solution.explanation,
            codeSolution: q.solution.codeSolution,
          }
        : null,
    })),
  });
}
