import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/points";
import { mondayWeek, sortWeeks } from "@/lib/week";
import type { EventWeek, LeaderboardRow, PointsRowWithUser } from "@/types";

// An event's weeks, oldest first: the weeks added through "Add Week"
// (event_weeks, with the dates that were picked), plus any week that only has
// points rows, which runs Monday–Sunday (from before picked ranges). If
// event_weeks can't be read (e.g. its migration hasn't run), the weeks with
// points are still returned rather than failing the whole page.
export async function loadEventWeeks(eventId: string): Promise<EventWeek[]> {
  const supabase = getSupabaseAdmin();
  const [points, planned] = await Promise.all([
    supabase.from("points").select("week_date").eq("event_id", eventId),
    supabase.from("event_weeks").select("week_date, end_date").eq("event_id", eventId),
  ]);
  if (points.error) throw points.error;
  if (planned.error) console.error("[event_weeks]", planned.error);

  const weeks = new Map<string, EventWeek>();
  for (const row of planned.error ? [] : (planned.data ?? [])) {
    const week_date = row.week_date as string;
    weeks.set(week_date, row.end_date ? { week_date, end_date: row.end_date as string } : mondayWeek(week_date));
  }
  for (const row of points.data ?? []) {
    const week_date = row.week_date as string;
    if (!weeks.has(week_date)) weeks.set(week_date, mondayWeek(week_date));
  }
  return sortWeeks([...weeks.values()]);
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
