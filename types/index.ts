export type Day =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAY_COLUMNS: Day[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<Day, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export type DayValues = Record<Day, number>;

export interface User {
  discord_id: string;
  discord_username: string;
  created_at: string;
}

export const EVENT_TYPES = ["game_night", "tournament", "challenge", "giveaway", "community", "other"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  game_night: "Game Night",
  tournament: "Tournament",
  challenge: "Challenge",
  giveaway: "Giveaway",
  community: "Community",
  other: "Other",
};

export interface Event {
  event_id: string;
  event_name: string;
  event_type: EventType;
  description: string | null;
  created_at: string;
  month: string;
}

export interface EventSummary {
  weeks: string[]; // Mondays with at least one points row, oldest first
  participant_count: number;
}

export interface PointsRow extends DayValues {
  point_id: string;
  event_id: string;
  discord_id: string;
  total_points: number;
  week_date: string;
  created_at: string;
  updated_at: string;
}

export type PointsRowWithUser = PointsRow & { discord_username: string };

// A row for a user who has no points entry for the selected week yet.
// point_id is null until the first save, at which point POST creates it.
export type PointsRowDraft = Omit<
  PointsRow,
  "point_id" | "created_at" | "updated_at" | "total_points"
> & {
  point_id: string | null;
  total_points: number;
};

export type PointsTableRow = PointsRowWithUser | (PointsRowDraft & { discord_username: string });

export interface LeaderboardRow {
  discord_id: string;
  discord_username: string;
  total_points: number;
  rank: number;
}

// ─── Discord bot API (app/api/bot/*) ─────────────────────────────────────────
// Read-only JSON for the Discord bot in bot/. Keep in sync with
// bot/src/api/types.ts, which copies these so the bot can deploy on its own.

// event = all of an event's weeks, week = one Monday–Sunday week, day = one day.
export const BOT_TIMEFRAMES = ["event", "week", "day"] as const;

export type BotTimeframe = (typeof BOT_TIMEFRAMES)[number];

export interface BotEvent {
  event_id: string;
  event_name: string;
  event_type: EventType;
  event_type_label: string;
  month: string;
  created_at: string;
}

export interface BotPlayer {
  discord_id: string;
  discord_username: string;
}

export interface BotPeriod {
  timeframe: BotTimeframe;
  week_date: string | null; // the week's Monday (week and day timeframes)
  date: string | null; // the day itself (day timeframe)
  label: string; // "All weeks · Sep 7 - Oct 4, 2026", "Week 2 · Sep 21 - 27, 2026", "Tue, Sep 22, 2026"
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

export type ImportFormat = "weekly" | "total";

export interface ParsedImportRow extends DayValues {
  rowNumber: number;
  discord_username: string;
  total_points: number;
  format: ImportFormat;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ParsedImportResult {
  format: ImportFormat | "mixed" | null;
  validRows: ParsedImportRow[];
  invalidRows: ImportRowError[];
  totalRows: number;
  fileLevelError?: string;
}

export interface BulkImportResult {
  success: boolean;
  imported: number;
  created_users: number;
  updated_users: number;
  failed: number;
  errors: ImportRowError[];
  week_date: string;
}

export interface ApiError {
  error: string;
}

// Keep in sync with APP_USER_ROLES in lib/auth/roles.ts and schema.sql.
export type AppUserRole = "admin" | "editor" | "viewer";

export interface SessionUser {
  email: string;
  role: AppUserRole;
}

// A roster row as the Team page sees it — never includes password_hash.
export interface TeamMember {
  email: string;
  role: AppUserRole;
  created_at: string;
}

// Keep in sync with the audit_log.action check in schema.sql.
export type AuditAction =
  | "score.set"
  | "score.update"
  | "score.delete"
  | "week.add"
  | "week.remove"
  | "import"
  | "participants.add"
  | "event.create"
  | "event.update"
  | "event.delete"
  | "team.add"
  | "team.role"
  | "team.password"
  | "team.remove"
  | "export.week"
  | "export.leaderboard";

// An audit_log row (see AUDIT_LOG.md). Names are snapshots from when the
// action happened, and actor_role is the role the actor had then.
export interface AuditRow {
  id: number;
  created_at: string;
  actor_email: string;
  actor_role: AppUserRole;
  action: AuditAction;
  event_id: string | null;
  event_name: string | null;
  target: string | null;
  details: Record<string, unknown>;
}
