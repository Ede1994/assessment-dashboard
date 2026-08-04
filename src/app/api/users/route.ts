import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  hashPassword,
  validatePasswordStrength,
  validateUsername,
} from "@/lib/password";
import type { Role } from "@/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      createdAt: true,
      _count: { select: { submissions: true, assignments: true } },
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return NextResponse.json({ users });
}

/** Trainer creates a student or trainer account. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "TRAINER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim() || username;
  const role = String(body?.role ?? "STUDENT").toUpperCase() as Role;

  if (role !== "STUDENT" && role !== "TRAINER") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 },
    );
  }

  const created = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      displayName,
      role,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, user: created }, { status: 201 });
}
