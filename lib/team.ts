import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { TeamMember } from "@/types";

// Only these columns ever leave the server. Rows are mapped explicitly
// rather than trusted to the select list, so password_hash can't slip through
// (the dev mock returns every column regardless of what's selected).
export const TEAM_COLUMNS = "email, role, created_at";

export function toTeamMember(row: Record<string, unknown>): TeamMember {
  return {
    email: row.email as string,
    role: row.role as TeamMember["role"],
    created_at: row.created_at as string,
  };
}

// The login roster, oldest first. Shared by the Team page and GET /api/team.
export async function loadTeam(): Promise<TeamMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select(TEAM_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toTeamMember);
}
