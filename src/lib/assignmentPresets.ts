/** Token match for explicit CT / MRI tags (word-ish, not substring of DECT). */
export function hasModalityTag(tags: string, modality: "CT" | "MRI"): boolean {
  return new RegExp(`(?:^|[\\s,;/|])${modality}(?:$|[\\s,;/|])`, "i").test(
    tags,
  );
}

/** Shared MRI-heavy heuristic (also used by seed for student2 CT track). */
export function isMriHeavy(title: string, tags: string, prompt = ""): boolean {
  if (hasModalityTag(tags, "MRI")) return true;
  const blob = `${title} ${tags} ${prompt}`.toLowerCase();
  return /mri|mrt|flair|ny[uú]l|bias field|2\.5d|t1-weighted|multi-sequence mri|skull-strip|k-space/.test(
    blob,
  );
}

/** CT-focused: explicit CT tag or CT physics language, and not MRI-heavy. */
export function isCtFocused(title: string, tags: string, prompt = ""): boolean {
  if (isMriHeavy(title, tags, prompt)) return false;
  if (hasModalityTag(tags, "CT")) return true;
  const blob = `${title} ${tags} ${prompt}`.toLowerCase();
  return /\bct\b|hounsfield|fbp|beam hardening|dect|x-ray tube|helical pitch/.test(
    blob,
  );
}

export type PresetQuestion = {
  id: string;
  title: string;
  tags: string;
  prompt?: string;
  category: { slug: string };
};

export type AssignmentPreset = {
  id: string;
  label: string;
  description: string;
  match: (q: PresetQuestion) => boolean;
};

/** Named one-click assignment sets for the trainer UI. */
export const ASSIGNMENT_PRESETS: AssignmentPreset[] = [
  {
    id: "ct-track",
    label: "CT-track",
    description: "Full bank minus MRI-heavy tasks (same idea as student2 seed)",
    match: (q) => !isMriHeavy(q.title, q.tags, q.prompt ?? ""),
  },
  {
    id: "ct-only",
    label: "CT-only",
    description: "CT-tagged / CT-physics tasks (excludes MRI-heavy)",
    match: (q) => isCtFocused(q.title, q.tags, q.prompt ?? ""),
  },
  {
    id: "mri-track",
    label: "MRI-track",
    description: "MRI-tagged or MRI-heavy tasks (title/tags/prompt)",
    match: (q) => isMriHeavy(q.title, q.tags, q.prompt ?? ""),
  },
  {
    id: "pytorch-only",
    label: "PyTorch-only",
    description: "All questions in the pytorch category",
    match: (q) => q.category.slug === "pytorch",
  },
];

export function questionIdsForPreset(
  presetId: string,
  questions: PresetQuestion[],
): string[] | null {
  const preset = ASSIGNMENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return questions.filter(preset.match).map((q) => q.id);
}
