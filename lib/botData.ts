import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/points";
import { loadEventWeeks } from "@/lib/eventData";
import { isValidDateStr, isValidUUID } from "@/lib/validation";
import {
  dayColumnOf,
  formatDate,
  formatDayLabel,
  formatWeekLabel,
  formatWeekRange,
  formatWeeksSpan,
  normalizeToMonday,
} from "@/lib/week";
import { BOT_TIMEFRAMES, DAY_COLUMNS, DAY_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS } from "@/types";
import type {
  BotBreakdownItem,
  BotEvent,
  BotLeaderboard,
  BotPeriod,
  BotPlayer,
  BotTimeframe,
  BotUserStats,
  Day,
  DayValues,
  EventType,
  LeaderboardRow,
} from "@/types";

// Read-only data for the Discord bot's API (app/api/bot/*). The numbers match
// the dashboard's: totals come from points.total_points and places from
// computeLeaderboard. On top of that the bot can ask about one week, one day,
// or all events together.

// ─── Paging ──────────────────────────────────────────────────────────────────

// Supabase returns at most 1000 rows per request (the API's default "Max
// rows"), so reads that can grow past that page through with .range().
// PAGE_SIZE must not exceed that setting, or a short page ends the loop early.
const PAGE_SIZE = 1000;

interface RangeQuery {
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}

// `query` builds a fresh query, in a fixed order, for each page: a Supabase
// query runs only once, and the pages must line up.
async function selectAllRows<T>(query: () => RangeQuery): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// ─── Query parameters ────────────────────────────────────────────────────────

export type BotScope = { kind: "latest" } | { kind: "all" } | { kind: "event"; eventId: string };

export interface StandingsQuery {
  scope: BotScope;
  timeframe: BotTimeframe;
  date: string | null; // the day asked about (week and day timeframes)
}

function isBotTimeframe(value: string): value is BotTimeframe {
  return (BOT_TIMEFRAMES as readonly string[]).includes(value);
}

// isValidDateStr alone lets 2026-02-30 roll over into March.
function isCalendarDate(value: string): boolean {
  return isValidDateStr(value) && formatDate(new Date(`${value}T00:00:00Z`)) === value;
}

// ?event_id=<uuid>|all (left out: the latest event), ?timeframe=event|week|day
// (default event) and ?date=YYYY-MM-DD (week and day only; default today, UTC).
export function parseStandingsQuery(params: URLSearchParams): { query: StandingsQuery } | { error: string } {
  const eventId = params.get("event_id");
  let scope: BotScope;
  if (!eventId) scope = { kind: "latest" };
  else if (eventId === "all") scope = { kind: "all" };
  else if (isValidUUID(eventId)) scope = { kind: "event", eventId };
  else return { error: 'event_id must be an event id or "all"' };

  const timeframe = params.get("timeframe") ?? "event";
  if (!isBotTimeframe(timeframe)) return { error: `timeframe must be one of: ${BOT_TIMEFRAMES.join(", ")}` };

  const date = params.get("date");
  if (timeframe === "event") {
    if (date) return { error: "date only applies to the week and day timeframes" };
    return { query: { scope, timeframe, date: null } };
  }
  if (date && !isCalendarDate(date)) return { error: "date must be a calendar date (YYYY-MM-DD)" };
  return { query: { scope, timeframe, date: date ?? formatDate(new Date()) } };
}

// ─── Events and players ──────────────────────────────────────────────────────

const EVENT_COLUMNS = "event_id, event_name, event_type, created_at, month";

function toBotEvent(row: Record<string, unknown>): BotEvent {
  // Events from before types existed (or with an unknown one) read as
  // "other", as on the dashboard.
  const type = EVENT_TYPES.includes(row.event_type as EventType) ? (row.event_type as EventType) : "other";
  return {
    event_id: row.event_id as string,
    event_name: row.event_name as string,
    event_type: type,
    event_type_label: EVENT_TYPE_LABELS[type],
    month: row.month as string,
    created_at: row.created_at as string,
  };
}

function toBotPlayer(row: Record<string, unknown>): BotPlayer {
  return { discord_id: row.discord_id as string, discord_username: row.discord_username as string };
}

// Every event, newest first (the dashboard's order).
export async function loadBotEvents(): Promise<BotEvent[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("events")
    .select(EVENT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toBotEvent);
}

// Every player, A→Z, for the bot's autocomplete and "who am I" lookup.
export async function loadBotPlayers(): Promise<BotPlayer[]> {
  const rows = await selectAllRows<Record<string, unknown>>(() =>
    getSupabaseAdmin().from("users").select("discord_id, discord_username").order("discord_username")
  );
  return rows.map(toBotPlayer);
}

