import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveDiscordId, resolveDiscordIdsBatch } from "@/lib/users";
import { errorResponse } from "@/lib/apiError";
import { requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { isValidUUID, isValidDateStr, parseUsername } from "@/lib/validation";
import { isMonday } from "@/lib/week";
import { DAY_COLUMNS } from "@/types";

type Params = { params: Promise<{ eventId: string }> };

const MAX_PARTICIPANTS_PER_REQUEST = 100;

// Adds participants to one week of an event by name, starting them at 0 points.
// A participant is anyone with a points row in the event, so this resolves (or
// creates) each user and inserts a zero row for the week — never overwriting
// a row that already exists, so existing scores are preserved.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const body = await request.json();
    const { week_date, usernames } = body ?? {};
    if (typeof week_date !== "string" || !isValidDateStr(week_date) || !isMonday(week_date)) {
      return NextResponse.json({ error: "week_date must be a Monday (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!Array.isArray(usernames) || usernames.some((u) => typeof u !== "string")) {
      return NextResponse.json({ error: "usernames must be a list of names" }, { status: 400 });
    }

    // Clean each name (lib/text.ts), drop blanks, and dedupe
    // case-insensitively (first spelling wins).
    const byKey = new Map<string, string>();
    for (const raw of usernames as string[]) {
      if (!raw.trim()) continue;
      const parsed = parseUsername(raw);
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const key = parsed.name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, parsed.name);
    }
    const names = [...byKey.values()];

    if (names.length === 0) {
      return NextResponse.json({ error: "Enter at least one name" }, { status: 400 });
    }
    if (names.length > MAX_PARTICIPANTS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many names. Max ${MAX_PARTICIPANTS_PER_REQUEST} at a time.` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const batch = await resolveDiscordIdsBatch(supabase, names);
    let createdUsers = batch.createdCount;
    for (const username of batch.unresolved) {
      const resolved = await resolveDiscordId(supabase, username);
      batch.idsByUsername.set(username, resolved.discord_id);
      if (resolved.created) createdUsers++;
    }

    const zeroDays = Object.fromEntries(DAY_COLUMNS.map((day) => [day, 0]));
    const discordIds = [...new Set(names.map((n) => batch.idsByUsername.get(n)!))];
    const payloads = discordIds.map((discord_id) => ({ event_id: eventId, discord_id, week_date, ...zeroDays }));

    const { data, error } = await supabase
      .from("points")
      .upsert(payloads, { onConflict: "event_id,discord_id,week_date", ignoreDuplicates: true })
      .select("point_id");
    if (error) return errorResponse(error);

    const added = data?.length ?? 0;
    return NextResponse.json(
      { added, created_users: createdUsers, skipped: discordIds.length - added },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
