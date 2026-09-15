import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse } from "@/lib/apiError";
import { isValidUUID } from "@/lib/validation";

type Params = { params: Promise<{ eventId: string }> };

// Distinct weeks that have at least one points row for this event, newest first.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("points")
      .select("week_date")
      .eq("event_id", eventId)
      .order("week_date", { ascending: false });

    if (error) return errorResponse(error);

    const weeks = [...new Set((data ?? []).map((row) => row.week_date as string))];
    return NextResponse.json({ weeks });
  } catch (err) {
    return errorResponse(err);
  }
}