// ─── Standings ───────────────────────────────────────────────────────────────

// The default scope: the event with the most recent week of points (the
// newest such event when several share that week). Falls back to the newest
// event when there are no points yet; null when there are no events.
async function loadLatestEvent(): Promise<BotEvent | null> {
  const supabase = getSupabaseAdmin();
  const [events, latest] = await Promise.all([
    loadBotEvents(),
    supabase.from("points").select("week_date").order("week_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  if (!latest.data) return events[0] ?? null;

  const latestWeek = latest.data.week_date as string;
  const inLatestWeek = await selectAllRows<{ event_id: string }>(() =>
    supabase.from("points").select("event_id").eq("week_date", latestWeek).order("point_id")
  );
  const ids = new Set(inLatestWeek.map((row) => row.event_id));
  return events.find((event) => ids.has(event.event_id)) ?? events[0] ?? null;
}

// The event a query is about (null for all events), or why there isn't one.
async function resolveScope(scope: BotScope): Promise<{ event: BotEvent | null } | { notFound: string }> {
  if (scope.kind === "all") return { event: null };
  if (scope.kind === "latest") {
    const event = await loadLatestEvent();
    return event ? { event } : { notFound: "No events have been created yet" };
  }
  const { data, error } = await getSupabaseAdmin()
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("event_id", scope.eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? { event: toBotEvent(data) } : { notFound: "Event not found" };
}

type ScopeRow = DayValues & {
  event_id: string;
  discord_id: string;
  discord_username: string;
  week_date: string;
  total_points: number;
};

const POINTS_COLUMNS =
  "event_id, discord_id, week_date, total_points, monday, tuesday, wednesday, thursday, friday, saturday, sunday, users(discord_username)";

// The points rows in scope, with each player's name: one event or all of
// them, and for the week and day timeframes only that week's rows.
async function loadScopeRows(eventId: string | null, week: string | null): Promise<ScopeRow[]> {
  const rows = await selectAllRows<Record<string, unknown>>(() => {
    let query = getSupabaseAdmin().from("points").select(POINTS_COLUMNS);
    if (eventId) query = query.eq("event_id", eventId);
    if (week) query = query.eq("week_date", week);
    return query.order("point_id");
  });
  return rows.map((row) => {
    const { users, ...rest } = row as { users: { discord_username: string } | null } & Record<string, unknown>;
    return { ...rest, discord_username: users?.discord_username ?? "unknown" } as ScopeRow;
  });
}

interface Standings {
  event: BotEvent | null;
  period: BotPeriod;
  rows: ScopeRow[];
  eventWeeks: string[] | null; // the event's weeks, oldest first; null for all events
  day: Day | null; // the column that counts, for the day timeframe
}

// "Week 2 · Sep 21 - 27, 2026" and the like, numbered as on the dashboard.
function describePeriod(query: StandingsQuery, week: string | null, eventWeeks: string[] | null): BotPeriod {
  const { timeframe, date } = query;
  if (timeframe === "day" && date) {
    return { timeframe, week_date: week, date, label: formatDayLabel(date) };
  }
  if (timeframe === "week" && week) {
    const weekNumber = eventWeeks ? eventWeeks.indexOf(week) + 1 : 0;
    const label = weekNumber >= 1 ? formatWeekLabel(weekNumber, week) : `Week of ${formatWeekRange(week)}`;
    return { timeframe, week_date: week, date: null, label };
  }
  if (!eventWeeks) return { timeframe, week_date: null, date: null, label: "All events · all time" };
  const label = eventWeeks.length > 0 ? `All weeks · ${formatWeeksSpan(eventWeeks[0], eventWeeks.at(-1)!)}` : "All weeks";
  return { timeframe, week_date: null, date: null, label };
}

async function loadStandings(query: StandingsQuery): Promise<Standings | { notFound: string }> {
  const scope = await resolveScope(query.scope);
  if ("notFound" in scope) return scope;

  const { event } = scope;
  const week = query.date ? normalizeToMonday(query.date) : null;
  const [rows, eventWeeks] = await Promise.all([
    loadScopeRows(event?.event_id ?? null, week),
    event ? loadEventWeeks(event.event_id) : null,
  ]);
  return {
    event,
    rows,
    eventWeeks,
    day: query.timeframe === "day" && query.date ? dayColumnOf(query.date) : null,
    period: describePeriod(query, week, eventWeeks),
  };
}

// Places for the period: each player's total over the rows in scope, or only
// the one day's column for the day timeframe.
function rankPlayers({ rows, day }: Standings): LeaderboardRow[] {
  return computeLeaderboard(
    rows.map((row) => ({
      discord_id: row.discord_id,
      discord_username: row.discord_username,
      total_points: day ? row[day] : row.total_points,
    }))
  );
}

export async function loadBotLeaderboard(query: StandingsQuery): Promise<BotLeaderboard | { notFound: string }> {
  const standings = await loadStandings(query);
  if ("notFound" in standings) return standings;

  const ranked = rankPlayers(standings);
  return {
    event: standings.event,
    period: standings.period,
    // Players on 0 sort last, so leaving them out doesn't change anyone's place.
    rows: ranked.filter((row) => row.total_points > 0),
    participants: ranked.length,
    generated_at: new Date().toISOString(),
  };
}

// ─── One player ──────────────────────────────────────────────────────────────

// Escapes LIKE's own wildcards, so a name only matches itself.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// A player by name: the exact name, else the one name that matches it
// ignoring case.
async function findPlayer(name: string): Promise<{ player: BotPlayer } | { notFound: string }> {
  const supabase = getSupabaseAdmin();
  const { data: exact, error } = await supabase
    .from("users")
    .select("discord_id, discord_username")
    .eq("discord_username", name)
    .maybeSingle();
  if (error) throw error;
  if (exact) return { player: toBotPlayer(exact) };

  // ILIKE without wildcards compares ignoring case. PostgREST also reads * as
  // a wildcard, so the matches are checked again here.
  const { data: similar, error: similarError } = await supabase
    .from("users")
    .select("discord_id, discord_username")
    .ilike("discord_username", escapeLike(name))
    .limit(10);
  if (similarError) throw similarError;
  const lower = name.toLowerCase();
  const matches = (similar ?? []).filter((row) => (row.discord_username as string).toLowerCase() === lower);
  if (matches.length === 1) return { player: toBotPlayer(matches[0]) };
  return {
    notFound:
      matches.length > 1
        ? `More than one player is called "${name}" with different capital letters. Use the exact name.`
        : `No player called "${name}"`,
  };
}

function sumOf(rows: ScopeRow[], points: (row: ScopeRow) => number): number {
  return rows.reduce((sum, row) => sum + points(row), 0);
}

// Distinct calendar days with points: a day scored in two events counts once.
function countActiveDays(rows: ScopeRow[], day: Day | null): number {
  const days = new Set<string>();
  for (const row of rows) {
    for (const column of day ? [day] : DAY_COLUMNS) {
      if (row[column] > 0) days.add(`${row.week_date}:${column}`);
    }
  }
  return days.size;
}

// Where a player's points came from: each day of the week, each week of the
// event, or each event. Nothing to break down for a single day.
async function loadBreakdown(
  { eventWeeks }: Standings,
  timeframe: BotTimeframe,
  own: ScopeRow[]
): Promise<BotBreakdownItem[]> {
  if (timeframe === "day") return [];
  if (timeframe === "week") {
    return DAY_COLUMNS.map((day) => ({ label: DAY_LABELS[day], points: sumOf(own, (row) => row[day]) }));
  }
  if (eventWeeks) {
    // Every week of the event, oldest first, including weeks the player sat out.
    const weeks = [...new Set([...eventWeeks, ...own.map((row) => row.week_date)])].sort();
    return weeks.map((week) => ({
      label: formatWeekLabel(eventWeeks.indexOf(week) + 1, week),
      points: sumOf(own.filter((row) => row.week_date === week), (row) => row.total_points),
    }));
  }
  // All events: each event the player has points rows in, best first.
  const names = new Map((await loadBotEvents()).map((event) => [event.event_id, event.event_name]));
  const byEvent = new Map<string, number>();
  for (const row of own) byEvent.set(row.event_id, (byEvent.get(row.event_id) ?? 0) + row.total_points);
  return [...byEvent]
    .map(([eventId, points]) => ({ label: names.get(eventId) ?? "Unknown event", points }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
}

export async function loadBotUserStats(query: StandingsQuery, name: string): Promise<BotUserStats | { notFound: string }> {
  const [found, standings] = await Promise.all([findPlayer(name), loadStandings(query)]);
  if ("notFound" in found) return found;
  if ("notFound" in standings) return standings;

  const { player } = found;
  const ranked = rankPlayers(standings);
  const entry = ranked.find((row) => row.discord_id === player.discord_id);
  const own = standings.rows.filter((row) => row.discord_id === player.discord_id);
  return {
    player,
    event: standings.event,
    period: standings.period,
    points: entry?.total_points ?? 0,
    rank: entry && entry.total_points > 0 ? entry.rank : null,
    ranked_players: ranked.filter((row) => row.total_points > 0).length,
    active_days: countActiveDays(own, standings.day),
    breakdown: await loadBreakdown(standings, query.timeframe, own),
    generated_at: new Date().toISOString(),
  };
}
