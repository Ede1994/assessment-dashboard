import { QuestionType } from "../src/generated/prisma/client";

export type CtSeedQuestion = {
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

/**
 * CT fundamentals quiz imported from CT_Fragen.docx + Lösung CT_Fragen.docx.
 * Multi-correct items are FREE_TEXT (student UI is single-choice radio).
 */
export const ctQuestionsEn: CtSeedQuestion[] = [
  {
    categorySlug: "ct-mri",
    title: "X-ray Tube Spectrum & Collimation",
    prompt:
      "Which of the following statements is/are correct?\n\nA) X-ray tubes emit radiation with a monoenergetic spectrum.\nB) A collimation system can be used to restrict the area that is irradiated.\nC) Most commercially available CT scanners use parallel beam geometries.\nD) The characteristic peaks in the X-ray spectrum are the cause for streak artifacts in reconstructed images.",
    roundLabel: "CT-Q1",
    tags: "CT Physics X-ray",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      {
        label: "X-ray tubes emit radiation with a monoenergetic spectrum.",
        isCorrect: false,
      },
      {
        label:
          "A collimation system can be used to restrict the area that is irradiated.",
        isCorrect: true,
      },
      {
        label:
          "Most commercially available CT scanners use parallel beam geometries.",
        isCorrect: false,
      },
      {
        label:
          "The characteristic peaks in the X-ray spectrum are the cause for streak artifacts in reconstructed images.",
        isCorrect: false,
      },
    ],
    idealAnswer:
      "Only B is correct: collimation restricts the irradiated area. X-ray tubes emit a polychromatic (not monoenergetic) spectrum; clinical CT uses fan/cone beam geometries, not parallel beams; characteristic peaks are not the usual cause of streak artifacts.",
    explanation:
      "Source: CT_Fragen / Lösung CT_Fragen — single correct statement is collimation.",
  },
  {
    categorySlug: "ct-mri",
    title: "Beer-Lambert Law in CT",
    prompt:
      "The Beer-Lambert law\n\nA) … is the solution of the inverse CT problem.\nB) … describes the attenuation of X-rays along their path through matter.\nC) … computes the initial X-ray intensities from the Hounsfield units.\nD) … can only be applied to circular scan trajectories.",
    roundLabel: "CT-Q2",
    tags: "CT Physics Attenuation",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      {
        label: "… is the solution of the inverse CT problem.",
        isCorrect: false,
      },
      {
        label:
          "… describes the attenuation of X-rays along their path through matter.",
        isCorrect: true,
      },
      {
        label: "… computes the initial X-ray intensities from the Hounsfield units.",
        isCorrect: false,
      },
      {
        label: "… can only be applied to circular scan trajectories.",
        isCorrect: false,
      },
    ],
    idealAnswer:
      "B: Beer–Lambert describes exponential attenuation of X-rays along a path through matter. It is the forward model, not the inverse CT solution, and is not limited to circular trajectories.",
    explanation:
      "Reconstruction inverts line integrals / Radon data; Beer–Lambert is the attenuation model used to form those measurements.",
  },
  {
    categorySlug: "ct-mri",
    title: "Causes of Beam Hardening",
    prompt:
      "Beam hardening is caused by (select all that apply):\n\nA) … only the polychromatic X-ray spectrum.\nB) … only the energy-dependency of attenuation coefficients.\nC) … the polychromatic X-ray spectrum and the energy-dependency of attenuation coefficients.\nD) … photoelectric absorption.\n\nList the letters of all correct statements.",
    roundLabel: "CT-Q3",
    tags: "CT Artifacts Beam Hardening",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "C and D. Beam hardening arises because the spectrum is polychromatic and attenuation coefficients depend on energy; photoelectric absorption is an important energy-dependent contribution.",
    explanation:
      "Neither polychromaticity alone nor μ(E) alone is a complete description — both matter; photoelectric absorption is part of the energy dependence.",
  },
  {
    categorySlug: "ct-mri",
    title: "Hardening / Penetrating X-ray Beam",
    prompt:
      "Which measure can you take to harden your X-ray radiation and thus make it more penetrating? (select all that apply)\n\nA) Increase the tube current (mA) at constant tube voltage (kV) to produce more X-ray photons.\nB) Increase the tube voltage (kV), which raises the maximum photon energy and shortens the average wavelengths.\nC) Decrease the distance between the X-ray tube and detector to increase geometric intensity. / Use intensifying screens to improve the detection efficiency of X-rays.\nD) Usage of (pre-)filtering like Al, Cu.\n\nList the letters of all correct measures.",
    roundLabel: "CT-Q4",
    tags: "CT Physics Filtration kV",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "B and D. Raising kV increases photon energies (harder beam). Pre-filtration (Al, Cu) removes low-energy photons and hardens the spectrum. Raising mA only increases flux, not energy; geometry/screens do not harden the beam.",
    explanation:
      "Beam hardening / penetration is about the energy spectrum, not photon count or detector efficiency.",
  },
  {
    categorySlug: "ct-mri",
    title: "Dual-Energy CT (DECT)",
    prompt:
      "Which of the following statements regarding Dual-energy CT (DECT) is/are true? (select all that apply)\n\nA) DECT uses two identical CT scans which only vary in their tube currents.\nB) The different basis materials reconstructed with DECT do not have to be actual real chemical elements or compounds.\nC) DECT can be realized with two identical CT scans that only vary in their tube voltages.\nD) DECT can be realized with a single CT scan using a dual-layer detector.\n\nList the letters of all true statements.",
    roundLabel: "CT-Q5",
    tags: "CT DECT Dual Energy",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "B, C, and D. DECT needs spectral diversity (e.g. two kV settings or a dual-layer detector), not merely different mA. Basis materials can be abstract basis functions, not necessarily real chemical elements.",
    explanation:
      "Tube-current-only pairs do not provide dual-energy information; dual-kV and dual-layer detector designs do.",
  },
  {
    categorySlug: "ct-mri",
    title: "Material Decomposition",
    prompt:
      "Which description is correct about material decomposition? (select all that apply)\n\nA) Material decomposition is based on linear combination of X-rays energy.\nB) Material decomposition is based on linear combination of materials’ absorption coefficient.\nC) Image-based material decomposition doesn’t suffer from beam-hardening artifacts.\nD) pZ decomposition is not able to do chemistry analysis. (pZ: Compton + photoelectric → effective atomic number and density)\nE) Neural networks can be used to do material decomposition.\n\nList the letters of all correct descriptions.",
    roundLabel: "CT-Q6",
    tags: "CT Material Decomposition DECT",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "B and E. Material decomposition models attenuation as a linear combination of basis materials’ absorption coefficients; learning-based / neural approaches can also perform decomposition. Image-based methods can still suffer from beam hardening; pZ methods can support chemistry-related analysis via Z_eff / density.",
    explanation:
      "Correct statements from Lösung CT_Fragen: absorption-coefficient basis combination and NN-based decomposition.",
  },
  {
    categorySlug: "ct-mri",
    title: "Filtered Back Projection — Incorrect Statement",
    prompt:
      "Which statement about filtered back projection (FBP) reconstruction is incorrect?\n\nA) It is fast and deterministic.\nB) Metal implants generate stripe artifacts in the reconstructed images.\nC) It includes the statistic property of the data.\nD) Based on the analytical inversion of the Radon transform.",
    roundLabel: "CT-Q7",
    tags: "CT FBP Reconstruction",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      { label: "It is fast and deterministic.", isCorrect: false },
      {
        label:
          "Metal implants generate stripe artifacts in the reconstructed images.",
        isCorrect: false,
      },
      {
        label: "It includes the statistic property of the data.",
        isCorrect: true,
      },
      {
        label: "Based on the analytical inversion of the Radon transform.",
        isCorrect: false,
      },
    ],
    idealAnswer:
      "C is incorrect (and therefore the answer): classical FBP does not incorporate the statistical properties of the measurements. FBP is fast/deterministic and based on analytical Radon inversion; metal often causes streak/stripe artifacts.",
    explanation:
      "Statistical / iterative methods model photon noise; FBP does not.",
  },
  {
    categorySlug: "ct-mri",
    title: "FBP Reconstruction Failure Modes",
    prompt:
      "What went wrong with the FBP reconstruction here?\n\n![FBP reconstruction comparison: original vs Reconstruction 1–3](/seed-assets/ct/fbp-reconstructions.png)\n\nFor Reconstruction 1, 2, and 3, name the defect relative to the original image.",
    roundLabel: "CT-Q8",
    tags: "CT FBP Artifacts Sampling",
    type: QuestionType.FREE_TEXT,
    idealAnswer:
      "Reconstruction 1: missing filter (unfiltered / simple back-projection → blur).\nReconstruction 2: missing angles (insufficient angular coverage, min ~180°; incomplete data → Tuy–Smith condition violated).\nReconstruction 3: few / sparse views (angular undersampling → aliasing; Crowther criterion violated).",
    explanation:
      "Visual comparison of Shepp–Logan FBP failure modes: no ramp filter, limited angle, and sparse-view streaking.",
  },
  {
    categorySlug: "ct-mri",
    title: "Hounsfield Units of Air, Water, and Bone",
    prompt:
      "In calibrated CT, which Hounsfield unit (HU) values are conventionally assigned to air and water?",
    roundLabel: "CT-Q9",
    tags: "CT Hounsfield Calibration",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      { label: "Air = 0 HU, water = 1000 HU", isCorrect: false },
      { label: "Air = −1000 HU, water = 0 HU", isCorrect: true },
      { label: "Air = −100 HU, water = 100 HU", isCorrect: false },
      { label: "Air = 0 HU, water = −1000 HU", isCorrect: false },
    ],
    idealAnswer:
      "By definition water is 0 HU and air is −1000 HU. Cortical bone is typically several hundred to 1000+ HU depending on density.",
    explanation:
      "HU calibration is a core CT-only fact and should not be confused with relative MRI intensities.",
  },
  {
    categorySlug: "ct-mri",
    title: "Helical Pitch in CT",
    prompt:
      "Pitch in helical CT is table travel per rotation divided by collimated beam width. What is the main trade-off of increasing pitch (e.g. from 1.0 to 1.5)?",
    roundLabel: "CT-Q10",
    tags: "CT Pitch Helical",
    type: QuestionType.MULTIPLE_CHOICE,
    choices: [
      { label: "Longer scan time with lower noise", isCorrect: false },
      { label: "Faster coverage, typically higher noise / more interpolation artifacts", isCorrect: true },
      { label: "Better z-resolution with no dose change", isCorrect: false },
      { label: "Pitch only exists in sequential (axial) CT", isCorrect: false },
    ],
    idealAnswer:
      "Higher pitch covers more z-range per rotation (faster, often lower dose) but undersamples the helix, increasing noise and interpolation artifacts. Pitch < 1 overlaps rotations.",
    explanation:
      "Pitch is a CT acquisition parameter with no MRI analogue.",
  },
];
