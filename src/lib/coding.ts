/** Placeholder students must replace in coding-exercise scaffolds. */
export const BLANK_TOKEN = "____";

export type CodingLanguageName = "PYTHON" | "JAVASCRIPT";

export type CodingAnswerPayload = {
  v: 1;
  blanks: string[];
  code: string;
};

export type ScaffoldLine = {
  textSegs: string[];
  blankIndices: number[];
};

export type BlankGrade = {
  isCorrect: boolean;
  blankResults: boolean[];
  correctCount: number;
  total: number;
};

export function isCodingLanguage(
  value: string,
): value is CodingLanguageName {
  return value === "PYTHON" || value === "JAVASCRIPT";
}

export function codingFileName(language: string | null | undefined): string {
  return language === "JAVASCRIPT" ? "script.js" : "script.py";
}

export function countBlanks(starter: string): number {
  let count = 0;
  let from = 0;
  while (from < starter.length) {
    const idx = starter.indexOf(BLANK_TOKEN, from);
    if (idx === -1) break;
    count += 1;
    from = idx + BLANK_TOKEN.length;
  }
  return count;
}

export function scaffoldLines(starter: string): ScaffoldLine[] {
  const lines = starter.split("\n");
  let blankIndex = 0;
  return lines.map((line) => {
    const textSegs = line.split(BLANK_TOKEN);
    const blankIndices: number[] = [];
    for (let i = 0; i < textSegs.length - 1; i += 1) {
      blankIndices.push(blankIndex);
      blankIndex += 1;
    }
    return { textSegs, blankIndices };
  });
}

export function fillBlanks(starter: string, blanks: string[]): string {
  let result = "";
  let from = 0;
  let blankIndex = 0;
  while (from < starter.length) {
    const idx = starter.indexOf(BLANK_TOKEN, from);
    if (idx === -1) {
      result += starter.slice(from);
      break;
    }
    result += starter.slice(from, idx);
    const filled = blanks[blankIndex] ?? BLANK_TOKEN;
    result += filled;
    blankIndex += 1;
    from = idx + BLANK_TOKEN.length;
  }
  return result;
}

export function normalizeBlank(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Trainer answers may list alternatives separated by `|`. */
export function answersMatch(expected: string, actual: string): boolean {
  const actualNorm = normalizeBlank(actual);
  if (!actualNorm) return false;
  const alternatives = expected
    .split("|")
    .map(normalizeBlank)
    .filter(Boolean);
  if (alternatives.some((alt) => alt === actualNorm)) return true;
  const compact = (value: string) => value.replace(/\s+/g, "");
  const actualCompact = compact(actualNorm);
  return alternatives.some((alt) => compact(alt) === actualCompact);
}

export function gradeBlanks(
  expected: string[],
  actual: string[],
): BlankGrade {
  const blankResults = expected.map((exp, i) =>
    answersMatch(exp, actual[i] ?? ""),
  );
  const correctCount = blankResults.filter(Boolean).length;
  return {
    isCorrect: blankResults.length > 0 && blankResults.every(Boolean),
    blankResults,
    correctCount,
    total: expected.length,
  };
}

export function parseBlankAnswers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item ?? ""));
  } catch {
    return [];
  }
}

export function serializeBlankAnswers(answers: string[]): string {
  return JSON.stringify(answers.map((item) => String(item ?? "")));
}

export function encodeCodingAnswer(
  blanks: string[],
  code: string,
): string {
  const payload: CodingAnswerPayload = { v: 1, blanks, code };
  return JSON.stringify(payload);
}

export function parseCodingAnswer(
  text: string | null | undefined,
): CodingAnswerPayload | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<CodingAnswerPayload>;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.blanks)) {
      return {
        v: 1,
        blanks: parsed.blanks.map((item) => String(item ?? "")),
        code: String(parsed.code ?? ""),
      };
    }
  } catch {
    // Stored as raw source from an older client — treat as filled code only.
  }
  return { v: 1, blanks: [], code: text };
}

export function displayCodingAnswer(text: string | null | undefined): string {
  const parsed = parseCodingAnswer(text);
  if (!parsed) return "";
  return parsed.code || parsed.blanks.filter(Boolean).join("\n");
}
