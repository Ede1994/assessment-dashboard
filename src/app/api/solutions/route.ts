import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Trainer-only: full question bank with solutions and correct choices. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      category: true,
      choices: { orderBy: { sortOrder: "asc" } },
      solution: true,
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ categories, questions });
}
