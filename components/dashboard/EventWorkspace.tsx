"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WeekSelector } from "@/components/dashboard/WeekSelector";
import { PointsTable } from "@/components/dashboard/PointsTable";
import { BulkImportButton } from "@/components/dashboard/BulkImportButton";
import { AddParticipantsButton } from "@/components/dashboard/AddParticipantsButton";
import { ExportEventButton } from "@/components/dashboard/ExportEventButton";
import { DeleteEventButton } from "@/components/dashboard/DeleteEventButton";
import { useCanEdit } from "@/components/auth/RoleProvider";
import { IconButton, IconLink } from "@/components/common/IconButton";
import { PencilIcon, TrophyIcon } from "@/components/common/icons";
import { Loading } from "@/components/common/Loading";
import { ErrorState } from "@/components/common/ErrorState";
import { Panel } from "@/components/common/Panel";
import { defaultWeek, formatWeekLabel, getToday } from "@/lib/week";
import type { Event, EventWeek, PointsTableRow } from "@/types";

// Loaded on first open, so its code isn't part of the page's initial JS.
const EditEventModal = dynamic(() => import("@/components/dashboard/EditEventModal").then((m) => m.EditEventModal), {
  ssr: false,
});

// Long names keep their start and end, with "…" in the middle.
const MAX_TITLE_CHARS = 48;
function middleTruncate(text: string): string {
  if (text.length <= MAX_TITLE_CHARS) return text;
  const head = Math.ceil((MAX_TITLE_CHARS - 1) * 0.65);
  const tail = MAX_TITLE_CHARS - 1 - head;
  return `${text.slice(0, head).trimEnd()}…${text.slice(-tail).trimStart()}`;
}

