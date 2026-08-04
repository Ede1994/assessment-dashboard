import { colorMap } from "@/lib/colors";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCategorySlug(slug: string): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length < 2) return "Slug must be at least 2 characters.";
  if (trimmed.length > 40) return "Slug must be at most 40 characters.";
  if (!SLUG_RE.test(trimmed)) {
    return "Slug must be lowercase letters, numbers, and hyphens.";
  }
  return null;
}

export function parseCategoryBody(body: unknown): {
  error?: string;
  data?: {
    name: string;
    slug: string;
    icon: string;
    color: string;
    sortOrder: number | undefined;
  };
} {
  const raw = body as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid body." };
  }

  const name = String(raw.name ?? "").trim();
  const slug = String(raw.slug ?? "").trim().toLowerCase();
  const icon = String(raw.icon ?? "fa-folder").trim() || "fa-folder";
  const color = String(raw.color ?? "sky").trim() || "sky";
  const sortRaw = raw.sortOrder;

  if (!name) return { error: "Name is required." };
  if (name.length > 80) return { error: "Name must be at most 80 characters." };

  const slugError = validateCategorySlug(slug);
  if (slugError) return { error: slugError };

  if (!colorMap[color]) {
    return {
      error: `Color must be one of: ${Object.keys(colorMap).join(", ")}.`,
    };
  }

  let sortOrder: number | undefined;
  if (sortRaw !== undefined && sortRaw !== null && sortRaw !== "") {
    const n = Number(sortRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: "sortOrder must be an integer." };
    }
    sortOrder = n;
  }

  return { data: { name, slug, icon, color, sortOrder } };
}
