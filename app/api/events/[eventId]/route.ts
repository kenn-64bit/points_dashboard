import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser, requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { isValidUUID, parseEventInput, type EventInput } from "@/lib/validation";
import { loadEventWeeks } from "@/lib/eventData";
import { logAudit } from "@/lib/audit";

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
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const parsed = parseEventInput(await request.json());
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // The event as it was, so the audit log can list only what changed.
    const { data: before, error: readError } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (readError) return errorResponse(readError);
    if (!before) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("events")
      .update(parsed.data)
      .eq("event_id", eventId)
      .select("*")
      .maybeSingle();

    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const fields: (keyof EventInput)[] = ["event_name", "event_type", "description"];
    const changes = Object.fromEntries(
      fields
        .filter((field) => (before[field] ?? null) !== (data[field] ?? null))
        .map((field) => [field, [before[field], data[field]]])
    );
    if (Object.keys(changes).length > 0) {
      await logAudit(user, {
        action: "event.update",
        event_id: eventId,
        event_name: data.event_name,
        details: { changes },
      });
    }
    return NextResponse.json({ event: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // Counted first: the delete cascades to the event's weeks and scores.
    const [weeks, points] = await Promise.all([
      loadEventWeeks(eventId),
      supabase.from("points").select("point_id").eq("event_id", eventId),
    ]);
    if (points.error) return errorResponse(points.error);

    const { data, error } = await supabase
      .from("events")
      .delete()
      .eq("event_id", eventId)
      .select("event_id, event_name");

    if (error) return errorResponse(error);
    if (!data || data.length === 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await logAudit(user, {
      action: "event.delete",
      event_id: eventId,
      event_name: data[0].event_name,
      details: { weeks: weeks.length, scores: points.data?.length ?? 0 },
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
