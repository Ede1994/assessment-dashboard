import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
