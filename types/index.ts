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

export type AppUserRole = "admin" | "member";

export interface SessionUser {
  email: string;
  role: AppUserRole;
}
