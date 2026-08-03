import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/app/lib/session";

const publicPaths = new Set(["/login", "/api/demo/login", "/api/auth/logout"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname)) return NextResponse.next();

  const configuredPassword = process.env.PROTECTED_PAGE_PASSWORD;
  const authenticated = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    configuredPassword,
  );
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/") || pathname.startsWith("/.netlify/functions/")) {
    return NextResponse.json(
      { success: false, error: "请先登录私人演示站" },
      { status: 401 },
    );
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  if (configuredPassword && pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|multimodal-picture-book-cover.png).*)"],
};
