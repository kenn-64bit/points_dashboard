import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiError";
import { requireBotClient } from "@/lib/auth/botToken";
import { loadBotPlayers } from "@/lib/botData";

// Every player, A→Z, for the bot's player picker.
export async function GET(request: NextRequest) {
  try {
    const denied = requireBotClient(request);
    if (denied) return denied;
    return NextResponse.json({ players: await loadBotPlayers() });
  } catch (err) {
    return errorResponse(err);
  }
}
