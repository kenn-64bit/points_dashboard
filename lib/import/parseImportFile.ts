import Papa from "papaparse";
import * as XLSX from "xlsx";
import { DAY_COLUMNS } from "@/types";
import type { DayValues, ImportFormat, ParsedImportResult, ParsedImportRow } from "@/types";
import { hasAllowedExtension, MAX_IMPORT_ROWS, parseUsername } from "@/lib/validation";

const DAY_HEADER_BY_COLUMN: Record<(typeof DAY_COLUMNS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
const USERNAME_HEADER = "Discord Username";
const TOTAL_HEADER = "Total Points";

type RawRow = Record<string, unknown>;

function parseNumericCell(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (Number.isNaN(num)) return null;
  return Math.trunc(num);
}

async function rowsFromFile(buffer: ArrayBuffer, filename: string): Promise<RawRow[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const result = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: true });
    return result.data;
  }
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
}

export async function parseImportFile(
  buffer: ArrayBuffer,
  filename: string
): Promise<ParsedImportResult> {
  if (!hasAllowedExtension(filename)) {
    return {
      format: null,
      validRows: [],
      invalidRows: [],
      totalRows: 0,
      fileLevelError: "Unsupported file type. Allowed: .csv, .xlsx, .xls",
    };
  }

  let rawRows: RawRow[];
  try {
    rawRows = await rowsFromFile(buffer, filename);
  } catch {
    return {
      format: null,
      validRows: [],
      invalidRows: [],
      totalRows: 0,
      fileLevelError: "Could not parse file. Make sure it's a valid CSV/Excel file.",
    };
  }

  if (rawRows.length === 0) {
    return { format: null, validRows: [], invalidRows: [], totalRows: 0, fileLevelError: "File has no rows." };
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return {
      format: null,
      validRows: [],
      invalidRows: [],
      totalRows: rawRows.length,
      fileLevelError: `File has too many rows (${rawRows.length}). Max ${MAX_IMPORT_ROWS} per import.`,
    };
  }

  const headers = Object.keys(rawRows[0]);
  const hasAnyDayHeader = DAY_COLUMNS.some((day) => headers.includes(DAY_HEADER_BY_COLUMN[day]));
  const hasTotalHeader = headers.includes(TOTAL_HEADER);
  const hasUsernameHeader = headers.includes(USERNAME_HEADER);

  if (!hasUsernameHeader || (!hasAnyDayHeader && !hasTotalHeader)) {
    return {
      format: null,
      validRows: [],
      invalidRows: [],
      totalRows: rawRows.length,
      fileLevelError: `Missing required columns. Need "${USERNAME_HEADER}" plus either the Mon–Sun columns or "${TOTAL_HEADER}".`,
    };
  }

  const validRows: ParsedImportRow[] = [];
  const invalidRows: { row: number; message: string }[] = [];
  const seenUsernames = new Set<string>();
  const formatsSeen = new Set<ImportFormat>();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const rawUsername = String(raw[USERNAME_HEADER] ?? "");
    if (!rawUsername.trim()) {
      invalidRows.push({ row: rowNumber, message: "Missing Discord Username" });
      return;
    }
    const parsedUsername = parseUsername(rawUsername);
    if ("error" in parsedUsername) {
      invalidRows.push({ row: rowNumber, message: parsedUsername.error });
      return;
    }
    const username = parsedUsername.name;
    const usernameKey = username.toLowerCase();
    if (seenUsernames.has(usernameKey)) {
      invalidRows.push({ row: rowNumber, message: `Duplicate username "${username}" in file` });
      return;
    }

    const rowHasWeeklyData = DAY_COLUMNS.some((day) => raw[DAY_HEADER_BY_COLUMN[day]] !== undefined && raw[DAY_HEADER_BY_COLUMN[day]] !== "");

    if (rowHasWeeklyData) {
      const days = {} as DayValues;
      let total = 0;
      let hadError = false;
      for (const day of DAY_COLUMNS) {
        const parsed = parseNumericCell(raw[DAY_HEADER_BY_COLUMN[day]]);
        if (parsed === null) {
          invalidRows.push({ row: rowNumber, message: `Invalid number in ${DAY_HEADER_BY_COLUMN[day]} for "${username}"` });
          hadError = true;
          break;
        }
        days[day] = parsed;
        total += parsed;
      }
      if (hadError) return;

      seenUsernames.add(usernameKey);
      formatsSeen.add("weekly");
      validRows.push({ rowNumber, discord_username: username, format: "weekly", total_points: total, ...days });
      return;
    }

    if (hasTotalHeader) {
      const parsedTotal = parseNumericCell(raw[TOTAL_HEADER]);
      if (parsedTotal === null) {
        invalidRows.push({ row: rowNumber, message: `Invalid number in ${TOTAL_HEADER} for "${username}"` });
        return;
      }
      // No daily breakdown exists for total-only rows; the value is placed on
      // Sunday so the stored total still reflects it. Surfaced in the import
      // preview as "Total-only" rather than implying real Sunday activity.
      const days: DayValues = {
        monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: parsedTotal,
      };
      seenUsernames.add(usernameKey);
      formatsSeen.add("total");
      validRows.push({ rowNumber, discord_username: username, format: "total", total_points: parsedTotal, ...days });
      return;
    }

    invalidRows.push({ row: rowNumber, message: `No point data found for "${username}"` });
  });

  const format: ImportFormat | "mixed" | null =
    formatsSeen.size === 0 ? null : formatsSeen.size > 1 ? "mixed" : [...formatsSeen][0];

  return { format, validRows, invalidRows, totalRows: rawRows.length };
}
