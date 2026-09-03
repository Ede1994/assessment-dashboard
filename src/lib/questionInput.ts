import { QuestionType, CodingLanguage } from "@/generated/prisma/client";
import {
  countBlanks,
  isCodingLanguage,
  serializeBlankAnswers,
} from "@/lib/coding";

export type QuestionChoiceInput = {
  label: string;
  isCorrect?: boolean;
};

export type QuestionWriteInput = {
  categoryId: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: QuestionType;
  codeSnippet?: string | null;
  starterCode?: string | null;
  codingLanguage?: CodingLanguage | null;
  sortOrder?: number;
  idealAnswer: string;
  explanation: string;
  codeSolution?: string | null;
  blankAnswers?: string[];
  choices?: QuestionChoiceInput[];
};

function parseType(raw: string): QuestionType {
  const typeRaw = raw.toUpperCase();
  if (typeRaw === "MULTIPLE_CHOICE") return QuestionType.MULTIPLE_CHOICE;
  if (typeRaw === "CODING") return QuestionType.CODING;
  return QuestionType.FREE_TEXT;
}

export function parseQuestionBody(body: unknown):
  | { ok: true; data: QuestionWriteInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;
  const categoryId = String(b.categoryId ?? "").trim();
  const title = String(b.title ?? "").trim();
  const prompt = String(b.prompt ?? "").trim();
  const roundLabel = String(b.roundLabel ?? "").trim() || "Custom";
  const tags = String(b.tags ?? "").trim() || "General";
  const type = parseType(String(b.type ?? "FREE_TEXT"));
  const codeSnippet =
    b.codeSnippet === undefined || b.codeSnippet === null || b.codeSnippet === ""
      ? null
      : String(b.codeSnippet);
  let idealAnswer = String(b.idealAnswer ?? "").trim();
  const explanation = String(b.explanation ?? "").trim();
  const codeSolution =
    b.codeSolution === undefined ||
    b.codeSolution === null ||
    b.codeSolution === ""
      ? null
      : String(b.codeSolution);
  const sortOrder =
    b.sortOrder === undefined || b.sortOrder === null || b.sortOrder === ""
      ? undefined
      : Number(b.sortOrder);

  if (!categoryId) return { ok: false, error: "categoryId is required." };
  if (!title) return { ok: false, error: "title is required." };
  if (!prompt) return { ok: false, error: "prompt is required." };
  if (!explanation) return { ok: false, error: "explanation is required." };
  if (sortOrder !== undefined && Number.isNaN(sortOrder)) {
    return { ok: false, error: "sortOrder must be a number." };
  }

  let choices: QuestionChoiceInput[] | undefined;
  if (type === QuestionType.MULTIPLE_CHOICE) {
    if (!Array.isArray(b.choices) || b.choices.length < 2) {
      return {
        ok: false,
        error: "Multiple-choice questions need at least 2 choices.",
      };
    }
    choices = b.choices.map((c) => {
      const row = c as Record<string, unknown>;
      return {
        label: String(row.label ?? "").trim(),
        isCorrect: Boolean(row.isCorrect),
      };
    });
    if (choices.some((c) => !c.label)) {
      return { ok: false, error: "Each choice needs a label." };
    }
    if (!choices.some((c) => c.isCorrect)) {
      return { ok: false, error: "Mark at least one choice as correct." };
    }
  }

  let starterCode: string | null = null;
  let codingLanguage: CodingLanguage | null = null;
  let blankAnswers: string[] | undefined;
  if (type === QuestionType.CODING) {
    starterCode = String(b.starterCode ?? "").replace(/\r\n/g, "\n");
    if (!starterCode.trim()) {
      return { ok: false, error: "starterCode is required for coding exercises." };
    }
    const blankCount = countBlanks(starterCode);
    if (blankCount < 1) {
      return {
        ok: false,
        error: "Starter code must include at least one ____ blank.",
      };
    }
    const langRaw = String(b.codingLanguage ?? "PYTHON").toUpperCase();
    if (!isCodingLanguage(langRaw)) {
      return {
        ok: false,
        error: "codingLanguage must be PYTHON or JAVASCRIPT.",
      };
    }
    codingLanguage = langRaw as CodingLanguage;
    const rawBlanks = Array.isArray(b.blankAnswers)
      ? b.blankAnswers.map((item) => String(item ?? "").trim())
      : typeof b.blankAnswers === "string"
        ? String(b.blankAnswers)
            .split("\n")
            .map((line) => line.trim())
            .filter((line, i, arr) => line.length > 0 || i < arr.length)
        : [];
    if (rawBlanks.length !== blankCount) {
      return {
        ok: false,
        error: `Provide exactly ${blankCount} blank answer${blankCount === 1 ? "" : "s"} (one per ____).`,
      };
    }
    if (rawBlanks.some((item) => !item)) {
      return { ok: false, error: "Each blank needs an expected answer." };
    }
    blankAnswers = rawBlanks;
    if (!idealAnswer) {
      idealAnswer = `Expected blanks: ${blankAnswers.join(", ")}`;
    }
  }

  if (!idealAnswer) return { ok: false, error: "idealAnswer is required." };

  return {
    ok: true,
    data: {
      categoryId,
      title,
      prompt,
      roundLabel,
      tags,
      type,
      codeSnippet,
      starterCode,
      codingLanguage,
      sortOrder,
      idealAnswer,
      explanation,
      codeSolution,
      blankAnswers,
      choices,
    },
  };
}

export function blankAnswersJson(answers: string[] | undefined): string | null {
  if (!answers || answers.length === 0) return null;
  return serializeBlankAnswers(answers);
}
