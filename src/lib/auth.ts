import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionData, type SessionUser } from "./session";
import type { Role } from "@/generated/prisma/client";

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}

export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (role && user.role !== role) {
    redirect(user.role === "TRAINER" ? "/trainer" : "/student");
  }
  return user;
}
