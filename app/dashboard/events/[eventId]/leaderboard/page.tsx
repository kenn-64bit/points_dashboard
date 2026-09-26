import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { requirePageUser } from "@/lib/auth/dal";
import { computeLeaderboard } from "@/lib/points";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";
import type { LeaderboardRow, PointsRowWithUser } from "@/types";

export const dynamic = "force-dynamic";

async function loadLeaderboard(eventId: string): Promise<{ leaderboard: LeaderboardRow[] } | { error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("event_id", eventId);
    if (error) return { error: error.message };

    const rows: PointsRowWithUser[] = (data ?? []).map((row) => {
      const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
      return { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
    });
    return { leaderboard: computeLeaderboard(rows) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export default async function LeaderboardPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requirePageUser();
  const { eventId } = await params;
  const result = await loadLeaderboard(eventId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href={`/dashboard/events/${eventId}`} className={buttonClasses("ghost", "mb-4")}>
        ← Back to event
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Leaderboard</h1>
      {"error" in result ? <ErrorState message={result.error} /> : <Leaderboard rows={result.leaderboard} />}
    </div>
  );
}
