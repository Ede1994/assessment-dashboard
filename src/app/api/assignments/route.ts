import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Trainer: list assignments (optionally for one student). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId");

  const [students, categories, questions, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        username: true,
        displayName: true,
        _count: { select: { assignments: true } },
      },
      orderBy: { username: "asc" },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.question.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        prompt: true,
        roundLabel: true,
        tags: true,
        type: true,
        categoryId: true,
        category: { select: { slug: true, name: true, color: true } },
      },
    }),
    prisma.questionAssignment.findMany({
      where: studentId ? { userId: studentId } : undefined,
      select: { userId: true, questionId: true },
    }),
  ]);

  const totalQuestions = questions.length;

  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      assignedCount: s._count.assignments,
      totalQuestions,
    })),
    categories,
    questions,
    assignments,
  });
}

/** Trainer: replace the full assignment set for one student. */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const studentId = String(body?.studentId ?? "");
  const questionIds = Array.isArray(body?.questionIds)
    ? (body.questionIds as unknown[]).map(String)
    : null;

  if (!studentId || questionIds === null) {
    return NextResponse.json(
      { error: "studentId and questionIds[] are required" },
      { status: 400 },
    );
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length > 0) {
    const found = await prisma.question.count({
      where: { id: { in: uniqueIds } },
    });
    if (found !== uniqueIds.length) {
      return NextResponse.json(
        { error: "One or more questionIds are invalid" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.questionAssignment.deleteMany({ where: { userId: studentId } }),
    ...(uniqueIds.length
      ? [
          prisma.questionAssignment.createMany({
            data: uniqueIds.map((questionId) => ({
              userId: studentId,
              questionId,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({
    ok: true,
    studentId,
    assignedCount: uniqueIds.length,
  });
}
