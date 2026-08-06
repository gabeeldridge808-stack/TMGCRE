import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// /api/setup is a bootstrap-only route (creates the first admin account
// when the users table is empty; refuses once one exists — see its route
// file) that by definition runs before anyone can be logged in.
const PUBLIC_PREFIXES = ["/login", "/api/setup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  // TEMPORARY diagnostic — remove once the New Deal server-action redirect
  // bug is root-caused.
  console.log("[mw-debug]", req.method, pathname, "hasCookie:", !!token, "cookieLen:", token?.length ?? 0, "userValid:", !!user);

  if (!user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
