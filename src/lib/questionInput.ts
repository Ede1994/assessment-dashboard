import { QuestionType } from "@/generated/prisma/client";

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
  sortOrder?: number;
  idealAnswer: string;
  explanation: string;
  codeSolution?: string | null;
  choices?: QuestionChoiceInput[];
};

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
  const typeRaw = String(b.type ?? "FREE_TEXT").toUpperCase();
  const type =
    typeRaw === "MULTIPLE_CHOICE"
      ? QuestionType.MULTIPLE_CHOICE
      : QuestionType.FREE_TEXT;
  const codeSnippet =
    b.codeSnippet === undefined || b.codeSnippet === null || b.codeSnippet === ""
      ? null
      : String(b.codeSnippet);
  const idealAnswer = String(b.idealAnswer ?? "").trim();
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
  if (!idealAnswer) return { ok: false, error: "idealAnswer is required." };
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
      sortOrder,
      idealAnswer,
      explanation,
      codeSolution,
      choices,
    },
  };
}
