import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// The Discord bot (hosted on BotGhost) has no session cookie: it reads
// /api/bot/leaderboard with `Authorization: Bearer <BOT_API_KEY>` instead.
// Until BOT_API_KEY is set, every bot request is refused; there is no default
// key. Same minimum length as SESSION_SECRET.
const MIN_KEY_LENGTH = 32;

// Hashing both sides first gives timingSafeEqual equal-length buffers, so the
// comparison time reveals neither the key nor its length.
function sameKey(given: string, key: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(key));
}

// True only when the request carries the configured key. Logs neither.
export function hasBotKey(request: Request): boolean {
  const key = process.env.BOT_API_KEY?.trim();
  if (!key || key.length < MIN_KEY_LENGTH) return false;

  // The scheme name is case-insensitive (RFC 7235).
  const token = /^bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1].trim();
  return !!token && sameKey(token, key);
}
