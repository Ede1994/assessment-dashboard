import type { QuestionType } from "@/generated/prisma/client";

export type McScore = {
  mcAnswered: number;
  mcCorrect: number;
  /** 0–100 when at least one MC is answered; otherwise null. */
  mcScorePct: number | null;
};

export type CodingScore = {
  codingAnswered: number;
  codingCorrect: number;
  codingScorePct: number | null;
};

export type ProgressScore = McScore &
  CodingScore & {
    answered: number;
    total: number;
    freeTextAnswered: number;
  };

type GradableSubmission = {
  selectedChoiceId: string | null;
  codingPassed?: boolean | null;
  question: {
    type: QuestionType | string;
  };
  selectedChoice?: { isCorrect: boolean } | null;
};

function isMultipleChoice(type: string): boolean {
  return type === "MULTIPLE_CHOICE";
}

function isCoding(type: string): boolean {
  return type === "CODING";
}

/** Aggregate auto-grade + completion counts for a student's submissions. */
export function computeProgressScore(
  totalQuestions: number,
  submissions: GradableSubmission[],
): ProgressScore {
  let mcAnswered = 0;
  let mcCorrect = 0;
  let freeTextAnswered = 0;
  let codingAnswered = 0;
  let codingCorrect = 0;

  for (const s of submissions) {
    if (isMultipleChoice(s.question.type)) {
      if (!s.selectedChoiceId) continue;
      mcAnswered += 1;
      if (s.selectedChoice?.isCorrect) mcCorrect += 1;
    } else if (isCoding(s.question.type)) {
      codingAnswered += 1;
      if (s.codingPassed) codingCorrect += 1;
    } else {
      freeTextAnswered += 1;
    }
  }

  return {
    answered: submissions.length,
    total: totalQuestions,
    freeTextAnswered,
    mcAnswered,
    mcCorrect,
    mcScorePct:
      mcAnswered === 0 ? null : Math.round((mcCorrect / mcAnswered) * 100),
    codingAnswered,
    codingCorrect,
    codingScorePct:
      codingAnswered === 0
        ? null
        : Math.round((codingCorrect / codingAnswered) * 100),
  };
}
