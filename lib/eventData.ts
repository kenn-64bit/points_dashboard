import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/points";
import type { LeaderboardRow, PointsRowWithUser } from "@/types";

// An event's weeks, oldest first: every week with points, plus weeks added
// through "Add Week" that have no scores yet (event_weeks). If event_weeks
// can't be read (e.g. its migration hasn't run), the weeks with points are
// still returned rather than failing the whole page.
export async function loadEventWeeks(eventId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const [points, planned] = await Promise.all([
    supabase.from("points").select("week_date").eq("event_id", eventId),
    supabase.from("event_weeks").select("week_date").eq("event_id", eventId),
  ]);
  if (points.error) throw points.error;
  if (planned.error) console.error("[event_weeks]", planned.error);

  const rows = [...(points.data ?? []), ...(planned.error ? [] : (planned.data ?? []))];
  return [...new Set(rows.map((row) => row.week_date as string))].sort();
}

// null when the event doesn't exist.
export async function loadEventName(eventId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("events").select("event_name").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return (data?.event_name as string | undefined) ?? null;
}

export async function loadLeaderboard(eventId: string): Promise<LeaderboardRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("points").select("*, users(discord_username)").eq("event_id", eventId);
  if (error) throw error;

  const rows: PointsRowWithUser[] = (data ?? []).map((row) => {
    const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
    return { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
  });
  return computeLeaderboard(rows);
}
