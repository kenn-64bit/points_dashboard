import type { LeaderboardRow } from "@/types";
import { Badge } from "@/components/common/Badge";

const RANK_BADGES: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No points recorded for this event yet.</p>;
  }

  const maxPoints = Math.max(...rows.map((r) => r.total_points), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const isTop = row.rank === 1;
        const widthPct = Math.max(12, Math.round((row.total_points / maxPoints) * 100));
        return (
          <div key={row.discord_id} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-muted-foreground">
              {RANK_BADGES[row.rank] ? (
                <span className="text-lg leading-none">{RANK_BADGES[row.rank]}</span>
              ) : (
                row.rank
              )}
            </div>
            <div className="relative h-11 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`flex h-full items-center rounded-full px-4 transition-[width] ${
                  isTop ? "bg-gradient-to-r from-accent-from to-accent-to" : "bg-foreground/10"
                }`}
                style={{ width: `${widthPct}%` }}
              >
                <span className={`truncate text-sm font-medium ${isTop ? "text-accent-foreground" : "text-foreground"}`}>
                  {row.discord_username}
                </span>
              </div>
            </div>
            <Badge tone={isTop ? "accent" : "neutral"} className="shrink-0 px-3 py-1.5 text-sm">
              {row.total_points} pts
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
