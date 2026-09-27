import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { loadEventName, loadEventWeeks } from "@/lib/eventData";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatWeekLabel, formatWeekRange, formatWeeksSpan } from "@/lib/week";
import { DAY_COLUMNS, DAY_LABELS, EVENT_TYPE_LABELS } from "@/types";
import type { AppUserRole, AuditAction, AuditRow, Day, DayValues, EventType, SessionUser } from "@/types";

// The admin audit log (see AUDIT_LOG.md): API routes record what they changed
// with logAudit(), and /dashboard/audit reads it back with loadAuditLog().

export interface AuditEntry {
  action: AuditAction;
  event_id?: string | null; // left out for team actions
  event_name?: string | null; // looked up from event_id when left out
  target?: string | null;
  // A player's discord_id: their username becomes the target.
  player?: string;
  // A week of the event: stored as details.week_date and week_label
  // ("Week 2 · Sep 21 - 27, 2026"), from the event's weeks at this moment.
  week?: string;
  details?: Record<string, unknown>; // never a password or hash
}

// Best-effort: a failed audit write is logged but never fails the action it
// describes, which has already happened (see AUDIT_LOG.md, "If the audit
// write fails"). The lookups run in here for the same reason.
export async function logAudit(user: SessionUser, entry: AuditEntry): Promise<void> {
  try {
    const eventId = entry.event_id ?? null;
    const [event_name, weeks, playerName] = await Promise.all([
      entry.event_name ?? (eventId ? loadEventName(eventId) : null),
      entry.week && eventId ? loadEventWeeks(eventId) : null,
      entry.player && !entry.target ? loadPlayerName(entry.player) : null,
    ]);
    const details = entry.week
      ? { week_date: entry.week, week_label: weekLabel(weeks ?? [], entry.week), ...entry.details }
      : (entry.details ?? {});

    const { error } = await getSupabaseAdmin()
      .from("audit_log")
      .insert({
        actor_email: user.email,
        actor_role: user.role,
        action: entry.action,
        event_id: eventId,
        event_name,
        target: entry.target ?? playerName ?? entry.player ?? null,
        details,
      });
    if (error) throw error;
  } catch (err) {
    console.error("[audit]", err);
  }
}

async function loadPlayerName(discordId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("discord_username")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) throw error;
  return (data?.discord_username as string | undefined) ?? null;
}

// "Week 2 · Sep 21 - 27, 2026", by the week's position in `weeks`; just the
// range when it isn't one of them.
export function weekLabel(weeks: string[], monday: string): string {
  return formatWeekLabel(weeks.indexOf(monday) + 1, monday);
}

// Only the days that changed, e.g. { monday: [3, 5] }.
export function diffDays(before: DayValues, after: DayValues): Partial<Record<Day, [number, number]>> {
  const changes: Partial<Record<Day, [number, number]>> = {};
  for (const day of DAY_COLUMNS) {
    if (before[day] !== after[day]) changes[day] = [before[day], after[day]];
  }
  return changes;
}

// The filter pills on /dashboard/audit (?area=).
export const AUDIT_AREAS = {
  changes: {
    label: "Changes",
    actions: [
      "score.set", "score.update", "score.delete", "import", "participants.add",
      "week.add", "week.remove",
      "event.create", "event.update", "event.delete",
      "team.add", "team.role", "team.password", "team.remove",
    ],
  },
  scores: { label: "Scores", actions: ["score.set", "score.update", "score.delete", "import", "participants.add"] },
  weeks: { label: "Weeks", actions: ["week.add", "week.remove"] },
  events: { label: "Events", actions: ["event.create", "event.update", "event.delete"] },
  team: { label: "Team", actions: ["team.add", "team.role", "team.password", "team.remove"] },
  exports: { label: "Exports", actions: ["export.week", "export.leaderboard"] },
} satisfies Record<string, { label: string; actions: AuditAction[] }>;

