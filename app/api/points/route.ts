import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { isValidUUID, isValidDateStr, isValidDayValue } from "@/lib/validation";
import { isMonday } from "@/lib/week";
import { DAY_COLUMNS } from "@/types";
import type { PointsRowWithUser, PointsTableRow } from "@/types";

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

    const supabase = getSupabaseAdmin();

    // Every user who has ever appeared in this event, so a brand-new week can be
    // added for existing participants without re-importing.
    const { data: allPoints, error: allPointsError } = await supabase
      .from("points")
      .select("discord_id, users(discord_id, discord_username)")
      .eq("event_id", eventId);
    if (allPointsError) return errorResponse(allPointsError);

    const usersInEvent = new Map<string, string>();
    for (const row of allPoints ?? []) {
      const user = (row as unknown as { users: { discord_id: string; discord_username: string } | null }).users;
      if (user) usersInEvent.set(user.discord_id, user.discord_username);
    }

    const { data: weekRows, error: weekError } = await supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("event_id", eventId)
      .eq("week_date", weekDate);
    if (weekError) return errorResponse(weekError);

    const byUser = new Map<string, PointsRowWithUser>();
    for (const row of weekRows ?? []) {
      const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
      const withUser = { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
      byUser.set(withUser.discord_id, withUser);
    }

    const points: PointsTableRow[] = [...usersInEvent.entries()].map(([discord_id, discord_username]) => {
      const existing = byUser.get(discord_id);
      if (existing) return existing;

      const zeroDays = Object.fromEntries(DAY_COLUMNS.map((day) => [day, 0]));
      return {
        point_id: null,
        event_id: eventId,
        discord_id,
        discord_username,
        week_date: weekDate,
        total_points: 0,
        ...zeroDays,
      } as PointsTableRow;
    });

    points.sort((a, b) => a.discord_username.localeCompare(b.discord_username));
    return NextResponse.json({ points });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
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
    return NextResponse.json({ point: data }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// Bulk-remove an entire week's points for an event (used by "Remove Week").
export async function DELETE(request: NextRequest) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const eventId = request.nextUrl.searchParams.get("event_id");
    const weekDate = request.nextUrl.searchParams.get("week_date");
    if (!eventId || !weekDate) {
      return NextResponse.json({ error: "event_id and week_date are required" }, { status: 400 });
    }
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
    if (!isValidDateStr(weekDate)) return NextResponse.json({ error: "Invalid week_date" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .delete()
      .eq("event_id", eventId)
      .eq("week_date", weekDate)
      .select("point_id");

    if (error) return errorResponse(error);
    if (!data || data.length === 0) return NextResponse.json({ error: "No points found for that week" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
