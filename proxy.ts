import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit, mutationRateLimit, bulkImportRateLimit, loginRateLimit } from "@/lib/rateLimit";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|cursors/).*)"],
};

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

// Vercel sets x-real-ip itself. For x-forwarded-for, the first entry is
// whatever the client sent, so only the last hop (added by our proxy) is used.
function clientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}

// A browser always sends Origin on cross-site writes. SameSite=Lax already
// keeps the session cookie off them; this rejects them outright as well.
function isCrossOriginWrite(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

// Per-request nonce: Next.js reads the CSP from the request headers and adds
// the nonce to its own inline scripts; the root layout adds it to the theme
// script. Dev needs 'unsafe-eval' for React's debugging tools.
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && isCrossOriginWrite(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  let rateLimitHeaders: { limit: number; remaining: number } | null = null;
  if (isApi) {
    const ip = clientIp(request);
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

  if (isApi) {
    const response = NextResponse.next();
    if (rateLimitHeaders) {
      response.headers.set("X-RateLimit-Limit", rateLimitHeaders.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitHeaders.remaining.toString());
    }
    return response;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
