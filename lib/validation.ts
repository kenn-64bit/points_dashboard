export const MAX_IMPORT_FILE_SIZE = Number(process.env.NEXT_PUBLIC_MAX_IMPORT_SIZE) || 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMPORT_EXTENSIONS = process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES
  ? process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES.split(",").map((ext) => ext.trim().toLowerCase())
  : [".csv", ".xlsx", ".xls"];

export const MAX_IMPORT_ROWS = 2000;
export const MAX_EVENT_NAME_LENGTH = 200;
export const MAX_USERNAME_LENGTH = 100;
export const MAX_DAY_VALUE = 1_000_000;

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
