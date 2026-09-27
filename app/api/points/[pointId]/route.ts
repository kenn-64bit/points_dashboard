import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse } from "@/lib/apiError";
import { requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { isValidUUID, isValidDayValue } from "@/lib/validation";
import { diffDays, logAudit } from "@/lib/audit";
import { DAY_COLUMNS } from "@/types";

type Params = { params: Promise<{ pointId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { pointId } = await params;
    if (!isValidUUID(pointId)) return NextResponse.json({ error: "Invalid point id" }, { status: 400 });

    const body = await request.json();

    const payload: Record<string, number> = {};
    for (const day of DAY_COLUMNS) {
      const value = body[day];
      if (value !== undefined) {
        payload[day] = isValidDayValue(value) ? Math.trunc(value) : 0;
      }
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // The row as it was, for the before → after in the audit log.
    const { data: before, error: readError } = await supabase
      .from("points")
      .select("*, users(discord_username)")
      .eq("point_id", pointId)
      .maybeSingle();
    if (readError) return errorResponse(readError);
    if (!before) return NextResponse.json({ error: "Points row not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("points")
      .update(payload)
      .eq("point_id", pointId)
      .select("*")
      .maybeSingle();

    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: "Points row not found" }, { status: 404 });

    // Saving without changing anything writes no entry.
    const changes = diffDays(before, data);
    if (Object.keys(changes).length > 0) {
      await logAudit(user, {
        action: "score.update",
        event_id: data.event_id,
        target: before.users?.discord_username ?? data.discord_id,
        week: data.week_date,
        details: { changes },
      });
    }
    return NextResponse.json({ point: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { pointId } = await params;
    if (!isValidUUID(pointId)) return NextResponse.json({ error: "Invalid point id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .delete()
      .eq("point_id", pointId)
      .select("*, users(discord_username)");

    if (error) return errorResponse(error);
    if (!data || data.length === 0) return NextResponse.json({ error: "Points row not found" }, { status: 404 });

    const [removed] = data;
    await logAudit(user, {
      action: "score.delete",
      event_id: removed.event_id,
      target: removed.users?.discord_username ?? removed.discord_id,
      week: removed.week_date,
      details: { total: removed.total_points },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
