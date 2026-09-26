import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
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
