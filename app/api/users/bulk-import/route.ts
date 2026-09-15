import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveDiscordId, resolveDiscordIdsBatch } from "@/lib/users";
import { parseImportFile } from "@/lib/import/parseImportFile";
import { errorResponse } from "@/lib/apiError";
import { isWithinMaxSize, hasAllowedExtension, isValidUUID, MAX_IMPORT_FILE_SIZE } from "@/lib/validation";
import { normalizeToMonday, getCurrentWeekMonday } from "@/lib/week";
import type { BulkImportResult, ImportRowError, ParsedImportRow } from "@/types";
import { DAY_COLUMNS } from "@/types";

// Rows are written in fixed-size chunks rather than one giant upsert, keeping
// each round trip's payload and response reasonably sized.
const WRITE_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// The client's own preview/validation is never trusted — this route re-parses
// the raw uploaded bytes independently and re-checks size/type/columns itself.
export async function POST(request: NextRequest) {
  try {
    // Reject clearly-oversized requests before buffering the body into memory
    // — formData() must read the whole multipart payload up front, so waiting
    // until after that to check file.size doesn't actually bound memory use.
    // The +10KB accounts for multipart boundaries/field overhead around the file.
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMPORT_FILE_SIZE + 10_000) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("event_id");
    const weekParam = formData.get("week_date");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (typeof eventId !== "string" || !eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ error: "A valid event_id is required" }, { status: 400 });
    }
    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: .csv, .xlsx, .xls" }, { status: 400 });
    }
    if (!isWithinMaxSize(file.size)) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }

    const weekDate = typeof weekParam === "string" && weekParam ? normalizeToMonday(weekParam) : getCurrentWeekMonday();

    const buffer = await file.arrayBuffer();
    const parsed = await parseImportFile(buffer, file.name);

    if (parsed.fileLevelError) {
      return NextResponse.json({ error: parsed.fileLevelError }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const errors: ImportRowError[] = [...parsed.invalidRows];
    let createdUsers = 0;
    let updatedUsers = 0;

    // Resolve every username in one batch (one lookup + one upsert) instead of
    // per-row round trips — a multi-hundred-row file would otherwise risk
    // exceeding a serverless function's execution time limit.
    const usernames = parsed.validRows.map((row) => row.discord_username);
    const batch = await resolveDiscordIdsBatch(supabase, usernames);
    createdUsers += batch.createdCount;

    // Rare fallback: a username the batch upsert still couldn't resolve
    // (e.g. a PK-slug collision) is retried individually.
    const rowsByUsername = new Map<string, ParsedImportRow[]>();
    for (const row of parsed.validRows) {
      const list = rowsByUsername.get(row.discord_username) ?? [];
      list.push(row);
      rowsByUsername.set(row.discord_username, list);
    }
    for (const username of batch.unresolved) {
      try {
        const resolved = await resolveDiscordId(supabase, username);
        batch.idsByUsername.set(username, resolved.discord_id);
        if (resolved.created) createdUsers++;
      } catch (err) {
        for (const row of rowsByUsername.get(username) ?? []) {
          errors.push({ row: row.rowNumber, message: `${username}: ${(err as Error).message}` });
        }
      }
    }

    const pointsPayloads = parsed.validRows
      .filter((row) => batch.idsByUsername.has(row.discord_username))
      .map((row) => {
        const payload: Record<string, string | number> = {
          event_id: eventId,
          discord_id: batch.idsByUsername.get(row.discord_username)!,
          week_date: weekDate,
        };
        for (const day of DAY_COLUMNS) payload[day] = row[day];
        return payload;
      });

    for (const [chunkIndex, payloadChunk] of chunk(pointsPayloads, WRITE_CHUNK_SIZE).entries()) {
      const { error: upsertError } = await supabase
        .from("points")
        .upsert(payloadChunk, { onConflict: "event_id,discord_id,week_date" });

      if (upsertError) {
        const start = chunkIndex * WRITE_CHUNK_SIZE + 1;
        const end = start + payloadChunk.length - 1;
        errors.push({ row: start, message: `Rows ${start}-${end}: ${upsertError.message}` });
      } else {
        updatedUsers += payloadChunk.length;
      }
    }

    const result: BulkImportResult = {
      success: errors.length === 0,
      imported: parsed.validRows.length,
      created_users: createdUsers,
      updated_users: updatedUsers,
      failed: errors.length,
      errors,
      week_date: weekDate,
    };
    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (err) {
    return errorResponse(err);
  }
}
