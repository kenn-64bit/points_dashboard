import { NextRequest, NextResponse } from "next/server";
import { hasBotKey } from "@/lib/auth/botKey";
import { getSupabaseAdmin } from "@/lib/supabase";

// Event names for the Discord bot's /leaderboard event selector, newest first
// (as the dashboard lists them). Each name can be passed straight to
// /api/bot/leaderboard?event=.
//   &page=N   10 names a page, from 1
// Paging fields match /api/bot/leaderboard's, so the bot can use the same
// Prev/Next buttons for both.
const EVENTS_PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  try {
    if (!hasBotKey(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawPage = request.nextUrl.searchParams.get("page")?.trim() || "1";
    const page = Number(rawPage);
    if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1) {
      return NextResponse.json({ error: "page must be a whole number from 1" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const counted = await supabase.from("events").select("event_id", { count: "exact", head: true });
    if (counted.error) throw counted.error;
    const totalRows = counted.count ?? 0;
    const totalPages = Math.ceil(totalRows / EVENTS_PAGE_SIZE);
    const lastPage = Math.max(totalPages, 1);
    if (page > lastPage) {
      return NextResponse.json({ error: `There's no page ${page}. The last page is ${lastPage}.` }, { status: 404 });
    }

    const start = (page - 1) * EVENTS_PAGE_SIZE;
    const { data, error } = await supabase
      .from("events")
      .select("event_name")
      .order("created_at", { ascending: false })
      .order("event_id") // a stable order, so no event lands on two pages
      .range(start, start + EVENTS_PAGE_SIZE - 1);
    if (error) throw error;

    const events = ((data ?? []) as { event_name: string }[]).map((event) => event.event_name);
    return NextResponse.json({
      events,
      page,
      pageSize: EVENTS_PAGE_SIZE,
      totalRows,
      totalPages,
      showing: events.length,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < totalPages ? page + 1 : null,
      footer: `Showing ${events.length} of ${totalRows} events · Page ${page} of ${lastPage}`,
    });
  } catch (err) {
    console.error("[bot/events]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
