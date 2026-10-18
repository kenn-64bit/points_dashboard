import { NextRequest, NextResponse } from "next/server";
import { hasBotKey } from "@/lib/auth/botKey";
import { loadBotLeaderboard } from "@/lib/botLeaderboard";
import { cleanText } from "@/lib/text";
import { isCalendarDate } from "@/lib/validation";

// Read-only standings for the Discord bot on BotGhost, which has no session:
// it sends `Authorization: Bearer <BOT_API_KEY>` (lib/auth/botKey.ts), and
// proxy.ts lets it past the session check and rate-limits it like any GET.
//   ?event=<name>      the event's totals across all of its weeks
//   &week=YYYY-MM-DD   one week (its first day) instead, with a grid of days
//   &page=N            10 rows a page, from 1
// An empty week= or page= counts as left out, in case the bot sends an
// option nobody filled in.
export async function GET(request: NextRequest) {
  try {
    if (!hasBotKey(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const eventName = cleanText(params.get("event") ?? "");
    if (!eventName) return NextResponse.json({ error: "event is required" }, { status: 400 });

    const week = params.get("week")?.trim() || null;
    if (week && !isCalendarDate(week)) {
      return NextResponse.json({ error: "week must be a date (YYYY-MM-DD)" }, { status: 400 });
    }

    const rawPage = params.get("page")?.trim() || "1";
    const page = Number(rawPage);
    if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1) {
      return NextResponse.json({ error: "page must be a whole number from 1" }, { status: 400 });
    }

    const result = await loadBotLeaderboard({ eventName, week, page });
    if ("notFound" in result) return NextResponse.json({ error: result.notFound }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    // Logged for the server only: unlike errorResponse, never passes a
    // database message on to the bot.
    console.error("[bot/leaderboard]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
