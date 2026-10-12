import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { requireBotClient } from "@/lib/auth/botToken";
import { loadBotUserStats, parseStandingsQuery } from "@/lib/botData";

// One player's points, place and breakdown: ?player=<name>, plus the same
// event_id / timeframe / date as the leaderboard.
export async function GET(request: NextRequest) {
  try {
    const denied = requireBotClient(request);
    if (denied) return denied;
    const player = request.nextUrl.searchParams.get("player")?.trim();
    if (!player) return NextResponse.json({ error: "player is required" }, { status: 400 });
    const parsed = parseStandingsQuery(request.nextUrl.searchParams);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const stats = await loadBotUserStats(parsed.query, player);
    if ("notFound" in stats) return NextResponse.json({ error: stats.notFound }, { status: 404 });
    return NextResponse.json(stats);
  } catch (err) {
    return errorResponse(err);
  }
}
