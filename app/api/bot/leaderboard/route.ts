import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { requireBotClient } from "@/lib/auth/botToken";
import { loadBotLeaderboard, parseStandingsQuery } from "@/lib/botData";

// Standings for one event or all of them, over the whole event, one week or
// one day: ?event_id=<uuid>|all (default: the latest event),
// ?timeframe=event|week|day, ?date=YYYY-MM-DD.
export async function GET(request: NextRequest) {
  try {
    const denied = requireBotClient(request);
    if (denied) return denied;
    const parsed = parseStandingsQuery(request.nextUrl.searchParams);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const leaderboard = await loadBotLeaderboard(parsed.query);
    if ("notFound" in leaderboard) return NextResponse.json({ error: leaderboard.notFound }, { status: 404 });
    return NextResponse.json(leaderboard);
  } catch (err) {
    return errorResponse(err);
  }
}
