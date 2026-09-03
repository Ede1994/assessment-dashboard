/** Placeholder students must replace in coding-exercise scaffolds. */
export const BLANK_TOKEN = "____";

export const CODING_LANGUAGE_NAMES = [
  "PYTHON",
  "JAVASCRIPT",
  "MATLAB",
] as const;

export type CodingLanguageName = (typeof CODING_LANGUAGE_NAMES)[number];

export type CodingLanguageMeta = {
  label: string;
  fileName: string;
  workerUrl: string;
  workerType?: "classic" | "module";
  timeoutMs: number;
  loadingHint?: string;
  defaultStarter: string;
  defaultBlankAnswers: string[];
};

export const CODING_LANGUAGES: Record<CodingLanguageName, CodingLanguageMeta> = {
  PYTHON: {
    label: "Python",
    fileName: "script.py",
    workerUrl: "/workers/py-runner.js",
    timeoutMs: 20_000,
    loadingHint:
      "Loading Python runtime (first run may take a few seconds)…",
    defaultStarter: `values = [1, 2, 3]\ntotal = ____(values)\nprint(total)\n`,
    defaultBlankAnswers: ["sum"],
  },
  JAVASCRIPT: {
    label: "JavaScript",
    fileName: "script.js",
    workerUrl: "/workers/js-runner.js",
    timeoutMs: 5_000,
    defaultStarter: `const values = [1, 2, 3];\nconst total = ____(values);\nconsole.log(total);\n`,
    defaultBlankAnswers: ["sum"],
  },
  MATLAB: {
    label: "MATLAB",
    fileName: "script.m",
    workerUrl: "/workers/matlab-runner.js?v=2",
    workerType: "module",
    timeoutMs: 60_000,
    loadingHint:
      "Loading MATLAB runtime (first run may take a few seconds)…",
    defaultStarter: `values = [1, 2, 3];\ntotal = ____(values);\ndisp(total);\n`,
    defaultBlankAnswers: ["sum"],
  },
};

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
  return (CODING_LANGUAGE_NAMES as readonly string[]).includes(value);
}

export function codingLanguagesList(): string {
  const names = [...CODING_LANGUAGE_NAMES];
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

export function codingMeta(
  language: string | null | undefined,
): CodingLanguageMeta {
  if (language && isCodingLanguage(language)) {
    return CODING_LANGUAGES[language];
  }
  return CODING_LANGUAGES.PYTHON;
}

export function codingFileName(language: string | null | undefined): string {
  return codingMeta(language).fileName;
}

export function codingLanguageLabel(
  language: string | null | undefined,
): string {
  return codingMeta(language).label;
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
