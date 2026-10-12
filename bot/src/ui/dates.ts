// Dates are plain YYYY-MM-DD strings, like the dashboard's week_date. "Today"
// is the calendar day in BOT_TIMEZONE, not on the host's clock (often UTC).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIn(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The `date` option: YYYY-MM-DD, "today" or "yesterday". Null when it isn't a
// real date; 2026-02-30 doesn't roll over into March.
export function parseDateInput(input: string, timeZone: string, now = new Date()): string | null {
  const value = input.trim().toLowerCase();
  if (value === "today") return todayIn(timeZone, now);
  if (value === "yesterday") return addDays(todayIn(timeZone, now), -1);
  if (!DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

// "2026-09" → "Sep 2026".
export function formatMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
