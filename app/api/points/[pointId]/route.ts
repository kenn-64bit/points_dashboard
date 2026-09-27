import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse } from "@/lib/apiError";
import { requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { isValidUUID, isValidDayValue } from "@/lib/validation";
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
    const { data, error } = await supabase
      .from("points")
      .update(payload)
      .eq("point_id", pointId)
      .select("*")
      .maybeSingle();

    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: "Points row not found" }, { status: 404 });
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
    const { data, error } = await supabase.from("points").delete().eq("point_id", pointId).select("point_id");

    if (error) return errorResponse(error);
    if (!data || data.length === 0) return NextResponse.json({ error: "Points row not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
