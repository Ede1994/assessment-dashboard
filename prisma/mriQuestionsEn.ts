import { QuestionType } from "../src/generated/prisma/client";

export type MriSeedQuestion = {
  categorySlug: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: QuestionType;
  idealAnswer: string;
  explanation: string;
  choices?: { label: string; isCorrect: boolean }[];
};

/** Extra MRI-only items so CT/MRI assignment filters are not heuristic-only. */
export const mriQuestionsEn: MriSeedQuestion[] = [
  {
    categorySlug: "ct-mri",
    title: "T1 vs T2 Contrast in Spin-Echo MRI",
    prompt:
      "On a conventional spin-echo MRI, which statement about tissue contrast is correct?",
    roundLabel: "MRI-Q1",
    tags: "MRI T1 T2 Contrast",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      {
        label: "CSF is bright on T1-weighted images and dark on T2-weighted images",
        isCorrect: false,
      },
      {
        label: "CSF is dark on T1-weighted images and bright on T2-weighted images",
        isCorrect: true,
      },
      {
        label: "T1 and T2 weighting are interchangeable after Hounsfield scaling",
        isCorrect: false,
      },
      {
        label: "Fat is always dark on both T1- and T2-weighted spin-echo images",
        isCorrect: false,
      },
    ],
    idealAnswer:
      "CSF has long T1 and long T2, so it is dark on T1-weighted and bright on T2-weighted spin-echo images. Fat is typically bright on T1.",
    explanation:
      "MRI contrast is sequence-dependent and has no calibrated HU equivalent.",
  },
  {
    categorySlug: "ct-mri",
    title: "Why FLAIR Suppresses CSF",
    prompt:
      "What is the primary purpose of a FLAIR sequence in brain MRI?",
    roundLabel: "MRI-Q2",
    tags: "MRI FLAIR",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      { label: "To measure Hounsfield units of edema", isCorrect: false },
      {
        label:
          "To null CSF signal so periventricular / cortical lesions stay visible",
        isCorrect: true,
      },
      { label: "To replace gadolinium for all tumor studies", isCorrect: false },
      { label: "To reconstruct CT-like bone windows", isCorrect: false },
    ],
    idealAnswer:
      "FLAIR (FLuid-Attenuated Inversion Recovery) inverts and waits so CSF recovers through the null point, darkening CSF while T2-hyperintense lesions near ventricles remain bright.",
    explanation:
      "FLAIR is an MRI-specific inversion-recovery trick, not a CT reconstruction kernel.",
  },
  {
    categorySlug: "ct-mri",
    title: "k-space and Spatial Encoding",
    prompt:
      "In MRI, what does the center of k-space primarily encode, and what happens if you zero-fill only the periphery?",
    roundLabel: "MRI-Q3",
    tags: "MRI k-space Encoding",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "The k-space center holds low spatial frequencies (contrast / bulk signal). The periphery holds high frequencies (edges / detail). Zero-filling the periphery interpolates the image (larger matrix, smoother) without adding true resolution. Truncating the center destroys contrast.",
    explanation:
      "k-space is unique to Fourier MRI encoding; CT projections are a different geometry (Radon / FBP).",
  },
];
