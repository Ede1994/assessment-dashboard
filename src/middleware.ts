import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions,
  );
  const { pathname } = request.nextUrl;
  const user = session.user;

  if (pathname.startsWith("/student")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user.role !== "STUDENT") {
      return NextResponse.redirect(new URL("/trainer", request.url));
    }
  }

  if (pathname.startsWith("/trainer")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user.role !== "TRAINER") {
      return NextResponse.redirect(new URL("/student", request.url));
    }
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(
      new URL(user.role === "TRAINER" ? "/trainer" : "/student", request.url),
    );
  }

  if (pathname === "/") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(
      new URL(user.role === "TRAINER" ? "/trainer" : "/student", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/student/:path*", "/trainer/:path*"],
};
