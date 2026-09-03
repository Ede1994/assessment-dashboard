export type CategoryDto = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  sortOrder?: number;
};

export type ChoiceDto = {
  id: string;
  label: string;
  sortOrder: number;
  isCorrect?: boolean;
};

export type SubmissionDto = {
  id: string;
  textAnswer: string | null;
  selectedChoiceId: string | null;
  submittedAt: string;
  updatedAt: string;
  trainerScore?: number | null;
  trainerPassed?: boolean | null;
  trainerComment?: string | null;
  feedbackReleased?: boolean;
  trainerGradedAt?: string | null;
  codingPassed?: boolean | null;
};

export type QuestionListItem = {
  id: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: "FREE_TEXT" | "MULTIPLE_CHOICE" | "CODING";
  codeSnippet: string | null;
  starterCode?: string | null;
  codingLanguage?: "PYTHON" | "JAVASCRIPT" | null;
  blankCount?: number;
  sortOrder: number;
  category: CategoryDto;
  choices: ChoiceDto[];
  answered: boolean;
  mcCorrect: boolean | null;
  codingCorrect?: boolean | null;
  timeSpentMs?: number;
  submission: SubmissionDto | null;
};

export type ProgressDto = {
  answered: number;
  total: number;
  freeTextAnswered?: number;
  mcAnswered?: number;
  mcCorrect?: number;
  mcScorePct?: number | null;
  codingAnswered?: number;
  codingCorrect?: number;
  codingScorePct?: number | null;
  timeSpentMs?: number;
};

export type SolutionDto = {
  id: string;
  idealAnswer: string;
  explanation: string;
  codeSolution: string | null;
  blankAnswers?: string[] | null;
};
