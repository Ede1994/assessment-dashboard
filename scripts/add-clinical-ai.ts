import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { clinicalAiCategories } from "../prisma/clinicalAiQuestionsEn";
import { isMriHeavy } from "../src/lib/assignmentPresets";

/** Add the clinical AI curriculum without replacing existing bank content. */
async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    let categoriesAdded = 0;
    let questionsAdded = 0;
    let questionsSkipped = 0;
    let assignmentsAdded = 0;
    let categorySortOrder =
      (await tx.category.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    let questionSortOrder =
      (await tx.question.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const importedQuestions: {
      id: string;
      title: string;
      tags: string;
      prompt: string;
    }[] = [];

    for (const topic of clinicalAiCategories) {
      let category = await tx.category.findUnique({ where: { slug: topic.slug } });
      if (!category) {
        categorySortOrder += 1;
        category = await tx.category.create({
          data: {
            slug: topic.slug,
            name: topic.name,
            icon: topic.icon,
            color: topic.color,
            sortOrder: categorySortOrder,
          },
        });
        categoriesAdded += 1;
      }

      for (const item of topic.questions) {
        // Category + curriculum label identify an existing item. Skipping it
        // preserves trainer edits, choice IDs, submissions, and assignments.
        let saved = await tx.question.findFirst({
          where: { categoryId: category.id, roundLabel: item.roundLabel },
          select: { id: true, title: true, tags: true, prompt: true },
        });
        if (saved) {
          questionsSkipped += 1;
        } else {
          questionSortOrder += 1;
          saved = await tx.question.create({
            data: {
              categoryId: category.id,
              title: item.title,
              prompt: item.prompt,
              roundLabel: item.roundLabel,
              tags: item.tags,
              type: item.type,
              sortOrder: questionSortOrder,
              solution: {
                create: {
                  idealAnswer: item.idealAnswer,
                  explanation: item.explanation,
                },
              },
              choices: item.choices
                ? {
                    create: item.choices.map((choice, sortOrder) => ({
                      ...choice,
                      sortOrder,
                    })),
                  }
                : undefined,
            },
            select: { id: true, title: true, tags: true, prompt: true },
          });
          questionsAdded += 1;
        }
        importedQuestions.push(saved);
      }
    }

    // Keep the bundled demo tracks usable; trainers assign other students
    // explicitly through the existing Assign tasks screen.
    const demoStudents = await tx.user.findMany({
      where: { username: { in: ["student", "student2"] }, role: "STUDENT" },
      select: { id: true, username: true },
    });
    for (const student of demoStudents) {
      const eligible = importedQuestions.filter(
        (item) => student.username === "student" || !isMriHeavy(item.title, item.tags, item.prompt),
      );
      const existing = await tx.questionAssignment.findMany({
        where: { userId: student.id, questionId: { in: eligible.map((item) => item.id) } },
        select: { questionId: true },
      });
      const assigned = new Set(existing.map((item) => item.questionId));
      const missing = eligible.filter((item) => !assigned.has(item.id));
      if (missing.length > 0) {
        const added = await tx.questionAssignment.createMany({
          data: missing.map((item) => ({ userId: student.id, questionId: item.id })),
        });
        assignmentsAdded += added.count;
      }
    }

    return { categoriesAdded, questionsAdded, questionsSkipped, assignmentsAdded };
  }, { timeout: 30_000 });

  console.log("Clinical AI curriculum import complete:", summary);
  console.log("Other students can be assigned these topics in /trainer/assignments.");
}

main()
  .catch((error) => {
    console.error("Unable to add clinical AI content:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
