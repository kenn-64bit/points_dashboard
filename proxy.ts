import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit, mutationRateLimit, bulkImportRateLimit } from "@/lib/rateLimit";

export const config = {
  matcher: ["/api/:path*"],
};

export async function proxy(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { pathname } = request.nextUrl;

  const limiter = pathname.startsWith("/api/users/bulk-import")
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

  const response = NextResponse.next();
  if (limit > 0) {
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
  }
  return response;
}
