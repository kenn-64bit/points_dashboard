import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/dal";
import { canManageTeam } from "@/lib/auth/roles";
import { isAuditArea, loadAuditLog, type AuditFilters } from "@/lib/audit";
import { isValidUUID, MAX_EMAIL_LENGTH } from "@/lib/validation";
import { AuditLog } from "@/components/dashboard/AuditLog";
import { ErrorState } from "@/components/common/ErrorState";
import { buttonClasses } from "@/components/common/Button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ?actor= ?event= ?area= ?before=. Anything malformed is ignored rather than
// rejected, so a mangled link still shows the log.
function parseFilters(params: Awaited<SearchParams>): AuditFilters {
  const actor = one(params.actor)?.trim().toLowerCase();
  const eventId = one(params.event);
  const area = one(params.area);
  const before = Number(one(params.before));
  return {
    actor: actor && actor.length <= MAX_EMAIL_LENGTH ? actor : undefined,
    eventId: eventId && isValidUUID(eventId) ? eventId : undefined,
    area: isAuditArea(area) ? area : undefined,
    before: Number.isSafeInteger(before) && before > 0 ? before : undefined,
  };
}

async function loadEntries(filters: AuditFilters) {
  try {
    return await loadAuditLog(filters);
  } catch (err) {
    // Logged here; the page shows a generic message rather than raw DB text.
    console.error(err);
    return { error: "Couldn't load the audit log. Please try again." };
  }
}

// Admins only — everyone else gets a 404, same as a page that doesn't exist.
export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageUser();
  if (!canManageTeam(user.role)) notFound();
  const filters = parseFilters(await searchParams);
  const result = await loadEntries(filters);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4 print:hidden")}>
        ← Back to events
      </Link>
      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Audit log</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every change made in the dashboard, and every CSV export, newest first. Only admins can see this page.
      </p>
      {"error" in result ? (
        <ErrorState message={result.error} />
      ) : (
        <AuditLog rows={result.rows} hasOlder={result.hasOlder} filters={filters} />
      )}
    </div>
  );
}
