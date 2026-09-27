import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, forbiddenResponse } from "@/lib/apiError";
import { requireApiUser } from "@/lib/auth/dal";
import { canManageTeam, isAppUserRole } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";
import { loadTeam, TEAM_COLUMNS, toTeamMember } from "@/lib/team";
import { parseEmail, passwordProblem } from "@/lib/validation";

const NOT_ADMIN = "Only admins can manage the team.";
const ALREADY_ON_TEAM = "That email is already on the team.";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    if (!canManageTeam(user.role)) return forbiddenResponse(NOT_ADMIN);

    return NextResponse.json({ members: await loadTeam() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    if (!canManageTeam(user.role)) return forbiddenResponse(NOT_ADMIN);

    const body = await request.json();
    const parsed = parseEmail(body.email);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const passwordError = passwordProblem(body.password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
    if (!isAppUserRole(body.role)) return NextResponse.json({ error: "Choose a role" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from("app_users")
      .select("email")
      .eq("email", parsed.email)
      .maybeSingle();
    if (lookupError) return errorResponse(lookupError);
    if (existing) return NextResponse.json({ error: ALREADY_ON_TEAM }, { status: 409 });

    const { data, error } = await supabase
      .from("app_users")
      .insert({ email: parsed.email, password_hash: await hashPassword(body.password), role: body.role })
      .select(TEAM_COLUMNS)
      .single();
    // Someone else added the same email between the lookup and the insert.
    if (error?.code === "23505") return NextResponse.json({ error: ALREADY_ON_TEAM }, { status: 409 });
    if (error) return errorResponse(error);

    return NextResponse.json({ member: toTeamMember(data) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
