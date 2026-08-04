import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseCategoryBody } from "@/lib/categoryInput";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseCategoryBody(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, slug, icon, color, sortOrder } = parsed.data;

  if (slug !== existing.slug) {
    const clash = await prisma.category.findUnique({ where: { slug } });
    if (clash) {
      return NextResponse.json(
        { error: "That slug is already in use." },
        { status: 409 },
      );
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      name,
      slug,
      icon,
      color,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json({ ok: true, category });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { questions: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (existing._count.questions > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${existing._count.questions} question(s) still use this category. Reassign or delete them first.`,
      },
      { status: 400 },
    );
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: { id, slug: existing.slug } });
}
