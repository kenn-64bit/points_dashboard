import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, unauthorizedResponse } from "@/lib/apiError";
import { getCurrentUser, requireApiUser } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { parseEventInput } from "@/lib/validation";

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
    const user = await requireApiUser(canEdit);
    if (user instanceof Response) return user;
    const parsed = parseEventInput(await request.json());
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // `month` is a generated column — never accept one from the client.
    const { data, error } = await supabase
      .from("events")
      .insert(parsed.data)
      .select("*")
      .single();

    if (error) return errorResponse(error);
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
