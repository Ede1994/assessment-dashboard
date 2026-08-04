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
};

export type QuestionListItem = {
  id: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: "FREE_TEXT" | "MULTIPLE_CHOICE";
  codeSnippet: string | null;
  sortOrder: number;
  category: CategoryDto;
  choices: ChoiceDto[];
  answered: boolean;
  submission: SubmissionDto | null;
};

export type SolutionDto = {
  id: string;
  idealAnswer: string;
  explanation: string;
  codeSolution: string | null;
};
