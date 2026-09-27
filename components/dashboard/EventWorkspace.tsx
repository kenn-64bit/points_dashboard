"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WeekSelector } from "@/components/dashboard/WeekSelector";
import { PointsTable } from "@/components/dashboard/PointsTable";
import { BulkImportButton } from "@/components/dashboard/BulkImportButton";
import { AddParticipantsButton } from "@/components/dashboard/AddParticipantsButton";
import { ExportEventButton } from "@/components/dashboard/ExportEventButton";
import { DeleteEventButton } from "@/components/dashboard/DeleteEventButton";
import { EditEventModal } from "@/components/dashboard/EditEventModal";
import { IconButton, IconLink } from "@/components/common/IconButton";
import { PencilIcon, TrophyIcon } from "@/components/common/icons";
import { Loading } from "@/components/common/Loading";
import { ErrorState } from "@/components/common/ErrorState";
import { formatWeekLabel, getCurrentWeekMonday } from "@/lib/week";
import type { Event, PointsTableRow } from "@/types";

// `weeks` are the server's weeks with points (newest first). The current week
// is always offered too, even before it has any points.
function withCurrentWeek(weeks: string[]): string[] {
  const current = getCurrentWeekMonday();
  return weeks.includes(current) ? weeks : [...weeks, current].sort().reverse();
}

// Long names keep their start and end, with "…" in the middle.
const MAX_TITLE_CHARS = 48;
function middleTruncate(text: string): string {
  if (text.length <= MAX_TITLE_CHARS) return text;
  const head = Math.ceil((MAX_TITLE_CHARS - 1) * 0.65);
  const tail = MAX_TITLE_CHARS - 1 - head;
  return `${text.slice(0, head).trimEnd()}…${text.slice(-tail).trimStart()}`;
}

export function EventWorkspace({ event: initialEvent, weeks: serverWeeks }: { event: Event; weeks: string[] }) {
  const [event, setEvent] = useState(initialEvent);
  const [editing, setEditing] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const [weeks, setWeeks] = useState(() => withCurrentWeek(serverWeeks));
  const [week, setWeek] = useState(getCurrentWeekMonday());
  const [rows, setRows] = useState<PointsTableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const eventId = event.event_id;

  // Week 1 is the event's earliest week.
  const weekNumber = useMemo(() => {
    const ascending = [...weeks].sort();
    return (w: string) => ascending.indexOf(w) + 1;
  }, [weeks]);

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
    // Standard fetch-on-mount/dependency-change pattern; loadPoints resets
    // rows/error before fetching so the loading state renders correctly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPoints();
  }, [loadPoints]);

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
        <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold tabular-nums text-accent-ink">
          {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
        </span>
        <IconButton label="Edit event" onClick={() => setEditing(true)} className="h-9 w-9">
          <PencilIcon className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector
          eventId={eventId}
          weeks={weeks}
          onWeeksChange={setWeeks}
          weekNumber={weekNumber}
          selectedWeek={week}
          onChange={setWeek}
        />
        <div className="flex shrink-0 items-center gap-2">
          <IconLink href={`/dashboard/events/${eventId}/leaderboard`} label="Leaderboard">
            <TrophyIcon />
          </IconLink>
          <AddParticipantsButton eventId={eventId} week={week} weekNumber={weekNumber(week)} onAdded={loadPoints} />
          <BulkImportButton eventId={eventId} week={week} weekNumber={weekNumber(week)} onImported={loadPoints} />
          <ExportEventButton eventId={eventId} weeks={serverWeeks} />
          <span aria-hidden className="mx-1 h-6 border-l border-dashed border-line" />
          <DeleteEventButton eventId={eventId} eventName={event.event_name} />
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={loadPoints} />}
      {!error && rows === null && <Loading label="Loading points…" />}
      {!error && rows !== null && (
        <PointsTable
          rows={rows}
          label={formatWeekLabel(weekNumber(week), week)}
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
