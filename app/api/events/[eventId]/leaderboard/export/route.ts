import { NextRequest, NextResponse } from "next/server";
import { buildLeaderboardCsv, csvFileSlug } from "@/lib/csv";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { loadEventName, loadLeaderboard } from "@/lib/eventData";
import { isValidUUID } from "@/lib/validation";

type Params = { params: Promise<{ eventId: string }> };

// The leaderboard page as a CSV: event name, then place, name and total.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const { eventId } = await params;
    if (!isValidUUID(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

    const [eventName, rows] = await Promise.all([loadEventName(eventId), loadLeaderboard(eventId)]);
    if (eventName === null) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    return new NextResponse(buildLeaderboardCsv(eventName, rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFileSlug(eventName)}-leaderboard.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