// `weeks` are the event's weeks, oldest first: only the ones it has, so a
// deleted week stays gone and a new event starts with none. `initialRows` is
// `initialWeek`'s table, rendered on the server so it arrives with the page.
// The server's "today" is UTC-based, so if the viewer's local date picks
// another week the workspace switches to it and fetches that instead.
export function EventWorkspace({
  event: initialEvent,
  weeks: serverWeeks,
  initialWeek,
  initialRows,
}: {
  event: Event;
  weeks: EventWeek[];
  initialWeek: string | null;
  initialRows: PointsTableRow[] | null;
}) {
  const editable = useCanEdit();
  const [event, setEvent] = useState(initialEvent);
  const [editing, setEditing] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  // Reset from the server's list whenever router.refresh() brings a new one.
  const [weeks, setWeeks] = useState(serverWeeks);
  const [prevServerWeeks, setPrevServerWeeks] = useState(serverWeeks);
  if (serverWeeks !== prevServerWeeks) {
    setPrevServerWeeks(serverWeeks);
    setWeeks(serverWeeks);
  }
  const [pickedWeek, setPickedWeek] = useState(initialWeek);
  const [rows, setRows] = useState<PointsTableRow[] | null>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const preloadedWeekRef = useRef<string | null>(initialRows ? initialWeek : null);
  const firstServerWeeksRef = useRef(serverWeeks);
  const eventId = event.event_id;

  // The picked week while the event still has it, else the default one (e.g.
  // after it was deleted). Null when the event has no weeks.
  const week =
    pickedWeek && weeks.some((w) => w.week_date === pickedWeek) ? pickedWeek : defaultWeek(weeks, getToday());
  const selectedWeek = weeks.find((w) => w.week_date === week) ?? null;

  // Week 1 is the event's earliest week (`weeks` is oldest first).
  const weekNumber = useMemo(() => {
    const starts = weeks.map((w) => w.week_date);
    return (w: string) => starts.indexOf(w) + 1;
  }, [weeks]);

  // Only called while there's a week: the effect below checks, and the buttons
  // that call it only show then.
  const loadPoints = useCallback(async () => {
    // Guards against a stale response (from a previous week's request)
    // resolving after a newer one and overwriting the table with wrong data.
    const requestId = ++requestIdRef.current;
    setRows(null);
    setError(null);
    try {
      const res = await fetch(`/api/points?event_id=${eventId}&week_date=${week}`);
      const body = await res.json();
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) throw new Error(body.error ?? "Failed to load points");
      setRows(body.points);
    } catch (err) {
      if (requestId === requestIdRef.current) setError((err as Error).message);
    }
  }, [eventId, week]);

  useEffect(() => {
    const localWeek = defaultWeek(firstServerWeeksRef.current, getToday());
    if (localWeek !== initialWeek) setPickedWeek(localWeek);
  }, [initialWeek]);

  useEffect(() => {
    if (!week) return;
    // The server already rendered this week's rows — skip the first fetch.
    const preloaded = preloadedWeekRef.current === week;
    preloadedWeekRef.current = null;
    if (preloaded) return;
    // Standard fetch-on-mount/dependency-change pattern; loadPoints resets
    // rows/error before fetching so the loading state renders correctly.
    loadPoints();
  }, [loadPoints, week]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {(() => {
          const shortTitle = middleTruncate(event.event_name);
          const truncated = shortTitle !== event.event_name;
          return (
            <div className="group relative min-w-0">
              <h1
                tabIndex={truncated ? 0 : undefined}
                onClick={truncated ? () => setShowFullTitle((v) => !v) : undefined}
                onBlur={() => setShowFullTitle(false)}
                aria-label={event.event_name}
                className="break-words text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
              >
                {shortTitle}
              </h1>
              {truncated && (
                <div
                  aria-hidden
                  className={`absolute left-0 top-full z-30 mt-2 w-max max-w-[min(36rem,calc(100vw-2rem))] break-words rounded-field border border-border bg-surface px-4 py-3 text-sm font-bold text-foreground shadow-panel transition-opacity duration-150 ease-out group-hover:visible group-hover:opacity-100 ${
                    showFullTitle ? "visible opacity-100" : "invisible opacity-0"
                  }`}
                >
                  {event.event_name}
                </div>
              )}
            </div>
          );
        })()}
        <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-bold tabular-nums text-accent-foreground shadow-sm">
          {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
        </span>
        {editable && (
          <IconButton label="Edit event" tone="primary" onClick={() => setEditing(true)} className="h-9 w-9">
            <PencilIcon className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector
          eventId={eventId}
          weeks={weeks}
          onWeeksChange={setWeeks}
          weekNumber={weekNumber}
          selectedWeek={week}
          onChange={setPickedWeek}
        />
        <div className="flex shrink-0 items-center gap-2">
          <IconLink href={`/dashboard/events/${eventId}/leaderboard`} label="Leaderboard" tone="primary">
            <TrophyIcon />
          </IconLink>
          {editable && selectedWeek && (
            <>
              <AddParticipantsButton
                eventId={eventId}
                week={selectedWeek}
                weekNumber={weekNumber(selectedWeek.week_date)}
                onAdded={loadPoints}
              />
              <BulkImportButton
                eventId={eventId}
                week={selectedWeek}
                weekNumber={weekNumber(selectedWeek.week_date)}
                onImported={loadPoints}
              />
            </>
          )}
          <ExportEventButton eventId={eventId} weeks={weeks} />
          {editable && (
            <>
              <span aria-hidden className="mx-1 h-6 border-l border-dashed border-line" />
              <DeleteEventButton eventId={eventId} eventName={event.event_name} />
            </>
          )}
        </div>
      </div>
      {!selectedWeek ? (
        <Panel bodyClassName="px-5 py-4">
          <p className="text-sm text-muted-foreground">
            {editable ? (
              <>
                No weeks yet. Use <span className="font-bold text-foreground">Add Week</span> to pick this event&apos;s
                dates.
              </>
            ) : (
              "No weeks yet."
            )}
          </p>
        </Panel>
      ) : error ? (
        <ErrorState message={error} onRetry={loadPoints} />
      ) : rows === null ? (
        <Loading label="Loading points…" />
      ) : (
        <PointsTable
          rows={rows}
          week={selectedWeek}
          label={formatWeekLabel(weekNumber(selectedWeek.week_date), selectedWeek)}
          onRowUpdated={(updated) =>
            setRows((prev) => (prev ? prev.map((r) => (r.discord_id === updated.discord_id ? updated : r)) : prev))
          }
        />
      )}

      {editing && (
        <EditEventModal
          event={event}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setEvent(updated);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
