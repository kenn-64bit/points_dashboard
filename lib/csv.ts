import Papa from "papaparse";
import { DAY_COLUMNS } from "@/types";
import type { LeaderboardRow, PointsRowWithUser } from "@/types";
import { formatWeekRange } from "@/lib/week";
import { ordinal } from "@/lib/points";

// Discord usernames come from bulk-import, so they're fully attacker-controlled
// text. A value starting with =, +, -, @ (or a leading tab/CR) can be
// interpreted as a formula by Excel/Sheets when the exported CSV is opened —
// prefixing it with a quote neutralizes that (CSV/Excel formula injection).
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// A one-cell line such as the event name or a "Week of ..." heading. Run
// through Papa.unparse so a comma (e.g. "Sep 7 - 13, 2026") gets quoted
// instead of splitting into extra columns when opened in a spreadsheet.
function titleLine(text: string): string {
  return Papa.unparse([[sanitizeCsvCell(text)]]);
}

const DAY_HEADERS = DAY_COLUMNS.map((day) => day[0].toUpperCase() + day.slice(1));
const POINTS_FIELDS = ["Discord Username", ...DAY_HEADERS, "Total Points", "Days Participated"];

// One week's table. Days Participated = that week's day columns > 0 (0–7).
// Distinct from the leaderboard's "weeks participated" metric, which counts
// non-zero weeks. Fields are explicit so an empty week still gets a header row.
function buildPointsTableCsv(rows: PointsRowWithUser[]): string {
  const data = rows.map((row) => [
    sanitizeCsvCell(row.discord_username),
    ...DAY_COLUMNS.map((day) => row[day]),
    row.total_points,
    DAY_COLUMNS.filter((day) => row[day] > 0).length,
  ]);
  return Papa.unparse({ fields: POINTS_FIELDS, data });
}

// Event name in the top cell, then a "Week of ..." heading + table per week,
// sections separated by a blank line. Callers must pass sections pre-sorted.
export function buildEventExportCsv(
  eventName: string,
  weekSections: { week: string; rows: PointsRowWithUser[] }[]
): string {
  const sections = weekSections.map(
    ({ week, rows }) => `${titleLine(`Week of ${formatWeekRange(week)}`)}\n${buildPointsTableCsv(rows)}`
  );
  return [titleLine(eventName), ...sections].join("\n\n");
}

// Event name in the top cell, then the standings in the order the leaderboard
// page shows them, with the same places (1st, 2nd, …).
export function buildLeaderboardCsv(eventName: string, rows: LeaderboardRow[]): string {
  const data = rows.map((row, idx) => [ordinal(idx + 1), sanitizeCsvCell(row.discord_username), row.total_points]);
  const table = Papa.unparse({ fields: ["Place", "Discord Username", "Total Points"], data });
  return `${titleLine(eventName)}\n\n${table}`;
}

// A filename-safe version of the event name, e.g. "Spring Cup!" → "spring-cup".
export function csvFileSlug(eventName: string): string {
  const slug = eventName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "event";
}
