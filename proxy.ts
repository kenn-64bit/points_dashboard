import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit, mutationRateLimit, bulkImportRateLimit, loginRateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|cursors/).*)"],
};

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  let rateLimitHeaders: { limit: number; remaining: number } | null = null;
  if (isApi) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limiter =
      pathname === "/api/auth/login"
        ? loginRateLimit
        : pathname.startsWith("/api/users/bulk-import")
          ? bulkImportRateLimit
          : request.method === "GET"
            ? apiRateLimit
            : mutationRateLimit;

    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(1, Math.ceil((reset - Date.now()) / 1000)).toString(),
          },
        }
      );
    }
    if (limit > 0) rateLimitHeaders = { limit, remaining };
  }

  // Optimistic check — signature + expiry only, no DB. Route handlers and
  // pages re-check against the roster via getCurrentUser() (lib/auth/dal.ts).
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !PUBLIC_PATHS.has(pathname)) {
    if (isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Signed-in users visiting /login are redirected by the page itself, not
  // here: it checks the roster, so a valid token for a removed user shows the
  // form instead of bouncing between /login and /dashboard forever.

  const response = NextResponse.next();
  if (rateLimitHeaders) {
    response.headers.set("X-RateLimit-Limit", rateLimitHeaders.limit.toString());
    response.headers.set("X-RateLimit-Remaining", rateLimitHeaders.remaining.toString());
  }
  return response;
}
