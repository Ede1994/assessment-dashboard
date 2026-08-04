import { SessionOptions } from "iron-session";
import type { Role } from "@/generated/prisma/client";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};

export type SessionData = {
  user?: SessionUser;
};

function resolveSessionPassword() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters in production.",
    );
  }
  return "assessment-dashboard-dev-secret-change-in-prod-32chars";
}

export const sessionOptions: SessionOptions = {
  password: resolveSessionPassword(),
  cookieName: "assessment_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};
