import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.password !== password) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 },
    );
  }

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
    redirectTo: user.role === "TRAINER" ? "/trainer" : "/student",
  });
}