export type AuditArea = keyof typeof AUDIT_AREAS;

export function isAuditArea(value: unknown): value is AuditArea {
  return typeof value === "string" && Object.hasOwn(AUDIT_AREAS, value);
}

export const AUDIT_PAGE_SIZE = 100;

export interface AuditFilters {
  actor?: string;
  eventId?: string;
  area?: AuditArea;
  before?: number; // an id: only entries older than it ("Older" paging)
}

// The newest AUDIT_PAGE_SIZE entries matching the filters, newest first.
export async function loadAuditLog(filters: AuditFilters): Promise<{ rows: AuditRow[]; hasOlder: boolean }> {
  let query = getSupabaseAdmin().from("audit_log").select("*");
  if (filters.actor) query = query.eq("actor_email", filters.actor);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);
  if (filters.area) query = query.in("action", AUDIT_AREAS[filters.area].actions);
  if (filters.before) query = query.lt("id", filters.before);

  const { data, error } = await query.order("id", { ascending: false }).limit(AUDIT_PAGE_SIZE + 1);
  if (error) throw error;
  const rows = ((data ?? []) as AuditRow[]).map((row) => ({ ...row, id: Number(row.id) }));
  return { rows: rows.slice(0, AUDIT_PAGE_SIZE), hasOlder: rows.length > AUDIT_PAGE_SIZE };
}

// ─── Sentences ───────────────────────────────────────────────────────────────
// Built when a row is read, not when it's written, so the wording can change
// without rewriting old rows. Details come back from jsonb, so every field is
// read defensively.

type Details = Record<string, unknown>;

const DESTRUCTIVE: ReadonlySet<AuditAction> = new Set(["score.delete", "week.remove", "event.delete", "team.remove"]);

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function roleLabel(value: unknown): string {
  return ROLE_LABELS[value as AppUserRole] ?? String(value ?? "?");
}

function typeLabel(value: unknown): string {
  return EVENT_TYPE_LABELS[value as EventType] ?? String(value ?? "?");
}

// "Mon 5, Sat 30", skipping zeros; "all 0" when every day is.
function formatDays(value: unknown): string {
  const days = (value ?? {}) as Partial<DayValues>;
  const parts = DAY_COLUMNS.filter((day) => num(days[day]) !== 0).map((day) => `${DAY_LABELS[day]} ${days[day]}`);
  return parts.length ? parts.join(", ") : "all 0";
}

// "Mon 3 → 5, Sat 0 → 30".
function formatChanges(value: unknown): string {
  const changes = (value ?? {}) as Partial<Record<Day, [number, number]>>;
  return DAY_COLUMNS.filter((day) => Array.isArray(changes[day]))
    .map((day) => `${DAY_LABELS[day]} ${changes[day]![0]} → ${changes[day]![1]}`)
    .join(", ");
}

