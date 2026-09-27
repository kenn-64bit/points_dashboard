import type { LeaderboardRow } from "@/types";
import { Badge } from "@/components/common/Badge";
import { Panel } from "@/components/common/Panel";

const RANK_BADGES: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const ORDINAL_RULES = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };

function ordinal(n: number) {
  return `${n}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(n)] ?? "th"}`;
}

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
      {rows.map((row, idx) => {
        // Rows arrive sorted (ties by name), so the displayed place is the
        // row's position. Only a leader with points gets the orange bar.
        const place = idx + 1;
        const isTop = place === 1 && row.total_points > 0;
        const widthPct = Math.round((row.total_points / maxPoints) * 100);
        return (
          <div key={row.discord_id} className="flex items-center gap-3 py-3">
            <div className="flex w-[4.75rem] shrink-0 items-center gap-2">
              {RANK_BADGES[place] ? (
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg leading-none"
                >
                  {RANK_BADGES[place]}
                </span>
              ) : (
                <span aria-hidden className="h-8 w-8 shrink-0" />
              )}
              <span
                className={`text-sm font-extrabold tabular-nums ${isTop ? "text-accent-ink" : "text-muted-foreground"}`}
              >
                {ordinal(place)}
              </span>
            </div>
            <div className="bar-track relative h-11 flex-1 overflow-hidden rounded-full">
              <div
                className={`bar-stripes h-full min-w-11 rounded-full transition-[width] duration-200 ease-out ${
                  isTop ? "bg-accent" : "bg-bar-idle"
                }`}
                style={{ width: `${widthPct}%` }}
              />
              <div className="absolute inset-y-0 left-2 right-2 flex items-center">
                <span className="truncate rounded-full bg-surface/70 px-3 py-1 text-sm font-bold text-foreground">
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
