import { DAY_COLUMNS, DAY_LABELS } from "@/types";
import type { Day, EventWeek } from "@/types";

// A week is the dates an admin picked through "Add Week": 1–7 days, starting
// on any weekday (see EventWeek). Points rows are keyed to its first day.
// Weeks from before picked ranges run Monday–Sunday. An event only has the
// weeks that were added (or have points); none are made up for it. All date
// math is on YYYY-MM-DD strings read as UTC, so it never drifts with the
// viewer's time zone.

export const MAX_WEEK_DAYS = 7;

function toUTCDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
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

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

// Whole days from `a` to `b`; negative when `b` is earlier.
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function getToday(): string {
  const now = new Date();
  // "Today" must be the viewer's local calendar date, not the UTC one — using
  // UTC getters here made the app compute the wrong current week for part of
  // every day for any viewer not at UTC+0. Once anchored to local Y/M/D, the
  // rest of the pipeline can stay UTC-based for consistent, TZ-drift-free date
  // arithmetic on the stored week_date strings.
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// The Monday–Sunday week starting on `monday`.
export function mondayWeek(monday: string): EventWeek {
  return { week_date: monday, end_date: addDays(monday, MAX_WEEK_DAYS - 1) };
}

// The Monday–Sunday week `date` falls in.
export function mondayWeekOf(date: string): EventWeek {
  return mondayWeek(formatDate(getMondayOf(parseDate(date))));
}

export function sortWeeks(weeks: EventWeek[]): EventWeek[] {
  return [...weeks].sort((a, b) => (a.week_date < b.week_date ? -1 : a.week_date > b.week_date ? 1 : 0));
}

// A picked range as weeks: 7-day blocks from its first day, the last one
// shorter when the range doesn't divide evenly. A range of up to 7 days is one
// week, e.g. May 20 → Jun 5 is May 20 - 26, May 27 - Jun 2 and Jun 3 - 5.
export function splitIntoWeeks(start: string, end: string): EventWeek[] {
  const [first, last] = start <= end ? [start, end] : [end, start];
  const weeks: EventWeek[] = [];
  for (let weekStart = first; weekStart <= last; weekStart = addDays(weekStart, MAX_WEEK_DAYS)) {
    const fullEnd = addDays(weekStart, MAX_WEEK_DAYS - 1);
    weeks.push({ week_date: weekStart, end_date: fullEnd < last ? fullEnd : last });
  }
  return weeks;
}

export interface WeekDay {
  day: Day; // the points column the day's score is kept in
  date: string;
}

// The week's days in order, e.g. Thu May 20 … Mon May 24.
export function weekDays(week: EventWeek): WeekDay[] {
  const length = daysBetween(week.week_date, week.end_date) + 1;
  return Array.from({ length }, (_, i) => {
    const date = addDays(week.week_date, i);
    return { day: dayColumnOf(date), date };
  });
}

export function weekHasDay(week: EventWeek, day: Day): boolean {
  return weekDays(week).some((d) => d.day === day);
}

// The date a points column stands for in the week starting on `weekDate`.
export function dateOfDay(weekDate: string, day: Day): string {
  const offset = (DAY_COLUMNS.indexOf(day) - DAY_COLUMNS.indexOf(dayColumnOf(weekDate)) + 7) % 7;
  return addDays(weekDate, offset);
}

export function weekContaining(weeks: EventWeek[], date: string): EventWeek | undefined {
  return weeks.find((week) => week.week_date <= date && date <= week.end_date);
}

// The first of `weeks` sharing a day with start…end.
export function findOverlap(weeks: EventWeek[], start: string, end: string): EventWeek | undefined {
  return weeks.find((week) => week.week_date <= end && start <= week.end_date);
}

// The week to open on (its first day): the one today is in, else the latest
// that has started, else the first. Null when the event has no weeks.
export function defaultWeek(weeks: EventWeek[], today: string): string | null {
  const week = weekContaining(weeks, today) ?? weeks.filter((w) => w.week_date <= today).at(-1) ?? weeks[0];
  return week?.week_date ?? null;
}

// The week a points write is for: the event's week starting on `weekDate`, or
// null when it has none, e.g. because it was deleted. Writes only go to weeks
// that exist, so a page left open on a deleted week can't bring it back.
export function resolveWeek(weeks: EventWeek[], weekDate: string): EventWeek | null {
  return weeks.find((week) => week.week_date === weekDate) ?? null;
}

// e.g. "Sep 7 - 13, 2026" (same month), "Sep 28 - Oct 4, 2026" (spans
// months), "Dec 28, 2026 - Jan 3, 2027" (spans years) or "Sep 7, 2026".
export function formatDateSpan(startStr: string, endStr: string): string {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return startStr;

  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const year = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });

  if (startStr === endStr) return `${month(start)} ${day(start)}, ${year(start)}`;
  const sameYear = year(start) === year(end);
  const sameMonth = sameYear && month(start) === month(end);
  const from = `${month(start)} ${day(start)}${sameYear ? "" : `, ${year(start)}`}`;
  const to = sameMonth ? day(end) : `${month(end)} ${day(end)}`;
  return `${from} - ${to}, ${year(end)}`;
}

// e.g. "May 20 - 24, 2027".
export function formatWeekRange(week: EventWeek): string {
  return formatDateSpan(week.week_date, week.end_date);
}

// e.g. "Week 1 · May 20 - 24, 2027", where weekNumber is the week's position
// in the event (1 = earliest). Falls back to the bare range without one.
export function formatWeekLabel(weekNumber: number, week: EventWeek): string {
  const range = formatWeekRange(week);
  return weekNumber >= 1 ? `Week ${weekNumber} · ${range}` : range;
}

// The points column a date's score is kept in, e.g. "2026-09-22" (a Tuesday)
// → "tuesday". Expects a valid YYYY-MM-DD.
export function dayColumnOf(dateStr: string): Day {
  const parsed = parseDate(dateStr);
  const isoDow = parsed.getUTCDay() === 0 ? 7 : parsed.getUTCDay(); // 1=Mon..7=Sun
  return DAY_COLUMNS[isoDow - 1];
}

// e.g. "Tue, Sep 22, 2026".
export function formatDayLabel(dateStr: string): string {
  const date = parseDate(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// e.g. "Thu 20", as the points table and editor head a day.
export function formatShortDayLabel(dateStr: string): string {
  return `${DAY_LABELS[dayColumnOf(dateStr)]} ${Number(dateStr.slice(8))}`;
}
