import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  hashPassword,
  validatePasswordStrength,
  validateUsername,
} from "@/lib/password";

/** Public self-registration — always creates a STUDENT account. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim() || username;

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

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName,
      role: "STUDENT",
    },
  });

  const session = await getSession();
  session.user = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
  await session.save();

  return NextResponse.json({
    ok: true,
    role: user.role,
    redirectTo: "/student",
  });
}
