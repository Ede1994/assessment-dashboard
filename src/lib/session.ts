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

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "assessment-dashboard-dev-secret-change-in-prod-32chars",
  cookieName: "assessment_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};
