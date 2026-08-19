import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "./src/lib/session";

/** Paden die zonder sessie bereikbaar moeten blijven. */
const PUBLIC = ["/login"];

function withSecurityHeaders(request: NextRequest, init?: { request?: { headers: Headers } }) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.openstreetmap.org https://*.public.blob.vercel-storage.com https://*.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(init?.request?.headers ?? request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return response;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((prefix) => path.startsWith(prefix));
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  if (path === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return process.env.NODE_ENV === "production"
      ? withSecurityHeaders(request)
      : NextResponse.next();
  }

  if (!isPublic && !session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (path.startsWith("/settings") && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  return withSecurityHeaders(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|uploads|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)",
  ],
};
