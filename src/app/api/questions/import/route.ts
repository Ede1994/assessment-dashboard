import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { QuestionType, CodingLanguage } from "@/generated/prisma/client";
import {
  countBlanks,
  isCodingLanguage,
  serializeBlankAnswers,
} from "@/lib/coding";

type ImportQuestion = {
  categorySlug?: string;
  title?: string;
  prompt?: string;
  roundLabel?: string;
  tags?: string;
  type?: string;
  codeSnippet?: string | null;
  starterCode?: string | null;
  codingLanguage?: string | null;
  sortOrder?: number;
  choices?: Array<{ label?: string; isCorrect?: boolean; sortOrder?: number }>;
  solution?: {
    idealAnswer?: string;
    explanation?: string;
    codeSolution?: string | null;
    blankAnswers?: string[] | string | null;
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
    const typeRaw = String(row.type ?? "").toUpperCase();
    const type =
      typeRaw === "MULTIPLE_CHOICE"
        ? QuestionType.MULTIPLE_CHOICE
        : typeRaw === "CODING"
          ? QuestionType.CODING
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

    let starterCode: string | null = null;
    let codingLanguage: CodingLanguage | null = null;
    let blankAnswers: string | null = null;
    if (type === QuestionType.CODING) {
      starterCode = String(row.starterCode ?? "");
      const blankCount = countBlanks(starterCode);
      const langRaw = String(row.codingLanguage ?? "PYTHON").toUpperCase();
      const rawBlanks = Array.isArray(row.solution?.blankAnswers)
        ? row.solution.blankAnswers.map((item) => String(item ?? "").trim())
        : typeof row.solution?.blankAnswers === "string"
          ? String(row.solution.blankAnswers)
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : [];
      if (!starterCode.trim() || blankCount < 1 || !isCodingLanguage(langRaw)) {
        errors.push(`#${i + 1}: coding questions need starterCode with ____ blanks`);
        continue;
      }
      if (rawBlanks.length !== blankCount || rawBlanks.some((item) => !item)) {
        errors.push(`#${i + 1}: coding questions need ${blankCount} blank answers`);
        continue;
      }
      codingLanguage = langRaw as CodingLanguage;
      blankAnswers = serializeBlankAnswers(rawBlanks);
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
          starterCode,
          codingLanguage,
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
              blankAnswers,
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
