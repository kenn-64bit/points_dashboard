import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildPointsExportCsv, buildEventExportCsv } from "@/lib/csv";
import { errorResponse } from "@/lib/apiError";
import { isValidUUID, isValidDateStr } from "@/lib/validation";
import type { PointsRowWithUser } from "@/types";

type Params = { params: Promise<{ eventId: string }> };

function mapRows(data: unknown[]): PointsRowWithUser[] {
  return data.map((row) => {
    const { users, ...rest } = row as unknown as { users: { discord_username: string } | null } & Record<string, unknown>;
    return { ...rest, discord_username: users?.discord_username ?? "unknown" } as PointsRowWithUser;
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let week = request.nextUrl.searchParams.get("week");
    if (week && week !== "all" && !isValidDateStr(week)) {
      return NextResponse.json({ error: "Invalid week" }, { status: 400 });
    }

    if (week === "all") {
      const { data, error } = await supabase
        .from("points")
        .select("*, users(discord_username)")
        .eq("event_id", eventId)
        .order("week_date", { ascending: true });

      if (error) return errorResponse(error);
      if (!data || data.length === 0) {
        return NextResponse.json({ error: "No points exist for this event yet" }, { status: 404 });
      }

      const rows = mapRows(data);
      const sections = new Map<string, PointsRowWithUser[]>();
      for (const row of rows) {
        const existing = sections.get(row.week_date);
        if (existing) existing.push(row);
        else sections.set(row.week_date, [row]);
      }

      const csv = buildEventExportCsv(
        [...sections.entries()].map(([week, rows]) => ({ week, rows }))
      );
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export-${eventId}-all.csv"`,
        },
      });
    }

    if (!week) {
      const { data: latest, error: latestError } = await supabase
        .from("points")
        .select("week_date")
        .eq("event_id", eventId)
        .order("week_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) return errorResponse(latestError);
      if (!latest) return NextResponse.json({ error: "No points exist for this event yet" }, { status: 404 });
      week = latest.week_date;
    }

    const { data, error } = await supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("event_id", eventId)
      .eq("week_date", week);

    if (error) return errorResponse(error);
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No points exist for this week" }, { status: 404 });
    }

    const rows = mapRows(data);
    const csv = buildPointsExportCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-${week}.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
