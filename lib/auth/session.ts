import { SignJWT, jwtVerify } from "jose";
import type { AppUserRole, SessionUser } from "@/types";

// Stateless session: a signed JWT in an httpOnly cookie. No `server-only`
// import because proxy.ts uses this too — it never reaches a client bundle,
// and SESSION_SECRET (not NEXT_PUBLIC_) is never inlined into one anyway.

export const SESSION_COOKIE = "dpm_session";
export const REMEMBER_TTL_SECONDS = 30 * 24 * 60 * 60; // "Remember me" checked
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // unchecked — browser-session cookie, capped at 12h

const DEV_FALLBACK_SECRET = "dev-only-insecure-session-secret-do-not-use-in-production";
let warnedDevSecret = false;

function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not configured (or is shorter than 32 characters).");
  }
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn("[dev] SESSION_SECRET not set — signing sessions with an insecure built-in dev secret.");
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

export async function signSession(user: SessionUser, remember: boolean): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.email)
    .setIssuedAt()
    .setExpirationTime(`${remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS}s`)
    .sign(getSessionKey());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { email: payload.sub, role: payload.role as AppUserRole };
  } catch {
    return null;
  }
}

// Without maxAge the cookie lives only until the browser is closed.
export function sessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(remember ? { maxAge: REMEMBER_TTL_SECONDS } : {}),
  };
}
