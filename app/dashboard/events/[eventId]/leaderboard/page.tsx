import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/dal";
import { loadLeaderboard } from "@/lib/eventData";
import { isValidUUID } from "@/lib/validation";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";
import { DownloadIcon } from "@/components/common/icons";
import type { LeaderboardRow } from "@/types";

export const dynamic = "force-dynamic";

async function loadStandings(eventId: string): Promise<{ leaderboard: LeaderboardRow[] } | { error: string }> {
  try {
    return { leaderboard: await loadLeaderboard(eventId) };
  } catch (err) {
    // Logged here; the page shows a generic message rather than raw DB text.
    console.error(err);
    return { error: "Couldn't load the leaderboard. Please try again." };
  }
}

export default async function LeaderboardPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requirePageUser();
  const { eventId } = await params;
  if (!isValidUUID(eventId)) notFound();
  const result = await loadStandings(eventId);
  const canExport = "leaderboard" in result && result.leaderboard.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href={`/dashboard/events/${eventId}`} className={buttonClasses("ghost", "mb-4")}>
        ← Back to event
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Leaderboard</h1>
        {canExport && (
          <a href={`/api/events/${eventId}/leaderboard/export`} className={buttonClasses("secondary")}>
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </a>
        )}
      </div>
      {"error" in result ? <ErrorState message={result.error} /> : <Leaderboard rows={result.leaderboard} />}
    </div>
  );
}
