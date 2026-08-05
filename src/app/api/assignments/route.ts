import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function parseDueAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

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
        assignments: {
          select: { dueAt: true },
          take: 1,
          orderBy: { assignedAt: "desc" },
        },
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
      select: { userId: true, questionId: true, dueAt: true },
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
      dueAt: s.assignments[0]?.dueAt ?? null,
    })),
    categories,
    questions,
    assignments,
  });
}

/**
 * Trainer: replace assignment set for one or many students.
 * Body: { studentId? | studentIds[], questionIds[], dueAt? }
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionIds = Array.isArray(body?.questionIds)
    ? (body.questionIds as unknown[]).map(String)
    : null;

  const studentIdsRaw: string[] = [];
  if (Array.isArray(body?.studentIds)) {
    studentIdsRaw.push(...(body.studentIds as unknown[]).map(String));
  } else if (body?.studentId) {
    studentIdsRaw.push(String(body.studentId));
  }

  const studentIds = [...new Set(studentIdsRaw.filter(Boolean))];
  const dueParsed = parseDueAt(body?.dueAt);
  if (body?.dueAt !== undefined && dueParsed === undefined) {
    return NextResponse.json(
      { error: "dueAt must be a valid date or null." },
      { status: 400 },
    );
  }
  const dueAt = dueParsed === undefined ? null : dueParsed;

  if (studentIds.length === 0 || questionIds === null) {
    return NextResponse.json(
      { error: "studentId (or studentIds[]) and questionIds[] are required" },
      { status: 400 },
    );
  }

  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, role: "STUDENT" },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    return NextResponse.json(
      { error: "One or more students were not found." },
      { status: 404 },
    );
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

  await prisma.$transaction(async (tx) => {
    await tx.questionAssignment.deleteMany({
      where: { userId: { in: studentIds } },
    });
    if (uniqueIds.length === 0) return;
    await tx.questionAssignment.createMany({
      data: studentIds.flatMap((userId) =>
        uniqueIds.map((questionId) => ({
          userId,
          questionId,
          dueAt,
        })),
      ),
    });
  });

  return NextResponse.json({
    ok: true,
    studentIds,
    assignedCount: uniqueIds.length,
    studentCount: studentIds.length,
    dueAt,
  });
}
