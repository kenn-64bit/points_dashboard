import { parseUsername } from "@/lib/validation";

// The most text one paste can make the browser work through (a whole sheet
// copied by accident); the form refuses a bigger paste instead.
export const MAX_PASTE_CHARS = 100_000;

// The label above the names, copied along when the range includes it. Same
// header the import file uses.
const HEADER_RE = /^(?:discord\s*)?user\s*name$/i;

export interface PastedNames {
  // Cleaned names in paste order, new to the form and within the room left.
  names: string[];
  // Names already in the form or repeated in the paste (any letter case).
  duplicates: number;
  // parseUsername's message for each cell that isn't a valid name.
  rejected: string[];
  // Valid new names that didn't fit in the room left.
  overLimit: number;
}

// Spreadsheets quote a cell holding a quote, tab or line break, doubling any
// quotes inside.
function unquote(cell: string): string {
  const quoted = /^"([\s\S]*)"$/.exec(cell.trim());
  return quoted ? quoted[1].replace(/""/g, '"') : cell;
}

function isHeader(cell: string): boolean {
  return HEADER_RE.test(cell.trim());
}

// One cell per row: from the header's column once a header row is seen, else
// the row's first non-empty cell.
function columnCells(rows: string[][]): string[] {
  let column: number | null = null;
  const cells: string[] = [];
  for (const row of rows) {
    const headerAt = row.findIndex(isHeader);
    if (headerAt !== -1) {
      column = headerAt;
      continue;
    }
    cells.push(column === null ? (row.find((cell) => cell.trim()) ?? "") : (row[column] ?? ""));
  }
  return cells;
}

// Turns text copied from Excel or Google Sheets into names. Rows end in \r\n,
// \r or \n, and the cells in a row are tab-separated. A row copied from
// several columns gives its "Discord Username" column when the paste includes
// that header, else its first non-empty cell; a single copied row gives every
// cell. Each name goes through parseUsername, the same check the API runs.
// `existingKeys` are the lowercased names already in the form, and at most
// `room` names are returned.
export function parsePastedNames(text: string, existingKeys: Set<string>, room: number): PastedNames {
  const rows = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.split("\t").map(unquote))
    .filter((cells) => cells.some((cell) => cell.trim()));
  const candidates = rows.length === 1 ? rows[0] : columnCells(rows);

  // Dedupe case-insensitively, first spelling wins (as the API does).
  const seen = new Set(existingKeys);
  const result: PastedNames = { names: [], duplicates: 0, rejected: [], overLimit: 0 };
  for (const raw of candidates) {
    if (!raw.trim() || isHeader(raw)) continue;
    const parsed = parseUsername(raw);
    if ("error" in parsed) {
      result.rejected.push(parsed.error);
      continue;
    }
    const key = parsed.name.toLowerCase();
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    if (result.names.length < room) result.names.push(parsed.name);
    else result.overLimit++;
  }
  return result;
}
