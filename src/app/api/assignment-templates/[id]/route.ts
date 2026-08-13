import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseTemplateBody } from "@/lib/assignmentTemplateInput";

type Params = { params: Promise<{ id: string }> };

function serializeTemplate(t: {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  questions: Array<{ questionId: string }>;
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    questionIds: t.questions.map((q) => q.questionId),
    questionCount: t.questions.length,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** Trainer: rename or replace a named assignment template. */
export async function PUT(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.assignmentTemplate.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseTemplateBody(body, { partial: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, description, questionIds } = parsed.data;

  if (name && name !== existing.name) {
    const clash = await prisma.assignmentTemplate.findUnique({ where: { name } });
    if (clash) {
      return NextResponse.json(
        { error: "A template with that name already exists." },
        { status: 409 },
      );
    }
  }

  if (questionIds && questionIds.length > 0) {
    const found = await prisma.question.count({
      where: { id: { in: questionIds } },
    });
    if (found !== questionIds.length) {
      return NextResponse.json(
        { error: "One or more questionIds are invalid." },
        { status: 400 },
      );
    }
  }

  const template = await prisma.$transaction(async (tx) => {
    if (questionIds) {
      await tx.assignmentTemplateQuestion.deleteMany({
        where: { templateId: id },
      });
      if (questionIds.length > 0) {
        await tx.assignmentTemplateQuestion.createMany({
          data: questionIds.map((questionId) => ({ templateId: id, questionId })),
        });
      }
    }

    return tx.assignmentTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
      include: { questions: { select: { questionId: true } } },
    });
  });

  return NextResponse.json({ ok: true, template: serializeTemplate(template) });
}

/** Trainer: delete a named assignment template. */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.assignmentTemplate.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  await prisma.assignmentTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: { id, name: existing.name } });
}
