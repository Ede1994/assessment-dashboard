import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType } from "@/generated/prisma/client";

type ImportQuestion = {
  categorySlug?: string;
  title?: string;
  prompt?: string;
  roundLabel?: string;
  tags?: string;
  type?: string;
  codeSnippet?: string | null;
  sortOrder?: number;
  choices?: Array<{ label?: string; isCorrect?: boolean; sortOrder?: number }>;
  solution?: {
    idealAnswer?: string;
    explanation?: string;
    codeSolution?: string | null;
  } | null;
};

/** Trainer: import questions from JSON export (creates new rows; matches category by slug). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.questions)
    ? (body.questions as ImportQuestion[])
    : Array.isArray(body)
      ? (body as ImportQuestion[])
      : null;

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: "Provide { questions: [...] } from a bank export." },
      { status: 400 },
    );
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "Import is limited to 500 questions at a time." },
      { status: 400 },
    );
  }

  const categories = await prisma.category.findMany();
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const maxSort = await prisma.question.aggregate({ _max: { sortOrder: true } });
  let nextSort = (maxSort._max.sortOrder ?? 0) + 1;

  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const slug = String(row.categorySlug ?? "").trim();
    const category = bySlug.get(slug);
    if (!category) {
      errors.push(`#${i + 1}: unknown categorySlug “${slug || "(empty)"}”`);
      continue;
    }
    const title = String(row.title ?? "").trim();
    const prompt = String(row.prompt ?? "").trim();
    const idealAnswer = String(row.solution?.idealAnswer ?? "").trim();
    const explanation = String(row.solution?.explanation ?? "").trim();
    if (!title || !prompt || !idealAnswer || !explanation) {
      errors.push(`#${i + 1}: missing title/prompt/solution fields`);
      continue;
    }
    const type =
      String(row.type ?? "").toUpperCase() === "MULTIPLE_CHOICE"
        ? QuestionType.MULTIPLE_CHOICE
        : QuestionType.FREE_TEXT;

    const choices =
      type === QuestionType.MULTIPLE_CHOICE
        ? (row.choices ?? [])
            .map((c, idx) => ({
              label: String(c.label ?? "").trim(),
              isCorrect: Boolean(c.isCorrect),
              sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : idx,
            }))
            .filter((c) => c.label)
        : [];

    if (type === QuestionType.MULTIPLE_CHOICE) {
      if (choices.length < 2 || !choices.some((c) => c.isCorrect)) {
        errors.push(`#${i + 1}: MC needs ≥2 choices with a correct answer`);
        continue;
      }
    }

    try {
      await prisma.question.create({
        data: {
          categoryId: category.id,
          title,
          prompt,
          roundLabel: String(row.roundLabel ?? "Imported").trim() || "Imported",
          tags: String(row.tags ?? "Imported").trim() || "Imported",
          type,
          codeSnippet: row.codeSnippet ? String(row.codeSnippet) : null,
          sortOrder:
            typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
              ? row.sortOrder
              : nextSort++,
          solution: {
            create: {
              idealAnswer,
              explanation,
              codeSolution: row.solution?.codeSolution
                ? String(row.solution.codeSolution)
                : null,
            },
          },
          choices:
            type === QuestionType.MULTIPLE_CHOICE
              ? { create: choices }
              : undefined,
        },
      });
      created += 1;
    } catch {
      errors.push(`#${i + 1}: database create failed for “${title}”`);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped: rows.length - created,
    errors: errors.slice(0, 20),
  });
}
