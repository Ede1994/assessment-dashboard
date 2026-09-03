import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { parseBlankAnswers } from "@/lib/coding";

function stampFilename(ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `question-bank-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
}

/** Trainer: export full question bank as JSON (default) or CSV (`?format=csv`). */
export async function GET(request: NextRequest) {
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

  const format = (request.nextUrl.searchParams.get("format") ?? "json").toLowerCase();

  if (format === "csv") {
    const rows: Array<Array<string | number | boolean | null | undefined>> = [
      [
        "categorySlug",
        "categoryName",
        "title",
        "roundLabel",
        "tags",
        "type",
        "prompt",
        "codeSnippet",
        "starterCode",
        "codingLanguage",
        "blankAnswers",
        "choiceLabels",
        "correctChoices",
        "idealAnswer",
        "explanation",
        "codeSolution",
        "sortOrder",
      ],
    ];
    for (const q of questions) {
      rows.push([
        q.category.slug,
        q.category.name,
        q.title,
        q.roundLabel,
        q.tags,
        q.type,
        q.prompt,
        q.codeSnippet,
        q.starterCode,
        q.codingLanguage,
        parseBlankAnswers(q.solution?.blankAnswers).join(" | "),
        q.choices.map((c) => c.label).join(" | "),
        q.choices
          .filter((c) => c.isCorrect)
          .map((c) => c.label)
          .join(" | "),
        q.solution?.idealAnswer ?? "",
        q.solution?.explanation ?? "",
        q.solution?.codeSolution ?? "",
        q.sortOrder,
      ]);
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stampFilename("csv")}"`,
      },
    });
  }

  if (format !== "json") {
    return NextResponse.json(
      { error: "format must be json or csv." },
      { status: 400 },
    );
  }

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
      starterCode: q.starterCode,
      codingLanguage: q.codingLanguage,
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
            blankAnswers: parseBlankAnswers(q.solution.blankAnswers),
          }
        : null,
    })),
  });
}
