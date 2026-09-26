import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { isValidUUID, MAX_EVENT_NAME_LENGTH } from "@/lib/validation";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").eq("event_id", eventId).maybeSingle();

    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ event: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const body = await request.json();
    const event_name = typeof body.event_name === "string" ? body.event_name.trim() : "";
    if (!event_name) {
      return NextResponse.json({ error: "event_name is required" }, { status: 400 });
    }
    if (event_name.length > MAX_EVENT_NAME_LENGTH) {
      return NextResponse.json({ error: `event_name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("events")
      .update({ event_name })
      .eq("event_id", eventId)
      .select("*")
      .maybeSingle();

    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ event: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").delete().eq("event_id", eventId).select("event_id");

    if (error) return errorResponse(error);
    if (!data || data.length === 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
