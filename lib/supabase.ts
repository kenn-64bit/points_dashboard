import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabaseClient, MOCK_ADMIN_EMAIL, MOCK_ADMIN_PASSWORD } from "@/lib/mockSupabase";

// Service-role client — bypasses RLS entirely. Only ever import this from
// app/api/**/route.ts handlers. The browser never receives this key.
// Untyped (no generated Database schema) — `any` keeps table access loose
// instead of collapsing to `never`, since we have no live project to codegen from.
/* eslint-disable @typescript-eslint/no-explicit-any */
let cachedClient: SupabaseClient<any, any, any> | null = null;

export function getSupabaseAdmin(): SupabaseClient<any, any, any> {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    // No real Supabase project configured — fall back to hardcoded in-memory
    // data so the frontend can be checked with zero backend setup. Remove
    // this branch's relevance simply by setting real env vars; nothing else
    // in the app needs to change either way. See lib/mockSupabase.ts.
    console.warn(
      `[dev] Supabase env vars not set — using in-memory mock data instead of a real database. Sign in with ${MOCK_ADMIN_EMAIL} / ${MOCK_ADMIN_PASSWORD} (or editor@ / viewer@example.com, same password).`
    );
    cachedClient = createMockSupabaseClient() as unknown as SupabaseClient<any, any, any>;
    return cachedClient;
  }

  cachedClient = createClient<any, any, any>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
