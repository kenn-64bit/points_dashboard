import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/points";
import { loadEventWeeks } from "@/lib/eventData";
import { isCalendarDate, isValidUUID } from "@/lib/validation";
import {
  addDays,
  dateOfDay,
  dayColumnOf,
  formatDate,
  formatDateSpan,
  formatDayLabel,
  formatWeekLabel,
  formatWeekRange,
  MAX_WEEK_DAYS,
  mondayWeekOf,
  weekContaining,
  weekDays,
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
  EventWeek,
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

function toScopeRow(row: Record<string, unknown>): ScopeRow {
  const { users, ...rest } = row as { users: { discord_username: string } | null } & Record<string, unknown>;
  return { ...rest, discord_username: users?.discord_username ?? "unknown" } as ScopeRow;
}

// The points rows in scope, with each player's name: one event or all of
// them, and only one week's rows when `week` (its first day) is given.
async function loadScopeRows(eventId: string | null, week: string | null): Promise<ScopeRow[]> {
  const rows = await selectAllRows<Record<string, unknown>>(() => {
    let query = getSupabaseAdmin().from("points").select(POINTS_COLUMNS);
    if (eventId) query = query.eq("event_id", eventId);
    if (week) query = query.eq("week_date", week);
    return query.order("point_id");
  });
  return rows.map(toScopeRow);
}

// Every event's rows for the week `date` is in. Events' weeks start on
// different days, so these are the rows whose week starts at most 6 days
// before `date` and hasn't ended by then (end_date from event_weeks; a week
// with only points runs Monday–Sunday, so 6 days on).
async function loadRowsOn(date: string): Promise<ScopeRow[]> {
  const supabase = getSupabaseAdmin();
  const from = addDays(date, -(MAX_WEEK_DAYS - 1));
  const [rows, planned] = await Promise.all([
    selectAllRows<Record<string, unknown>>(() =>
      supabase.from("points").select(POINTS_COLUMNS).gte("week_date", from).lte("week_date", date).order("point_id")
    ),
    supabase.from("event_weeks").select("event_id, week_date, end_date").gte("week_date", from).lte("week_date", date),
  ]);
  if (planned.error) console.error("[event_weeks]", planned.error);

  const ends = new Map(
    (planned.error ? [] : (planned.data ?? [])).map((row) => [`${row.event_id}:${row.week_date}`, row.end_date as string])
  );
  return rows.map(toScopeRow).filter((row) => {
    const end = ends.get(`${row.event_id}:${row.week_date}`) ?? addDays(row.week_date, MAX_WEEK_DAYS - 1);
    return date <= end;
  });
}

interface Standings {
  event: BotEvent | null;
  period: BotPeriod;
  rows: ScopeRow[];
  eventWeeks: EventWeek[] | null; // the event's weeks, oldest first; null for all events
  week: EventWeek | null; // one event's week, for the week and day timeframes
  day: Day | null; // the column that counts, for the day timeframe
}

// "Week 2 · Sep 21 - 25, 2026" and the like, numbered as on the dashboard.
function describePeriod(query: StandingsQuery, week: EventWeek | null, eventWeeks: EventWeek[] | null): BotPeriod {
  const { timeframe, date } = query;
  if (timeframe === "day" && date) {
    return { timeframe, week_date: week?.week_date ?? null, date, label: formatDayLabel(date) };
  }
  if (timeframe === "week" && date) {
    // All events: each event's own week that `date` is in.
    if (!week) return { timeframe, week_date: null, date, label: `Week of ${formatDayLabel(date)}` };
    const weekNumber = (eventWeeks ?? []).findIndex((w) => w.week_date === week.week_date) + 1;
    const label = weekNumber >= 1 ? formatWeekLabel(weekNumber, week) : `Week of ${formatWeekRange(week)}`;
    return { timeframe, week_date: week.week_date, date: null, label };
  }
  if (!eventWeeks) return { timeframe, week_date: null, date: null, label: "All events · all time" };
  const label =
    eventWeeks.length > 0
      ? `All weeks · ${formatDateSpan(eventWeeks[0].week_date, eventWeeks.at(-1)!.end_date)}`
      : "All weeks";
  return { timeframe, week_date: null, date: null, label };
}

async function loadStandings(query: StandingsQuery): Promise<Standings | { notFound: string }> {
  const scope = await resolveScope(query.scope);
  if ("notFound" in scope) return scope;

  const { event } = scope;
  const { date } = query;
  const eventWeeks = event ? await loadEventWeeks(event.event_id) : null;
  // One event: its week that `date` is in, or that date's Monday–Sunday when
  // none of its weeks has it (which finds nothing unless it has old weeks).
  const week = date && eventWeeks ? (weekContaining(eventWeeks, date) ?? mondayWeekOf(date)) : null;
  const rows =
    date && !event ? await loadRowsOn(date) : await loadScopeRows(event?.event_id ?? null, week?.week_date ?? null);
  return {
    event,
    rows,
    eventWeeks,
    week,
    day: query.timeframe === "day" && date ? dayColumnOf(date) : null,
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

// Distinct calendar days with points: a day scored in two events counts once,
// even when the two events' weeks start on different days.
function countActiveDays(rows: ScopeRow[], day: Day | null): number {
  const days = new Set<string>();
  for (const row of rows) {
    for (const column of day ? [day] : DAY_COLUMNS) {
      if (row[column] > 0) days.add(dateOfDay(row.week_date, column));
    }
  }
  return days.size;
}

// Where a player's points came from: each day of the week, each week of the
// event, or each event. Nothing to break down for a single day.
async function loadBreakdown(
  { eventWeeks, week }: Standings,
  timeframe: BotTimeframe,
  own: ScopeRow[]
): Promise<BotBreakdownItem[]> {
  if (timeframe === "day") return [];
  if (timeframe === "week") {
    // One event: its week's own days, in order. All events: Monday–Sunday.
    const days = week ? weekDays(week).map(({ day }) => day) : DAY_COLUMNS;
    return days.map((day) => ({ label: DAY_LABELS[day], points: sumOf(own, (row) => row[day]) }));
  }
  if (eventWeeks) {
    // Every week of the event (which includes every week with points), oldest
    // first, including weeks the player sat out.
    return eventWeeks.map((w, i) => ({
      label: formatWeekLabel(i + 1, w),
      points: sumOf(own.filter((row) => row.week_date === w.week_date), (row) => row.total_points),
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
