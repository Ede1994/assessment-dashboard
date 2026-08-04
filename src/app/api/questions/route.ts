import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAssignedQuestionIds } from "@/lib/assignments";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignedIds =
    user.role === "STUDENT" ? await getAssignedQuestionIds(user.id) : null;

  const [categories, questions] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.question.findMany({
      where:
        assignedIds === null
          ? undefined
          : { id: { in: assignedIds } },
      orderBy: { sortOrder: "asc" },
      include: {
        category: true,
        choices: { orderBy: { sortOrder: "asc" } },
        submissions: {
          where: { userId: user.id },
          select: {
            id: true,
            textAnswer: true,
            selectedChoiceId: true,
            submittedAt: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  const payload = questions.map((q) => {
    const submission = q.submissions[0] ?? null;
    return {
      id: q.id,
      title: q.title,
      prompt: q.prompt,
      roundLabel: q.roundLabel,
      tags: q.tags,
      type: q.type,
      codeSnippet: q.codeSnippet,
      sortOrder: q.sortOrder,
      category: {
        id: q.category.id,
        slug: q.category.slug,
        name: q.category.name,
        icon: q.category.icon,
        color: q.category.color,
      },
      choices: q.choices.map((c) => ({
        id: c.id,
        label: c.label,
        sortOrder: c.sortOrder,
        ...(user.role === "TRAINER" ? { isCorrect: c.isCorrect } : {}),
      })),
      answered: Boolean(submission),
      submission,
    };
  });

  return NextResponse.json({
    categories: categories.filter((c) =>
      payload.some((q) => q.category.id === c.id),
    ),
    questions: payload,
    assignmentMode: assignedIds !== null,
    progress: {
      answered: payload.filter((q) => q.answered).length,
      total: payload.length,
    },
  });
}
