import { prisma } from "@/lib/prisma";

/** Returns assigned question IDs for a student, or null if none configured (show all). */
export async function getAssignedQuestionIds(
  userId: string,
): Promise<string[] | null> {
  const assignments = await prisma.questionAssignment.findMany({
    where: { userId },
    select: { questionId: true },
  });
  if (assignments.length === 0) return null;
  return assignments.map((a) => a.questionId);
}

export async function studentCanAccessQuestion(
  userId: string,
  questionId: string,
): Promise<boolean> {
  const ids = await getAssignedQuestionIds(userId);
  if (ids === null) return true;
  return ids.includes(questionId);
}
