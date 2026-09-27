import Link from "next/link";
import { AUDIT_AREAS, describeAudit, type AuditArea, type AuditFilters } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Panel } from "@/components/common/Panel";
import { Badge } from "@/components/common/Badge";
import { LocalTime } from "@/components/common/LocalTime";
import { buttonClasses } from "@/components/common/Button";
import type { AuditRow } from "@/types";

// The URL for the current filters with `change` applied. Changing a filter
// goes back to the newest page unless `before` is set explicitly.
function auditHref(filters: AuditFilters, change: Partial<AuditFilters>): string {
  const next = { ...filters, before: undefined, ...change };
  const params = new URLSearchParams();
  if (next.area) params.set("area", next.area);
  if (next.actor) params.set("actor", next.actor);
  if (next.eventId) params.set("event", next.eventId);
  if (next.before) params.set("before", String(next.before));
  const query = params.toString();
  return query ? `/dashboard/audit?${query}` : "/dashboard/audit";
}

// An area pill, styled like the header's NavLink: orange when it's the
// current filter.
function AreaPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={buttonClasses("ghost", `px-3 py-1.5 ${active ? "bg-accent-soft! text-accent-ink!" : ""}`)}
    >
      {children}
    </Link>
  );
}

// An active actor or event filter; clicking it removes the filter.
function FilterChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Remove filter: ${label}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-ink transition-colors duration-150 ease-out hover:bg-accent hover:text-accent-foreground"
    >
      <span className="truncate">{label}</span>
      <span aria-hidden>✕</span>
    </Link>
  );
}

function AuditLogRow({ row, filters }: { row: AuditRow; filters: AuditFilters }) {
  const { text, danger } = describeAudit(row);
  return (
    <li className="flex break-inside-avoid flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-5">
      <LocalTime iso={row.created_at} className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground sm:w-32" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Link
            href={auditHref(filters, { actor: row.actor_email })}
            title="Only this person"
            className="min-w-0 truncate font-bold text-foreground transition-colors hover:text-accent-ink"
          >
            {row.actor_email}
          </Link>
          <Badge tone={row.actor_role === "viewer" ? "neutral" : "primary"} className="py-0.5">
            {ROLE_LABELS[row.actor_role] ?? row.actor_role}
          </Badge>
          {row.event_id && !filters.eventId && (
            <Link
              href={auditHref(filters, { eventId: row.event_id })}
              title="Only this event"
              className="min-w-0 truncate text-xs font-bold text-muted-foreground transition-colors hover:text-accent-ink"
            >
              · {row.event_name ?? "Event"}
            </Link>
          )}
        </div>
        <p className={`mt-0.5 break-words text-sm ${danger ? "text-danger-ink" : "text-foreground"}`}>{text}</p>
      </div>
    </li>
  );
}

export function AuditLog({
  rows,
  hasOlder,
  filters,
}: {
  rows: AuditRow[];
  hasOlder: boolean;
  filters: AuditFilters;
}) {
  const filtered = !!(filters.area || filters.actor || filters.eventId);
  // Every row shares the filtered event, so the newest one has its latest name.
  const eventLabel = rows[0]?.event_name ?? "That event";
  const areas = Object.entries(AUDIT_AREAS) as [AuditArea, (typeof AUDIT_AREAS)[AuditArea]][];

  return (
    <>
      <nav aria-label="Filter by area" className="mb-3 flex flex-wrap items-center gap-1">
        <AreaPill href={auditHref(filters, { area: undefined })} active={!filters.area}>
          All
        </AreaPill>
        {areas.map(([area, { label }]) => (
          <AreaPill key={area} href={auditHref(filters, { area })} active={filters.area === area}>
            {label}
          </AreaPill>
        ))}
      </nav>

      {(filters.actor || filters.eventId) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Only</span>
          {filters.actor && <FilterChip href={auditHref(filters, { actor: undefined })} label={filters.actor} />}
          {filters.eventId && <FilterChip href={auditHref(filters, { eventId: undefined })} label={eventLabel} />}
        </div>
      )}

      <Panel
        label={`${filters.before ? "Older · " : ""}${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}
        className="mt-4"
      >
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {filtered || filters.before
              ? "Nothing matches these filters."
              : "Nothing logged yet. Changes and CSV exports show up here as they happen."}
          </p>
        ) : (
          <ol className="divide-y divide-dashed divide-line">
            {rows.map((row) => (
              <AuditLogRow key={row.id} row={row} filters={filters} />
            ))}
          </ol>
        )}
      </Panel>

      {(filters.before || hasOlder) && (
        <div className="mt-4 flex items-center justify-between gap-2 print:hidden">
          {filters.before ? (
            <Link href={auditHref(filters, {})} className={buttonClasses("ghost")}>
              ← Newest
            </Link>
          ) : (
            <span />
          )}
          {hasOlder && (
            <Link href={auditHref(filters, { before: rows.at(-1)!.id })} className={buttonClasses("secondary")}>
              Older →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
