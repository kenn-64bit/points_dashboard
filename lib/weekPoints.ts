import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DAY_COLUMNS } from "@/types";
import type { PointsRowWithUser, PointsTableRow } from "@/types";

// One week's table for an event: every user who has ever appeared in the event
// (so a brand-new week can be filled for existing participants without
// re-importing), with a zeroed draft row for anyone missing that week. Shared
// by GET /api/points and the event page, which renders the current week on the
// server so the table is in the first HTML instead of a second round trip.
export async function loadWeekPoints(eventId: string, weekDate: string): Promise<PointsTableRow[]> {
  const supabase = getSupabaseAdmin();

  const [{ data: allPoints, error: allPointsError }, { data: weekRows, error: weekError }] = await Promise.all([
    supabase.from("points").select("discord_id, users(discord_id, discord_username)").eq("event_id", eventId),
    supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("event_id", eventId)
      .eq("week_date", weekDate),
  ]);
  if (allPointsError) throw allPointsError;
  if (weekError) throw weekError;

  const usersInEvent = new Map<string, string>();
  for (const row of allPoints ?? []) {
    const user = (row as unknown as { users: { discord_id: string; discord_username: string } | null }).users;
    if (user) usersInEvent.set(user.discord_id, user.discord_username);
  }

  const byUser = new Map<string, PointsRowWithUser>();
  for (const row of weekRows ?? []) {
    const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
    const withUser = { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
    byUser.set(withUser.discord_id, withUser);
  }

  const points: PointsTableRow[] = [...usersInEvent.entries()].map(([discord_id, discord_username]) => {
    const existing = byUser.get(discord_id);
    if (existing) return existing;

    const zeroDays = Object.fromEntries(DAY_COLUMNS.map((day) => [day, 0]));
    return {
      point_id: null,
      event_id: eventId,
      discord_id,
      discord_username,
      week_date: weekDate,
      total_points: 0,
      ...zeroDays,
    } as PointsTableRow;
  });

  points.sort((a, b) => a.discord_username.localeCompare(b.discord_username));
  return points;
}
