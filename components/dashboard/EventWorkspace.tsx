"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WeekSelector } from "@/components/dashboard/WeekSelector";
import { PointsTable } from "@/components/dashboard/PointsTable";
import { BulkImportButton } from "@/components/dashboard/BulkImportButton";
import { AddParticipantsButton } from "@/components/dashboard/AddParticipantsButton";
import { Loading } from "@/components/common/Loading";
import { ErrorState } from "@/components/common/ErrorState";
import { formatWeekRange, getCurrentWeekMonday } from "@/lib/week";
import type { PointsTableRow } from "@/types";

export function EventWorkspace({ eventId }: { eventId: string }) {
  const [week, setWeek] = useState(getCurrentWeekMonday());
  const [rows, setRows] = useState<PointsTableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector eventId={eventId} selectedWeek={week} onChange={setWeek} />
        <div className="flex flex-wrap items-center gap-2">
          <AddParticipantsButton eventId={eventId} week={week} onAdded={loadPoints} />
          <BulkImportButton eventId={eventId} week={week} onImported={loadPoints} />
        </div>
      </div>
      {error && <ErrorState message={error} onRetry={loadPoints} />}
      {!error && rows === null && <Loading label="Loading points…" />}
      {!error && rows !== null && (
        <PointsTable
          rows={rows}
          label={formatWeekRange(week)}
          onRowUpdated={(updated) =>
            setRows((prev) => (prev ? prev.map((r) => (r.discord_id === updated.discord_id ? updated : r)) : prev))
          }
        />
      )}
    </div>
  );
}
