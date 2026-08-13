export type AssignmentTemplateInput = {
  name: string;
  description: string;
  questionIds: string[];
};

export function parseTemplateBody(
  body: unknown,
  { partial = false }: { partial?: boolean } = {},
):
  | { ok: true; data: Partial<AssignmentTemplateInput> & { name?: string; questionIds?: string[] } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;
  const data: Partial<AssignmentTemplateInput> = {};

  if (b.name !== undefined || !partial) {
    const name = String(b.name ?? "").trim();
    if (!name) return { ok: false, error: "name is required." };
    if (name.length > 80) return { ok: false, error: "name must be 80 characters or fewer." };
    data.name = name;
  }

  if (b.description !== undefined || !partial) {
    data.description = String(b.description ?? "").trim();
  }

  if (b.questionIds !== undefined || !partial) {
    if (!Array.isArray(b.questionIds)) {
      return { ok: false, error: "questionIds[] is required." };
    }
    const questionIds = [
      ...new Set(
        (b.questionIds as unknown[])
          .map((id) => String(id ?? "").trim())
          .filter(Boolean),
      ),
    ];
    data.questionIds = questionIds;
  }

  return { ok: true, data };
}