// "Danny, dee-fairy, jo and 3 more".
function listNames(value: unknown, max = 5): string {
  const names = Array.isArray(value) ? value.filter((n): n is string => typeof n === "string") : [];
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

function weekOf(details: Details): string | null {
  const date = str(details.week_date);
  return str(details.week_label) ?? (date ? formatWeekRange(date) : null);
}

function weeksOf(details: Details): { date: string; label: string; scores: number }[] {
  if (!Array.isArray(details.weeks)) return [];
  return details.weeks
    .filter((w): w is Details => !!w && typeof w === "object" && typeof (w as Details).date === "string")
    .map((w) => ({ date: w.date as string, label: str(w.label) ?? formatWeekRange(w.date as string), scores: num(w.scores) }));
}

function describeEventChanges(value: unknown): string {
  const changes = (value ?? {}) as Record<string, [unknown, unknown]>;
  const parts: string[] = [];
  if (Array.isArray(changes.event_name)) {
    parts.push(`name "${changes.event_name[0]}" → "${changes.event_name[1]}"`);
  }
  if (Array.isArray(changes.event_type)) {
    parts.push(`type ${typeLabel(changes.event_type[0])} → ${typeLabel(changes.event_type[1])}`);
  }
  if (Array.isArray(changes.description)) {
    const [from, to] = changes.description;
    parts.push(!from ? "added a description" : !to ? "removed the description" : "changed the description");
  }
  return parts.join(", ");
}

function sentence(row: AuditRow): string {
  const d = row.details ?? {};
  const event = row.event_name ?? "an event";
  const target = row.target ?? "someone";
  const week = weekOf(d);
  // "in Game Night (Week 2 · Sep 21 - 27, 2026)"
  const inEvent = week ? `in ${event} (${week})` : `in ${event}`;
  // "Game Night, Week 2 · Sep 21 - 27, 2026"
  const eventWeek = week ? `${event}, ${week}` : event;

  switch (row.action) {
    case "score.set":
      return `set ${target}'s score ${inEvent}: ${formatDays(d.days)}`;
    case "score.update":
      return `changed ${target}'s score ${inEvent}: ${formatChanges(d.changes)}`;
    case "score.delete":
      return `removed ${target}'s score ${inEvent}: was ${plural(num(d.total), "point")}`;
    case "week.add": {
      const weeks = weeksOf(d);
      if (weeks.length === 1) return `added ${weeks[0].label} to ${event}`;
      const span = weeks.length ? ` (${formatWeeksSpan(weeks[0].date, weeks.at(-1)!.date)})` : "";
      return `added ${plural(weeks.length, "week")} to ${event}${span}`;
    }
    case "week.remove": {
      const weeks = weeksOf(d);
      const scores = weeks.reduce((sum, w) => sum + w.scores, 0);
      if (weeks.length === 1) return `removed ${weeks[0].label} from ${event} (${plural(scores, "score")} deleted)`;
      const labels = weeks.map((w) => w.label).join("; ");
      return `removed ${plural(weeks.length, "week")} from ${event} (${labels}): ${plural(scores, "score")} deleted`;
    }
    case "import":
      return (
        `imported ${target} into ${eventWeek}: ${plural(num(d.saved), "row")}, ` +
        `${plural(num(d.created_users), "new player")}, ${num(d.failed)} failed`
      );
    case "participants.add": {
      const skipped = num(d.skipped);
      const names = listNames(d.names);
      return (
        `added ${plural(num(d.added), "player")} to ${eventWeek} at 0 points` +
        (names ? `: ${names}` : "") +
        (skipped ? ` (${skipped} already there)` : "")
      );
    }
    case "event.create":
      return `created event ${event} (${typeLabel(d.event_type)})`;
    case "event.update":
      return `edited ${event}: ${describeEventChanges(d.changes)}`;
    case "event.delete":
      return `deleted event ${event} (${plural(num(d.weeks), "week")}, ${plural(num(d.scores), "score")})`;
    case "team.add":
      return `added ${target} to the team as ${roleLabel(d.role)}`;
    case "team.role":
      return `changed ${target}'s role: ${roleLabel(d.from)} → ${roleLabel(d.to)}`;
    case "team.password":
      return `reset ${target}'s password`;
    case "team.remove":
      return `removed ${target} (${roleLabel(d.role)}) from the team`;
    case "export.week":
      return row.target === "all" ? `exported all weeks of ${event} as CSV` : `exported ${eventWeek} as CSV`;
    case "export.leaderboard":
      return `exported the ${event} leaderboard as CSV`;
    default:
      // An action from a newer version of the app.
      return `${row.action as string}${row.target ? ` (${row.target})` : ""}`;
  }
}

// The line shown on /dashboard/audit, e.g. "changed person1's score in Game
// Night (Week 2 · Sep 21 - 27, 2026): Mon 3 → 5". `danger` marks removals.
export function describeAudit(row: AuditRow): { text: string; danger: boolean } {
  return { text: sentence(row), danger: DESTRUCTIVE.has(row.action) };
}
