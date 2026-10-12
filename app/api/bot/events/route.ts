import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { requireBotClient } from "@/lib/auth/botToken";
import { loadBotEvents } from "@/lib/botData";

// Every event, newest first, for the bot's event picker.
export async function GET(request: NextRequest) {
  try {
    const denied = requireBotClient(request);
    if (denied) return denied;
    return NextResponse.json({ events: await loadBotEvents() });
  } catch (err) {
    return errorResponse(err);
  }
}
