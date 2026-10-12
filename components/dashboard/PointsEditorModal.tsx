"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_COLUMNS, DAY_LABELS } from "@/types";
import type { Day, DayValues, EventWeek, PointsTableRow } from "@/types";
import { useToast } from "@/components/common/Toast";
import { formatShortDayLabel, formatWeekRange, weekDays, weekHasDay } from "@/lib/week";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TotalTile } from "@/components/common/TotalTile";
import { KeyValueRow } from "@/components/common/KeyValueRow";

type Phase = "edit" | "confirm";

// Wider modals for 5–7 day weeks, so every day box fits in one row at full
// size (6rem each); shorter weeks fit the default.
const MODAL_WIDTH_BY_DAYS: Partial<Record<number, string>> = { 5: "max-w-2xl", 6: "max-w-3xl", 7: "max-w-4xl" };

// One box per day of `week`, in a single row (two per row on phones). Only
// `week`'s own days can be edited; the others are saved as 0.
export function PointsEditorModal({
  row,
  week,
  onClose,
  onSaved,
}: {
  row: PointsTableRow;
  week: EventWeek;
  onClose: () => void;
  onSaved: (updated: PointsTableRow) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>("edit");
  const days = weekDays(week);
  const [values, setValues] = useState<DayValues>(
    () => Object.fromEntries(DAY_COLUMNS.map((day) => [day, weekHasDay(week, day) ? row[day] : 0])) as DayValues
  );
  const [saving, setSaving] = useState(false);

  const total = days.reduce((sum, { day }) => sum + (values[day] || 0), 0);

  function adjust(day: Day, delta: number) {
    setValues((prev) => ({ ...prev, [day]: Math.max(0, (prev[day] || 0) + delta) }));
  }

  async function handleConfirmSave() {
    setSaving(true);
    try {
      const isNew = row.point_id === null;
      const res = await fetch(isNew ? "/api/points" : `/api/points/${row.point_id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { event_id: row.event_id, discord_id: row.discord_id, week_date: row.week_date, ...values }
            : values
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save points");

      onSaved({ ...row, ...body.point, discord_username: row.discord_username });
      showToast("Points saved");
      // Drops the copies Next.js keeps of pages rendered before this save, so
      // the leaderboard, the export list and the back button all show the new
      // points instead of the old ones until a manual reload.
      router.refresh();
      onClose();
    } catch (err) {
      showToast((err as Error).message, "error");
      setPhase("edit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal maxWidth={MODAL_WIDTH_BY_DAYS[days.length] ?? "max-w-xl"}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-extrabold text-foreground">{row.discord_username}</h3>
          <p className="text-sm text-muted-foreground">{formatWeekRange(week)}</p>
        </div>
        <TotalTile value={total} />
      </div>

      {phase === "edit" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr">
            {days.map(({ day, date }) => (
              <div key={day} className="flex flex-col items-center gap-1.5 text-xs font-bold text-muted-foreground">
                {formatShortDayLabel(date)}
                <div className="flex h-16 w-full max-w-24 overflow-hidden rounded-field border border-border">
                  <input
                    type="number"
                    min={0}
                    value={values[day]}
                    onChange={(e) => {
                      const normalized = Math.max(0, Math.trunc(Number(e.target.value) || 0));
                      // React skips re-rendering the DOM value when the parsed
                      // number is unchanged (e.g. typing "0" then "1" then "0"
                      // parses to 10 both times), which can leave a stale raw
                      // string like "010" visible. Force the input's own text
                      // back in sync regardless of whether state actually changes.
                      e.target.value = String(normalized);
                      setValues((prev) => ({ ...prev, [day]: normalized }));
                    }}
                    aria-label={`${DAY_LABELS[day]} points`}
                    className="min-w-0 flex-1 bg-surface-muted text-center text-2xl font-extrabold tabular-nums text-foreground outline-none focus:bg-primary-soft"
                  />
                  <div className="flex w-8 shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => adjust(day, 1)}
                      className="flex flex-1 items-center justify-center bg-primary text-primary-foreground transition-[filter] hover:brightness-110"
                      aria-label={`Increase ${DAY_LABELS[day]}`}
                    >
                      <span className="text-base font-bold leading-none">+</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(day, -1)}
                      className="flex flex-1 items-center justify-center bg-danger-soft text-danger-ink transition-colors hover:bg-danger hover:text-danger-foreground"
                      aria-label={`Decrease ${DAY_LABELS[day]}`}
                    >
                      <span className="text-base font-bold leading-none">−</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setPhase("confirm")}>
              Review &amp; Save
            </Button>
          </div>
        </>
      )}

      {phase === "confirm" && (
        <>
          <p className="text-sm text-muted-foreground">
            Save these points for <span className="font-bold text-foreground">{row.discord_username}</span>,{" "}
            {formatWeekRange(week)}?
          </p>
          <div className="mt-3 rounded-field bg-surface-muted px-4 py-2">
            {days.map(({ day, date }) => (
              <KeyValueRow key={day} label={formatShortDayLabel(date)} value={values[day]} />
            ))}
            <div className="mt-1 border-t border-line pt-1">
              <KeyValueRow label="Total" value={total} emphasis />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPhase("edit")} disabled={saving}>
              Back
            </Button>
            <Button variant="primary" onClick={handleConfirmSave} disabled={saving}>
              {saving ? "Saving…" : "Confirm & Save"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
