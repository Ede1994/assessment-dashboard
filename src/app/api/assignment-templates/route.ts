import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseTemplateBody } from "@/lib/assignmentTemplateInput";

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

/** Trainer: list named assignment templates. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.assignmentTemplate.findMany({
    orderBy: { name: "asc" },
    include: { questions: { select: { questionId: true } } },
  });

  return NextResponse.json({ templates: templates.map(serializeTemplate) });
}

/** Trainer: create a named assignment template from a question set. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseTemplateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { name, description = "", questionIds = [] } = parsed.data;
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const clash = await prisma.assignmentTemplate.findUnique({ where: { name } });
  if (clash) {
    return NextResponse.json(
      { error: "A template with that name already exists." },
      { status: 409 },
    );
  }

  if (questionIds.length > 0) {
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

  const template = await prisma.assignmentTemplate.create({
    data: {
      name,
      description,
      questions: {
        create: questionIds.map((questionId) => ({ questionId })),
      },
    },
    include: { questions: { select: { questionId: true } } },
  });

  return NextResponse.json(
    { ok: true, template: serializeTemplate(template) },
    { status: 201 },
  );
}
