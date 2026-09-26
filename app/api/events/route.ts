import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser } from "@/lib/auth/dal";
import { MAX_EVENT_NAME_LENGTH } from "@/lib/validation";

export async function GET() {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return errorResponse(error);
    return NextResponse.json({ events: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getCurrentUser())) return unauthorizedResponse();
    const body = await request.json();
    const event_name = typeof body.event_name === "string" ? body.event_name.trim() : "";
    if (!event_name) {
      return NextResponse.json({ error: "event_name is required" }, { status: 400 });
    }
    if (event_name.length > MAX_EVENT_NAME_LENGTH) {
      return NextResponse.json({ error: `event_name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // `month` is a generated column — never accept one from the client.
    const { data, error } = await supabase
      .from("events")
      .insert({ event_name })
      .select("*")
      .single();

    if (error) return errorResponse(error);
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
