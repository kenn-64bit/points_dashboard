import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, forbiddenResponse } from "@/lib/apiError";
import { requireApiUser } from "@/lib/auth/dal";
import { canManageTeam, isAppUserRole } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";
import { TEAM_COLUMNS, toTeamMember } from "@/lib/team";
import { parseEmail, passwordProblem } from "@/lib/validation";
import type { SessionUser } from "@/types";

type Params = { params: Promise<{ email: string }> };

const NOT_ADMIN = "Only admins can manage the team.";
const NOT_FOUND = "That member isn't on the team.";

// Shared checks: an admin session and a well-formed target email (the path
// segment arrives URL-encoded).
async function authorize({ params }: Params): Promise<{ user: SessionUser; email: string } | Response> {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  if (!canManageTeam(user.role)) return forbiddenResponse(NOT_ADMIN);

  const raw = (await params).email;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Already decoded, or a stray "%" — use it as-is and let parseEmail judge.
  }
  const parsed = parseEmail(decoded);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return { user, email: parsed.email };
}

// Body: { role } to change a member's role, or { password } to reset it.
// Admins can't change their own role — that also guarantees the team always
// keeps at least one admin.
export async function PATCH(request: NextRequest, context: Params) {
  try {
    const auth = await authorize(context);
    if (auth instanceof Response) return auth;
    const { user, email } = auth;

    const body = await request.json();
    const changes: Record<string, string> = {};
    if (body.role !== undefined) {
      if (!isAppUserRole(body.role)) return NextResponse.json({ error: "Choose a role" }, { status: 400 });
      if (email === user.email) return forbiddenResponse("You can't change your own role.");
      changes.role = body.role;
    }
    if (body.password !== undefined) {
      const passwordError = passwordProblem(body.password);
      if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
      changes.password_hash = await hashPassword(body.password);
    }
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_users")
      .update(changes)
      .eq("email", email)
      .select(TEAM_COLUMNS)
      .maybeSingle();
    if (error) return errorResponse(error);
    if (!data) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });

    return NextResponse.json({ member: toTeamMember(data) });
  } catch (err) {
    return errorResponse(err);
  }
}

// Removal takes effect on the member's next request (see getCurrentUser).
export async function DELETE(_request: NextRequest, context: Params) {
  try {
    const auth = await authorize(context);
    if (auth instanceof Response) return auth;
    const { user, email } = auth;
    if (email === user.email) return forbiddenResponse("You can't remove yourself from the team.");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("app_users").delete().eq("email", email).select("email");
    if (error) return errorResponse(error);
    if (!data?.length) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
