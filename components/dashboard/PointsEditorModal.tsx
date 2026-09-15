"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_COLUMNS, DAY_LABELS } from "@/types";
import type { DayValues, PointsTableRow } from "@/types";
import { useToast } from "@/components/common/Toast";
import { formatWeekRange } from "@/lib/week";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";

type Phase = "edit" | "confirm";

export function PointsEditorModal({
  row,
  onClose,
  onSaved,
}: {
  row: PointsTableRow;
  onClose: () => void;
  onSaved: (updated: PointsTableRow) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>("edit");
  const [values, setValues] = useState<DayValues>(() =>
    Object.fromEntries(DAY_COLUMNS.map((day) => [day, row[day]])) as DayValues
  );
  const [saving, setSaving] = useState(false);

  const total = DAY_COLUMNS.reduce((sum, day) => sum + (values[day] || 0), 0);

  function adjust(day: (typeof DAY_COLUMNS)[number], delta: number) {
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
      // A first-ever save for this week means the week now exists server-side —
      // refresh so the CSV export dropdown (fed by a server-rendered `weeks`
      // prop) picks it up instead of staying stale until a manual reload.
      if (isNew) router.refresh();
      onClose();
    } catch (err) {
      showToast((err as Error).message, "error");
      setPhase("edit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal maxWidth="max-w-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-foreground">{row.discord_username}</h3>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="accent" className="px-3 py-1 text-sm">
            {total}
          </Badge>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
      </div>

      {phase === "edit" && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {DAY_COLUMNS.map((day) => (
              <div key={day} className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                {DAY_LABELS[day]}
                <div className="flex h-16 w-24 overflow-hidden rounded-2xl border border-border">
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
                    className="w-16 [appearance:textfield] bg-surface-muted text-center text-2xl font-bold text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <div className="flex w-8 flex-col">
                    <button
                      type="button"
                      onClick={() => adjust(day, 1)}
                      className="flex flex-1 items-center justify-center bg-gradient-to-br from-accent-from to-accent-to text-accent-foreground hover:brightness-110"
                      aria-label={`Increase ${DAY_LABELS[day]}`}
                    >
                      <span className="text-base font-bold leading-none">+</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(day, -1)}
                      className="flex flex-1 items-center justify-center bg-danger-soft text-danger hover:brightness-95"
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
            Save these points for <span className="font-medium text-foreground">{row.discord_username}</span>,{" "}
            {formatWeekRange(row.week_date)}?
          </p>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border text-sm">
            {DAY_COLUMNS.map((day) => (
              <div key={day} className="flex items-center justify-between px-3.5 py-1.5">
                <span className="text-muted-foreground">{DAY_LABELS[day]}</span>
                <span className="tabular-nums text-foreground">{values[day]}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3.5 py-1.5 font-medium text-foreground">
              <span>Total</span>
              <span className="tabular-nums">{total}</span>
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
