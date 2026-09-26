import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse } from "@/lib/apiError";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import type { AppUserRole } from "@/types";

const MAX_EMAIL_LENGTH = 254;
// Bounds the scrypt work a single request can trigger.
const MAX_PASSWORD_LENGTH = 1024;

const INVALID_CREDENTIALS = "Invalid email or password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const remember = body.remember === true;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .select("email, password_hash, role")
      .eq("email", email)
      .maybeSingle();
    if (error) return errorResponse(error);

    // Always run a full hash comparison — an unknown email must take as long
    // as a wrong password, so response timing never reveals who's on the roster.
    const valid = await verifyPassword(password, (user?.password_hash as string | undefined) ?? DUMMY_HASH);
    if (!user || !valid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    const token = await signSession({ email: user.email as string, role: user.role as AppUserRole }, remember);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(remember));
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
