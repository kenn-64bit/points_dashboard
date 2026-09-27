import type { LeaderboardRow, PointsRowWithUser } from "@/types";

export function computeLeaderboard(rows: PointsRowWithUser[]): LeaderboardRow[] {
  const byUser = new Map<string, { discord_username: string; total_points: number }>();

  for (const row of rows) {
    const entry = byUser.get(row.discord_id) ?? {
      discord_username: row.discord_username,
      total_points: 0,
    };
    entry.total_points += row.total_points;
    byUser.set(row.discord_id, entry);
  }

  const sorted = [...byUser.entries()]
    .map(([discord_id, entry]) => ({ discord_id, ...entry }))
    .sort((a, b) => b.total_points - a.total_points || a.discord_username.localeCompare(b.discord_username));

  // Standard competition ranking: tied totals share a rank, and the next
  // distinct total's rank skips ahead by the number of tied entries (1, 2, 2, 4).
  let lastPoints: number | null = null;
  let lastRank = 0;
  return sorted.map((entry, idx) => {
    const rank = entry.total_points === lastPoints ? lastRank : idx + 1;
    lastPoints = entry.total_points;
    lastRank = rank;
    return { ...entry, rank };
  });
}

const ORDINAL_RULES = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };

// 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd".
export function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(n)] ?? "th"}`;
}
