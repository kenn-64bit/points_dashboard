import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { isValidUUID } from "@/lib/validation";
import type { EventSummary } from "@/types";

type Params = { params: Promise<{ eventId: string }> };

// Weeks and participant count for an event's pass on the events list.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("points").select("discord_id, week_date").eq("event_id", eventId);
    if (error) return errorResponse(error);

    const rows = (data ?? []) as { discord_id: string; week_date: string }[];
    const summary: EventSummary = {
      weeks: [...new Set(rows.map((r) => r.week_date))].sort(),
      participant_count: new Set(rows.map((r) => r.discord_id)).size,
    };
    return NextResponse.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}
