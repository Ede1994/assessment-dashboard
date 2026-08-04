import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCategoryBody } from "@/lib/categoryInput";

/** Trainer: list categories for the question editor. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json({ categories });
}

/** Trainer: create a category. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseCategoryBody(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, slug, icon, color, sortOrder } = parsed.data;

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "That slug is already in use." },
      { status: 409 },
    );
  }

  let order = sortOrder;
  if (order === undefined) {
    const agg = await prisma.category.aggregate({ _max: { sortOrder: true } });
    order = (agg._max.sortOrder ?? -1) + 1;
  }

  const category = await prisma.category.create({
    data: { name, slug, icon, color, sortOrder: order },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json({ ok: true, category }, { status: 201 });
}
