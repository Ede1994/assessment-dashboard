import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  hashPassword,
  validatePasswordStrength,
  validateUsername,
} from "@/lib/password";
import { clientKey, rateLimit } from "@/lib/rateLimit";

/** Public self-registration — always creates a STUDENT account. */
export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "register"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many registration attempts. Try again in ${limited.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

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
