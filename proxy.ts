import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "./src/lib/session";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  if (path === "/login") {
    return session
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (path.startsWith("/settings") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)",
  ],
};
