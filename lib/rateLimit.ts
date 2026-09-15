import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared, cross-instance rate limiting via Upstash's REST-based Redis client
// (works from the Edge middleware runtime, unlike a TCP-based Redis client).
// If the env vars aren't configured, we fail OPEN rather than take the whole
// app down over a missing rate-limit credential — losing rate limiting
// temporarily is a much smaller incident than an outage for an internal tool.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  console.error(
    "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set — API rate limiting is disabled."
  );
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const ALWAYS_ALLOW: RateLimitResult = { success: true, limit: 0, remaining: 0, reset: 0 };

function makeLimiter(limiter: ReturnType<typeof Ratelimit.slidingWindow>, prefix: string) {
  const ratelimit = redis ? new Ratelimit({ redis, limiter, prefix, analytics: false }) : null;
  return {
    limit: async (identifier: string): Promise<RateLimitResult> => {
      if (!ratelimit) return ALWAYS_ALLOW;
      return ratelimit.limit(identifier);
    },
  };
}

// General read traffic (GET requests).
export const apiRateLimit = makeLimiter(Ratelimit.slidingWindow(60, "60 s"), "ratelimit:api");

// Mutating requests (POST/PUT/DELETE) — tighter, since these write to the DB.
export const mutationRateLimit = makeLimiter(Ratelimit.slidingWindow(20, "60 s"), "ratelimit:mutate");

// Bulk import specifically — matches the "10 imports/hour" the project docs
// already recommend, since each import can create many users/points rows.
export const bulkImportRateLimit = makeLimiter(Ratelimit.slidingWindow(10, "60 m"), "ratelimit:bulk-import");
