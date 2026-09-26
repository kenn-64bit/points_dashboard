import type { LeaderboardRow } from "@/types";
import { Badge } from "@/components/common/Badge";
import { Panel } from "@/components/common/Panel";

const RANK_BADGES: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <Panel bodyClassName="px-5 py-4">
        <p className="text-sm text-muted-foreground">No points recorded for this event yet.</p>
      </Panel>
    );
  }

  const maxPoints = Math.max(...rows.map((r) => r.total_points), 1);

  return (
    <Panel label="All weeks" bodyClassName="divide-y divide-dashed divide-line px-4 sm:px-5">
      {rows.map((row) => {
        const isTop = row.rank === 1;
        const widthPct = Math.max(12, Math.round((row.total_points / maxPoints) * 100));
        return (
          <div key={row.discord_id} className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-extrabold text-muted-foreground">
              {RANK_BADGES[row.rank] ? (
                <span className="text-lg leading-none">{RANK_BADGES[row.rank]}</span>
              ) : (
                row.rank
              )}
            </div>
            <div className="relative h-10 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`flex h-full items-center rounded-full px-4 transition-[width] duration-200 ease-out ${
                  isTop ? "bg-accent" : "bg-line/60"
                }`}
                style={{ width: `${widthPct}%` }}
              >
                <span className={`truncate text-sm font-bold ${isTop ? "text-accent-foreground" : "text-foreground"}`}>
                  {row.discord_username}
                </span>
              </div>
            </div>
            <Badge tone="total" className="shrink-0 px-3 py-1.5 text-sm">
              {row.total_points} pts
            </Badge>
          </div>
        );
      })}
    </Panel>
  );
}
