import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/dal";
import { canManageTeam } from "@/lib/auth/roles";
import { loadTeam } from "@/lib/team";
import { TeamManager } from "@/components/team/TeamManager";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";
import type { TeamMember } from "@/types";

export const dynamic = "force-dynamic";

async function loadMembers(): Promise<{ members: TeamMember[] } | { error: string }> {
  try {
    return { members: await loadTeam() };
  } catch (err) {
    // Logged here; the page shows a generic message rather than raw DB text.
    console.error(err);
    return { error: "Couldn't load the team. Please try again." };
  }
}

// Admins only — everyone else gets a 404, same as a page that doesn't exist.
export default async function TeamPage() {
  const user = await requirePageUser();
  if (!canManageTeam(user.role)) notFound();
  const result = await loadMembers();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Team</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Everyone who can sign in. Changes apply on their next click, no sign-out needed.
      </p>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : (
        <TeamManager initialMembers={result.members} currentEmail={user.email} />
      )}
    </div>
  );
}
