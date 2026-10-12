// Responses from the dashboard's bot API (app/api/bot/*). A copy of the Bot*
// types in the dashboard's types/index.ts, kept here so the bot can deploy on
// its own. Keep the two in sync.

// event = all of an event's weeks, week = the week a date falls in, day = one day.
export type BotTimeframe = "event" | "week" | "day";

export type EventType = "game_night" | "tournament" | "challenge" | "giveaway" | "community" | "other";

export interface BotEvent {
  event_id: string;
  event_name: string;
  event_type: EventType;
  event_type_label: string;
  month: string; // YYYY-MM
  created_at: string;
}

export interface BotPlayer {
  discord_id: string; // the dashboard's own id, not a Discord user id
  discord_username: string;
}

export interface BotPeriod {
  timeframe: BotTimeframe;
  week_date: string | null; // the week's first day (one event's week and day timeframes)
  date: string | null; // the day asked about (day timeframe, and the week timeframe for all events)
  label: string; // "All weeks · Sep 7 - Oct 4, 2026", "Week 2 · Sep 21 - 25, 2026", "Tue, Sep 22, 2026"
}

export interface LeaderboardRow {
  discord_id: string;
  discord_username: string;
  total_points: number;
  rank: number; // tied totals share a rank: 1, 2, 2, 4
}

export interface BotLeaderboard {
  event: BotEvent | null; // null = all events
  period: BotPeriod;
  rows: LeaderboardRow[]; // players with points in the period, best first
  participants: number; // players with a points row in scope, including those on 0
  generated_at: string;
}

export interface BotBreakdownItem {
  label: string;
  points: number;
}

export interface BotUserStats {
  player: BotPlayer;
  event: BotEvent | null; // null = all events
  period: BotPeriod;
  points: number;
  rank: number | null; // null when the player has no points in the period
  ranked_players: number; // players with points in the period
  active_days: number; // distinct days with points
  // Each day (week timeframe), each week (one event) or each event (all
  // events) the points came from. Empty for the day timeframe.
  breakdown: BotBreakdownItem[];
  generated_at: string;
}

// What a leaderboard or stats request asks for. `event` is an event id or
// "all"; left out, the dashboard picks its latest event. `date` (YYYY-MM-DD)
// is only for the week and day timeframes.
export interface StandingsQuery {
  event?: string;
  timeframe: BotTimeframe;
  date?: string;
}
