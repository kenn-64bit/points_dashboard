import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser, requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { loadEventWeeks } from "@/lib/eventData";
import { isCalendarDate, isValidUUID, isValidDateStr } from "@/lib/validation";
import { daysBetween, findOverlap, formatWeekRange, MAX_WEEK_DAYS, sortWeeks } from "@/lib/week";
import { logAudit, weekLabel } from "@/lib/audit";
import type { EventWeek } from "@/types";

type Params = { params: Promise<{ eventId: string }> };

// Two years of weekly events in one "Add Week" range is plenty.
const MAX_WEEKS_PER_REQUEST = 104;

// A week as sent by "Add Week": real calendar dates, 1–7 days long.
function parseWeek(value: unknown): EventWeek | null {
  const { week_date, end_date } = (value ?? {}) as Record<string, unknown>;
  if (typeof week_date !== "string" || typeof end_date !== "string") return null;
  if (!isCalendarDate(week_date) || !isCalendarDate(end_date)) return null;
  const span = daysBetween(week_date, end_date);
  return span >= 0 && span < MAX_WEEK_DAYS ? { week_date, end_date } : null;
}

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

// Saves weeks added through "Add Week" with the dates that were picked, so
// they survive a reload before they have any points. A day can only belong to
// one week of an event, so a week that overlaps another is refused.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const body = await request.json();
    const weeks: unknown = body?.weeks;
    if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MAX_WEEKS_PER_REQUEST) {
      return NextResponse.json({ error: `weeks must be a list of 1–${MAX_WEEKS_PER_REQUEST} weeks` }, { status: 400 });
    }
    const parsed = weeks.map(parseWeek);
    if (parsed.some((week) => week === null)) {
      return NextResponse.json(
        { error: `Every week needs a week_date and end_date (YYYY-MM-DD), 1–${MAX_WEEK_DAYS} days long` },
        { status: 400 }
      );
    }
    const added = sortWeeks(parsed as EventWeek[]);
    if (added.some((week, i) => i > 0 && week.week_date <= added[i - 1].end_date)) {
      return NextResponse.json({ error: "Weeks can't overlap each other" }, { status: 400 });
    }

    const before = await loadEventWeeks(eventId);
    for (const week of added) {
      const clash = findOverlap(before, week.week_date, week.end_date);
      if (clash) {
        return NextResponse.json(
          { error: `${formatWeekRange(week)} overlaps ${weekLabel(before, clash.week_date)}` },
          { status: 409 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("event_weeks").insert(added.map((week) => ({ event_id: eventId, ...week })));
    if (error) return errorResponse(error);

    const after = await loadEventWeeks(eventId);
    await logAudit(user, {
      action: "week.add",
      event_id: eventId,
      target: added[0].week_date,
      details: {
        weeks: added.map((week) => ({
          date: week.week_date,
          end: week.end_date,
          label: weekLabel(after, week.week_date),
        })),
      },
    });
    return NextResponse.json({ weeks: after }, { status: 201 });
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
    // Labels ("Week 2 · …") must be worked out before the weeks disappear.
    const before = await loadEventWeeks(eventId);
    const [points, planned] = await Promise.all([
      supabase.from("points").delete().eq("event_id", eventId).in("week_date", weeks).select("week_date"),
      supabase.from("event_weeks").delete().eq("event_id", eventId).in("week_date", weeks).select("week_date"),
    ]);
    if (points.error) return errorResponse(points.error);
    if (planned.error) return errorResponse(planned.error);

    // Only the weeks the event actually had, with the scores each one lost.
    const deletedPoints = (points.data ?? []).map((row) => row.week_date as string);
    const removed = [...new Set([...deletedPoints, ...(planned.data ?? []).map((row) => row.week_date as string)])].sort();
    if (removed.length > 0) {
      await logAudit(user, {
        action: "week.remove",
        event_id: eventId,
        target: removed[0],
        details: {
          weeks: removed.map((date) => ({
            date,
            end: before.find((week) => week.week_date === date)?.end_date,
            label: weekLabel(before, date),
            scores: deletedPoints.filter((week) => week === date).length,
          })),
        },
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
