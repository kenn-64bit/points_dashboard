"use client";

import { useEffect, useState } from "react";
import { EVENT_TYPE_LABELS } from "@/types";
import type { Event, EventSummary } from "@/types";
import { EventTypeIcon, PASS_CLASSES, eventTypeOf } from "@/components/dashboard/eventType";
import { formatWeeksSpan } from "@/lib/week";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0">
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}

function SproutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4 shrink-0">
      <path d="M12 20v-8M12 12c0-4-3-6-7-6 0 4 3 6 7 6ZM12 14c0-3.5 2.5-5.5 6.5-5.5 0 3.5-2.5 5.5-6.5 5.5Z" />
    </svg>
  );
}

// Palm on a little island, drawn faintly behind the pass like the passport's.
function IslandMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 96 80" fill="currentColor" aria-hidden className={className}>
      <path d="M8 74c10-9 26-13 40-13s30 4 40 13Z" />
      <path d="M50 64c1-14-1-28-6-40l3-1c5 12 7 27 7 41Z" />
      <path d="M46 24c-8-9-20-10-30-4 10-1 19 2 25 8ZM46 24c-2-10-11-17-22-17 9 3 16 9 19 17ZM47 23c6-9 17-12 28-8-10 0-18 3-24 10ZM47 23c7-4 17-3 25 3-9-2-17-1-23 3Z" />
    </svg>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
      {icon}
      <span className="truncate">{children}</span>
    </div>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Weeks and participant count for the pass. Pass `preloaded` when the caller
// already has them to skip the request.
export function useEventSummary(eventId: string, preloaded?: EventSummary | null) {
  const [summary, setSummary] = useState<EventSummary | null>(preloaded ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    fetch(`/api/events/${eventId}/summary`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setSummary(body as EventSummary);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [eventId, preloaded]);

  return { summary, failed };
}

// The event pass: the event's card on /dashboard, and the live preview while
// editing. `action` fills the top-right corner (the pass's edit pencil).
export function EventPassCard({
  event,
  summary,
  failed,
  titleId,
  action,
}: {
  event: Event;
  summary: EventSummary | null;
  failed: boolean;
  titleId?: string;
  action?: React.ReactNode;
}) {
  const type = eventTypeOf(event);
  const pending = failed ? "—" : "…";
  const created = new Date(event.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let runs = "Loading weeks…";
  if (failed) runs = "Couldn't load weeks";
  else if (summary) {
    runs =
      summary.weeks.length === 0
        ? "No weeks yet"
        : `Runs ${formatWeeksSpan(summary.weeks[0], summary.weeks[summary.weeks.length - 1])}`;
  }

  return (
    <article className={`relative overflow-hidden rounded-panel shadow-panel transition-colors duration-200 ease-out ${PASS_CLASSES[type]}`}>
      <IslandMark className="pointer-events-none absolute bottom-10 right-4 h-24 w-28 opacity-[0.12]" />

      {action && <div className="absolute right-4 top-3 z-10">{action}</div>}

      <header className="flex items-center gap-3 px-14 pt-5">
        <span aria-hidden className="flex-1 border-t-2 border-dashed border-current opacity-40" />
        <span className="text-xs font-extrabold tracking-[0.3em]">EVENT PASS</span>
        <span aria-hidden className="flex-1 border-t-2 border-dashed border-current opacity-40" />
      </header>

      <div className="relative grid gap-5 px-6 pb-4 pt-4 sm:grid-cols-[8rem_1fr]">
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-center">
          <div className="flex aspect-square w-24 items-center justify-center rounded-field bg-surface shadow-sm sm:w-full">
            <EventTypeIcon type={type} className="h-14 w-14" />
          </div>
          <span className="-rotate-6 rounded-lg border-2 border-current px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider">
            {EVENT_TYPE_LABELS[type]}
          </span>
        </div>

        <div className="min-w-0">
          <div className="relative rounded-field bg-surface px-4 py-3 text-sm shadow-sm">
            <span aria-hidden className="absolute -left-1.5 top-5 hidden h-3 w-3 rotate-45 bg-surface sm:block" />
            {event.description ? (
              <p className="relative whitespace-pre-line break-words font-bold text-foreground">
                &ldquo;{event.description}&rdquo;
              </p>
            ) : (
              <p className="relative text-muted-foreground">No description yet.</p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            <Field icon={<EventTypeIcon type={type} className="h-4 w-4" />}>{EVENT_TYPE_LABELS[type]}</Field>
            <Field icon={<CalendarIcon />}>{summary ? plural(summary.weeks.length, "week") : pending}</Field>
            <Field icon={<EventTypeIcon type="community" className="h-4 w-4" />}>
              {summary ? plural(summary.participant_count, "participant") : pending}
            </Field>
            <Field icon={<SproutIcon />}>{created}</Field>
          </div>

          <h2 id={titleId} className="mt-4 break-words text-2xl font-extrabold tracking-tight">
            {event.event_name}
          </h2>
          <span aria-hidden className="mt-1 block border-t-2 border-dashed border-current opacity-40" />
          <p className="mt-2 text-sm font-bold">{runs}</p>
        </div>
      </div>

      <footer className="flex items-center gap-4 px-6 pb-5 text-xs font-extrabold">
        <span className="shrink-0">Issue #: {event.event_id.slice(0, 6).toUpperCase()}</span>
        <span aria-hidden className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-right tracking-tighter opacity-50">
          {"‹".repeat(40)}
        </span>
      </footer>
    </article>
  );
}
