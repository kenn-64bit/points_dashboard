import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser, requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { isValidUUID, isValidDateStr, isValidDayValue } from "@/lib/validation";
import { isMonday } from "@/lib/week";
import { loadWeekPoints } from "@/lib/weekPoints";
import { logAudit } from "@/lib/audit";
import { DAY_COLUMNS } from "@/types";

export async function GET(request: NextRequest) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const eventId = request.nextUrl.searchParams.get("event_id");
    const weekDate = request.nextUrl.searchParams.get("week_date");
    if (!eventId || !weekDate) {
      return NextResponse.json({ error: "event_id and week_date are required" }, { status: 400 });
    }
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
    if (!isValidDateStr(weekDate)) return NextResponse.json({ error: "Invalid week_date" }, { status: 400 });

    const points = await loadWeekPoints(eventId, weekDate);
    return NextResponse.json({ points });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const body = await request.json();
    const { event_id, discord_id, week_date } = body;
    if (!event_id || !discord_id || !week_date) {
      return NextResponse.json({ error: "event_id, discord_id, and week_date are required" }, { status: 400 });
    }
    if (!isValidUUID(event_id)) return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
    if (typeof discord_id !== "string" || !discord_id) {
      return NextResponse.json({ error: "Invalid discord_id" }, { status: 400 });
    }
    if (!isValidDateStr(week_date) || !isMonday(week_date)) {
      return NextResponse.json({ error: "week_date must be a Monday (YYYY-MM-DD)" }, { status: 400 });
    }

    const payload: Record<string, string | number> = { event_id, discord_id, week_date };
    for (const day of DAY_COLUMNS) {
      const value = body[day];
      payload[day] = isValidDayValue(value) ? Math.trunc(value) : 0;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .upsert(payload, { onConflict: "event_id,discord_id,week_date" })
      .select("*")
      .single();

    if (error) return errorResponse(error);

    await logAudit(user, {
      action: "score.set",
      event_id,
      player: discord_id,
      week: week_date,
      details: { days: Object.fromEntries(DAY_COLUMNS.map((day) => [day, data[day]])) },
    });
    return NextResponse.json({ point: data }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
