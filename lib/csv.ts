import Papa from "papaparse";
import { DAY_COLUMNS } from "@/types";
import type { PointsRowWithUser } from "@/types";
import { formatWeekRange } from "@/lib/week";

// Discord usernames come from bulk-import, so they're fully attacker-controlled
// text. A value starting with =, +, -, @ (or a leading tab/CR) can be
// interpreted as a formula by Excel/Sheets when the exported CSV is opened —
// prefixing it with a quote neutralizes that (CSV/Excel formula injection).
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// Participation here = count of that week's day columns > 0 (0–7). Distinct from
// the leaderboard's "weeks participated" metric, which counts non-zero weeks.
export function buildPointsExportCsv(rows: PointsRowWithUser[]): string {
  const data = rows.map((row) => {
    const participation = DAY_COLUMNS.filter((day) => row[day] > 0).length;
    const record: Record<string, string | number> = {
      "Discord Username": sanitizeCsvCell(row.discord_username),
    };
    for (const day of DAY_COLUMNS) {
      record[day[0].toUpperCase() + day.slice(1)] = row[day];
    }
    record["Total Points"] = row.total_points;
    record["Participation"] = participation;
    return record;
  });

  return Papa.unparse(data);
}

// Whole-event export: one CSV with a "Week of ..." header + table per week,
// sections separated by a blank line. Callers must pass sections pre-sorted.
// The header is run through Papa.unparse (as a single-cell row) so a comma in
// the week range (e.g. "Sep 7 - 13, 2026") gets quoted instead of splitting
// into extra columns when opened in a spreadsheet.
export function buildEventExportCsv(weekSections: { week: string; rows: PointsRowWithUser[] }[]): string {
  return weekSections
    .map(({ week, rows }) => {
      const header = Papa.unparse([[`Week of ${formatWeekRange(week)}`]]);
      return `${header}\n${buildPointsExportCsv(rows)}`;
    })
    .join("\n\n");
}
