import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/apiError";
import type { AppUserRole, SessionUser } from "@/types";

// The authoritative auth check. proxy.ts only verifies the cookie's signature;
// this also confirms the email is still on the app_users roster, so deleting
// someone's row locks them out immediately instead of when their token expires.
// Cached per request, so a layout + page calling it share one lookup.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("email, role")
    .eq("email", session.email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { email: data.email as string, role: data.role as AppUserRole };
});

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// For route handlers: the signed-in user, or the 401/403 response to send
// back. The role comes from the roster row read above, never the JWT, so a
// role change applies on the user's next request.
//   const user = await requireApiUser(canEdit);
//   if (user instanceof Response) return user;
export async function requireApiUser(
  allowed?: (role: AppUserRole) => boolean
): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (allowed && !allowed(user.role)) return forbiddenResponse();
  return user;
}
