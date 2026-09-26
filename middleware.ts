import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";
import { SA_ONLY_SEGMENTS, SESSION_COOKIE, verifySession } from "./lib/session";

const intl = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const m = pathname.match(/^(?:\/(en|id))?\/admin(?:\/([^/]+))?/);
  if (m && m[2] !== "login") {
    const prefix = m[1] ? `/${m[1]}` : "";
    const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!s) {
      const url = req.nextUrl.clone();
      url.pathname = `${prefix}/admin/login`;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (m[2] && SA_ONLY_SEGMENTS.includes(m[2]) && s.role !== "SUPER_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = `${prefix}/admin`;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|brand|fonts|favicon.ico|robots.txt|.*\\..*).*)"],
};
