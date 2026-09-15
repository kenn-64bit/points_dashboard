// All points rows are keyed to the Monday of their week. Any date an admin picks
// (or the current date, for a new import) is silently normalized to that Monday —
// the schema's points_week_is_monday CHECK is the final backstop against drift.

function toUTCDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getMondayOf(date: Date): Date {
  const utc = toUTCDate(date);
  const isoDow = utc.getUTCDay() === 0 ? 7 : utc.getUTCDay(); // 1=Mon..7=Sun
  utc.setUTCDate(utc.getUTCDate() - (isoDow - 1));
  return utc;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getCurrentWeekMonday(): string {
  const now = new Date();
  // "Today" must be the viewer's local calendar date, not the UTC one — using
  // UTC getters here made the app compute the wrong current week for part of
  // every day for any viewer not at UTC+0. Once anchored to local Y/M/D, the
  // rest of the pipeline (getMondayOf/toUTCDate) can stay UTC-based for
  // consistent, TZ-drift-free date arithmetic on the stored week_date strings.
  const localToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return formatDate(getMondayOf(localToday));
}

export function normalizeToMonday(dateStr: string): string {
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return getCurrentWeekMonday();
  return formatDate(getMondayOf(parsed));
}

export function isMonday(dateStr: string): boolean {
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getUTCDay() === 1;
}

// Every Monday from min(weekA, weekB) to max(weekA, weekB) inclusive, stepping
// 7 days at a time. Both inputs are expected to already be Mondays.
export function getWeeksBetween(weekA: string, weekB: string): string[] {
  const [start, end] = weekA <= weekB ? [weekA, weekB] : [weekB, weekA];
  const weeks: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= endDate.getTime()) {
    weeks.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

// e.g. "Sep 7 - 13, 2026" (same month) or "Sep 28 - Oct 4, 2026" (spans months).
export function formatWeekRange(mondayStr: string): string {
  const monday = new Date(`${mondayStr}T00:00:00Z`);
  if (Number.isNaN(monday.getTime())) return mondayStr;
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const year = sunday.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });

  const sameMonth = month(monday) === month(sunday);
  const start = `${month(monday)} ${day(monday)}`;
  const end = sameMonth ? day(sunday) : `${month(sunday)} ${day(sunday)}`;
  return `${start} - ${end}, ${year}`;
}
