import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  hashPassword,
  validatePasswordStrength,
} from "@/lib/password";

type Params = { params: Promise<{ id: string }> };

/** Trainer resets another user's password (no current-password check). */
export async function PATCH(request: Request, { params }: Params) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const password = String(body?.password ?? "");

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      role: target.role,
    },
  });
}

/** Trainer removes a user (cascades submissions + assignments). */
export async function DELETE(_request: Request, { params }: Params) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === actor.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (target.role === "TRAINER") {
    const trainerCount = await prisma.user.count({
      where: { role: "TRAINER" },
    });
    if (trainerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last trainer account." },
        { status: 400 },
      );
    }
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({
    ok: true,
    deleted: { id: target.id, username: target.username },
  });
}
