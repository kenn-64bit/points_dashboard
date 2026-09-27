import { EVENT_TYPES } from "@/types";
import type { EventType } from "@/types";
import { cleanText, textProblem } from "@/lib/text";

export const MAX_IMPORT_FILE_SIZE = Number(process.env.NEXT_PUBLIC_MAX_IMPORT_SIZE) || 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMPORT_EXTENSIONS = process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES
  ? process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES.split(",").map((ext) => ext.trim().toLowerCase())
  : [".csv", ".xlsx", ".xls"];

export const MAX_IMPORT_ROWS = 2000;
export const MAX_EVENT_NAME_LENGTH = 60;
export const MAX_EVENT_DESCRIPTION_LENGTH = 500;
export const MAX_USERNAME_LENGTH = 32; // Discord's own limit
export const MAX_DAY_VALUE = 1_000_000;
export const MAX_EMAIL_LENGTH = 254;
// Bounds the scrypt work a single login request can trigger.
export const MAX_PASSWORD_LENGTH = 1024;

export function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isWithinMaxSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_IMPORT_FILE_SIZE;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export function isValidDayValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_DAY_VALUE;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export interface EventInput {
  event_name: string;
  event_type: EventType;
  description: string | null;
}

// Shared by create and update, so both accept exactly the same shape. Text
// is checked for blocked symbols as sent, then cleaned (lib/text.ts) before
// the length checks, so limits apply to what's actually stored.
export function parseEventInput(body: unknown): { data: EventInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const rawName = typeof b.event_name === "string" ? b.event_name : "";
  const nameProblem = textProblem(rawName, "event_name");
  if (nameProblem) return { error: nameProblem };
  const event_name = cleanText(rawName);
  if (!event_name) return { error: "event_name is required" };
  if (event_name.length > MAX_EVENT_NAME_LENGTH) {
    return { error: `event_name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer` };
  }

  const event_type = b.event_type ?? "other";
  if (!EVENT_TYPES.includes(event_type as EventType)) return { error: "Invalid event_type" };

  if (b.description != null && typeof b.description !== "string") return { error: "description must be text" };
  const rawDescription = (b.description as string | null | undefined) ?? "";
  const descriptionProblem = textProblem(rawDescription, "description");
  if (descriptionProblem) return { error: descriptionProblem };
  const description = cleanText(rawDescription, { multiline: true }) || null;
  if (description && description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
    return { error: `description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or fewer` };
  }

  return { data: { event_name, event_type: event_type as EventType, description } };
}

// One participant name, from the Add participants form or an import file.
export function parseUsername(raw: string): { name: string } | { error: string } {
  const shown = raw.trim().slice(0, 20);
  const problem = textProblem(raw, `"${shown}"`);
  if (problem) return { error: problem };
  const name = cleanText(raw);
  if (!name) return { error: "Username is empty" };
  if (name.length > MAX_USERNAME_LENGTH) {
    return { error: `"${name.slice(0, 20)}…" is too long. Max ${MAX_USERNAME_LENGTH} characters.` };
  }
  return { name };
}
