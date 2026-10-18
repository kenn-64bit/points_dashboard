import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/points";
import { loadEventWeeks } from "@/lib/eventData";
import { cleanText } from "@/lib/text";
import { formatWeekLabel, weekDays } from "@/lib/week";
import { DAY_LABELS } from "@/types";
import type { Day, LeaderboardRow } from "@/types";

// Read-only standings for the Discord bot (app/api/bot/leaderboard). The
// numbers match the dashboard's: the same points rows as loadLeaderboard and
// loadWeekPoints, totalled, ordered and ranked by computeLeaderboard (tied
// totals share a rank). Pages are a fixed size the bot can't change.

export const BOT_PAGE_SIZE = 10;

export interface BotLeaderboardEntry {
  rank: number;
  name: string;
  points: number;
}

// One column of the week grid. A week has 1–7 days, so there are 1–7.
export interface BotGridDay {
  key: Day;
  label: string; // "Mon"
  date: string; // YYYY-MM-DD
}

export interface BotGridRow {
  name: string;
  cells: { day: Day; points: number | null }[]; // null: no points row for the week
  total: number;
}

interface BotPage {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export type BotLeaderboard =
  | ({ event: string; week: null; leaderboard: BotLeaderboardEntry[] } & BotPage)
  | ({
      event: string;
      week: string;
      weekLabel: string; // "Week 2 · Sep 21 - 25, 2026"
      grid: { days: BotGridDay[]; rows: BotGridRow[] };
      leaderboard: BotLeaderboardEntry[];
    } & BotPage);

export interface BotLeaderboardQuery {
  eventName: string; // as cleaned by cleanText (lib/text.ts)
  week: string | null; // a week's first day; null for the whole event
  page: number; // from 1
}

type NotFound = { notFound: string };

type UserRow = { discord_id: string; users: { discord_username: string } | null };
type TotalRow = UserRow & { total_points: number | null };
type WeekRow = TotalRow & Partial<Record<Day, number | null>>;

const WEEK_COLUMNS =
  "discord_id, total_points, monday, tuesday, wednesday, thursday, friday, saturday, sunday, users(discord_username)";

function nameOf(row: UserRow): string {
  return row.users?.discord_username || row.discord_id;
}

// The event a Discord user named, compared as the dashboard saves names
// (lib/text.ts) and ignoring case. Names aren't unique, so the newest event
// wins: it's the one the dashboard lists first.
async function findEvent(eventName: string): Promise<{ event_id: string; event_name: string } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("events")
    .select("event_id, event_name")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const wanted = eventName.toLowerCase();
  const events = (data ?? []) as { event_id: string; event_name: string }[];
  return events.find((event) => cleanText(event.event_name).toLowerCase() === wanted) ?? null;
}

// The whole event: every points row, as loadLeaderboard reads them.
async function loadEventStandings(eventId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("points")
    .select("discord_id, total_points, users(discord_username)")
    .eq("event_id", eventId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as TotalRow[];
  return computeLeaderboard(
    rows.map((row) => ({ discord_id: row.discord_id, discord_username: nameOf(row), total_points: row.total_points ?? 0 }))
  );
}

// One week, with the same people as the event page's points table
// (lib/weekPoints.ts): everyone with points anywhere in the event. Someone
// with no row for the week has a total of 0 and no value for any day, where
// the table shows a draft of zeroes.
async function loadWeekStandings(
  eventId: string,
  weekDate: string
): Promise<{ standings: LeaderboardRow[]; weekRows: Map<string, WeekRow> }> {
  const supabase = getSupabaseAdmin();
  const [inEvent, inWeek] = await Promise.all([
    supabase.from("points").select("discord_id, users(discord_username)").eq("event_id", eventId),
    supabase.from("points").select(WEEK_COLUMNS).eq("event_id", eventId).eq("week_date", weekDate),
  ]);
  if (inEvent.error) throw inEvent.error;
  if (inWeek.error) throw inWeek.error;

  const names = new Map<string, string>();
  for (const row of (inEvent.data ?? []) as unknown as UserRow[]) names.set(row.discord_id, nameOf(row));
  const weekRows = new Map<string, WeekRow>();
  for (const row of (inWeek.data ?? []) as unknown as WeekRow[]) weekRows.set(row.discord_id, row);

  const standings = computeLeaderboard(
    [...names].map(([discord_id, discord_username]) => ({
      discord_id,
      discord_username,
      total_points: weekRows.get(discord_id)?.total_points ?? 0,
    }))
  );
  return { standings, weekRows };
}

// The rows on `page`. Page 1 always exists, so an event or week with no
// points yet gets an empty board rather than a 404.
function paginate<T>(rows: T[], page: number): { rows: T[]; meta: BotPage } | NotFound {
  const totalPages = Math.ceil(rows.length / BOT_PAGE_SIZE);
  const lastPage = Math.max(totalPages, 1);
  if (page > lastPage) return { notFound: `There's no page ${page}. The last page is ${lastPage}.` };
  const start = (page - 1) * BOT_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + BOT_PAGE_SIZE),
    meta: { page, pageSize: BOT_PAGE_SIZE, totalRows: rows.length, totalPages },
  };
}

function toEntry(row: LeaderboardRow): BotLeaderboardEntry {
  return { rank: row.rank, name: row.discord_username, points: row.total_points };
}

export async function loadBotLeaderboard({ eventName, week, page }: BotLeaderboardQuery): Promise<BotLeaderboard | NotFound> {
  const event = await findEvent(eventName);
  if (!event) return { notFound: "Event not found" };

  if (!week) {
    const paged = paginate(await loadEventStandings(event.event_id), page);
    if ("notFound" in paged) return paged;
    return { event: event.event_name, week: null, leaderboard: paged.rows.map(toEntry), ...paged.meta };
  }

  const [weeks, { standings, weekRows }] = await Promise.all([
    loadEventWeeks(event.event_id),
    loadWeekStandings(event.event_id, week),
  ]);
  const index = weeks.findIndex((w) => w.week_date === week);
  if (index === -1) return { notFound: `${event.event_name} has no week starting on ${week}` };

  const paged = paginate(standings, page);
  if ("notFound" in paged) return paged;

  const days: BotGridDay[] = weekDays(weeks[index]).map(({ day, date }) => ({ key: day, label: DAY_LABELS[day], date }));
  return {
    event: event.event_name,
    week,
    weekLabel: formatWeekLabel(index + 1, weeks[index]),
    grid: {
      days,
      rows: paged.rows.map((row) => {
        const saved = weekRows.get(row.discord_id);
        return {
          name: row.discord_username,
          cells: days.map(({ key }) => ({ day: key, points: saved?.[key] ?? null })),
          total: row.total_points,
        };
      }),
    },
    leaderboard: paged.rows.map(toEntry),
    ...paged.meta,
  };
}
