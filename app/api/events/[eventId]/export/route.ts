import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildEventExportCsv, csvFileSlug } from "@/lib/csv";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadEventName, loadEventWeeks } from "@/lib/eventData";
import { isValidUUID, isValidDateStr } from "@/lib/validation";
import { logAudit, weekLabel } from "@/lib/audit";
import type { PointsRowWithUser } from "@/types";

type Params = { params: Promise<{ eventId: string }> };

function mapRows(data: unknown[]): PointsRowWithUser[] {
  return data.map((row) => {
    const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
    return { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
  });
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ?week=YYYY-MM-DD exports one week, ?week=all every week (oldest first), and
// no week the latest one. Weeks added without scores export as header-only
// sections, so every week in the event's list can be exported.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const week = request.nextUrl.searchParams.get("week");
    if (week && week !== "all" && !isValidDateStr(week)) {
      return NextResponse.json({ error: "Invalid week" }, { status: 400 });
    }

    const [eventName, eventWeeks] = await Promise.all([loadEventName(eventId), loadEventWeeks(eventId)]);
    if (eventName === null) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const weeks = week === "all" ? eventWeeks : [week ?? eventWeeks.at(-1)].filter((w): w is string => !!w);
    if (weeks.length === 0) {
      return NextResponse.json({ error: "This event has no weeks yet" }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("event_id", eventId)
      .in("week_date", weeks);
    if (error) return errorResponse(error);

    const rows = mapRows(data ?? []);
    const sections = weeks.map((w) => ({
      week: w,
      rows: rows
        .filter((row) => row.week_date === w)
        .sort((a, b) => a.discord_username.localeCompare(b.discord_username)),
    }));

    const slug = csvFileSlug(eventName);
    const filename = week === "all" ? `${slug}-all-weeks.csv` : `${slug}-week-${weeks[0]}.csv`;
    const csv = buildEventExportCsv(eventName, sections);

    // The default ("latest week") is logged as the week it resolved to.
    await logAudit(user, {
      action: "export.week",
      event_id: eventId,
      event_name: eventName,
      target: week === "all" ? "all" : weeks[0],
      details: week === "all" ? {} : { week_date: weeks[0], week_label: weekLabel(eventWeeks, weeks[0]) },
    });
    return csvResponse(csv, filename);
  } catch (err) {
    return errorResponse(err);
  }
}
