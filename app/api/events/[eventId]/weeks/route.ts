import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser, requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { loadEventWeeks } from "@/lib/eventData";
import { isValidUUID, isValidDateStr } from "@/lib/validation";
import { isMonday } from "@/lib/week";

type Params = { params: Promise<{ eventId: string }> };

// Two years of weekly events in one "Add Week" range is plenty.
const MAX_WEEKS_PER_REQUEST = 104;

// The event's weeks (with points or added via "Add Week"), oldest first.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    return NextResponse.json({ weeks: await loadEventWeeks(eventId) });
  } catch (err) {
    return errorResponse(err);
  }
}

// Saves weeks added through "Add Week", so they survive a reload before they
// have any points. Weeks already saved are left as they are.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const body = await request.json();
    const weeks: unknown = body?.weeks;
    if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MAX_WEEKS_PER_REQUEST) {
      return NextResponse.json(
        { error: `weeks must be a list of 1–${MAX_WEEKS_PER_REQUEST} Mondays` },
        { status: 400 }
      );
    }
    if (!weeks.every((w) => typeof w === "string" && isValidDateStr(w) && isMonday(w))) {
      return NextResponse.json({ error: "Every week must be a Monday (YYYY-MM-DD)" }, { status: 400 });
    }

    const rows = [...new Set(weeks as string[])].map((week_date) => ({ event_id: eventId, week_date }));
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("event_weeks")
      .upsert(rows, { onConflict: "event_id,week_date", ignoreDuplicates: true });
    if (error) return errorResponse(error);

    return NextResponse.json({ weeks: await loadEventWeeks(eventId) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// Removes one or more weeks (`?week=A&week=B`) from the event: the saved
// weeks and all of their points. Succeeds for weeks that never had points, too.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    const weeks = [...new Set(request.nextUrl.searchParams.getAll("week"))];
    if (weeks.length === 0 || weeks.length > MAX_WEEKS_PER_REQUEST || !weeks.every(isValidDateStr)) {
      return NextResponse.json({ error: "Invalid week" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [points, planned] = await Promise.all([
      supabase.from("points").delete().eq("event_id", eventId).in("week_date", weeks),
      supabase.from("event_weeks").delete().eq("event_id", eventId).in("week_date", weeks),
    ]);
    if (points.error) return errorResponse(points.error);
    if (planned.error) return errorResponse(planned.error);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
