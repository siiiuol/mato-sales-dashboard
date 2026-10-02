import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "content/klantdocumenten");

const KLANTDOCUMENTEN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".woff2") return "font/woff2";
  return "text/html; charset=utf-8";
}

function resolveFile(segments: string[]) {
  const rel = segments.join("/");
  const candidate = path.resolve(ROOT, rel);
  if (!candidate.startsWith(path.resolve(ROOT))) return null;
  return candidate;
}

async function readHtml(filePath: string) {
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  const { path: segments } = await context.params;
  let filePath = resolveFile(segments);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  let body = await readHtml(filePath);
  if (!body && !path.extname(filePath)) {
    filePath = resolveFile([...segments, "index.html"]);
    if (filePath) body = await readHtml(filePath);
  }

  if (!body || !filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isIndex = segments.length === 1 && segments[0] === "index.html";
  const isWerkblad = segments[0] === "werkblad.html";
  if (isIndex) {
    let html = body.toString("utf8");
    if (!html.includes("<base ")) {
      html = html.replace(
        "<head>",
        '<head>\n<base href="/klantdocumenten/">'
      );
    }
    html = html
      .replaceAll('href="werkblad.html"', 'href="/klantdocumenten/werkblad.html"')
      .replaceAll('href="docs/', 'href="/klantdocumenten/docs/');
    body = Buffer.from(html, "utf8");
  } else if (isWerkblad && contentType(filePath).includes("html")) {
    let html = body.toString("utf8");
    if (!html.includes("id=\"mato-app-back\"")) {
      html = html.replace(
        "</head>",
        "<style>@media print{#mato-app-back{display:none!important}}</style></head>"
      );
      html = html.replace(
        "<body>",
        '<body><div id="mato-app-back" style="position:sticky;top:0;z-index:99;padding:10px 16px;background:#fff;border-bottom:1px solid rgba(28,24,18,.12);font:500 14px \'Source Sans 3\',Segoe UI,sans-serif"><a href="/klantdocumenten" style="color:#8a6117;text-decoration:none">← Documenten</a></div>'
      );
    }
    body = Buffer.from(html, "utf8");
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType(filePath),
      "Content-Security-Policy": KLANTDOCUMENTEN_CSP,
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}
