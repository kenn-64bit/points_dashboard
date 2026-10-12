import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// The Discord bot (bot/) reads /api/bot/* with a shared secret, sent as
// `Authorization: Bearer <BOT_API_SECRET>`, instead of a session cookie. Until
// BOT_API_SECRET is set, every bot route answers 503, so the bot API is off
// by default. Same minimum length as SESSION_SECRET.
const MIN_SECRET_LENGTH = 32;

// Hashing both sides first gives timingSafeEqual equal-length inputs, so the
// comparison time doesn't reveal the secret's length either.
function sameSecret(given: string, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

// For bot route handlers: null when the request carries the bot's secret,
// otherwise the 503/401 response to send back.
//   const denied = requireBotClient(request);
//   if (denied) return denied;
export function requireBotClient(request: NextRequest): NextResponse | null {
  const secret = process.env.BOT_API_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "The bot API is not configured." }, { status: 503 });
  }

  // The scheme name is case-insensitive (RFC 7235).
  const token = /^bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1].trim();
  if (!token || !sameSecret(token, secret)) {
    return NextResponse.json({ error: "Invalid bot token" }, { status: 401 });
  }
  return null;
}
