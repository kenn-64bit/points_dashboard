"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { inputClasses } from "@/components/common/Field";
import { formatWeekRange } from "@/lib/week";

type NameRow = { id: number; name: string };

export function AddParticipantsButton({
  eventId,
  week,
  onAdded,
}: {
  eventId: string;
  week: string;
  onAdded: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NameRow[]>([{ id: 0, name: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const nextIdRef = useRef(1);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());
  const focusIdRef = useRef<number | null>(null);

  const filledCount = rows.filter((r) => r.name.trim()).length;

  // Focus a newly added row once it has rendered.
  useEffect(() => {
    if (focusIdRef.current === null) return;
    inputRefs.current.get(focusIdRef.current)?.focus();
    focusIdRef.current = null;
  }, [rows]);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setRows([{ id: nextIdRef.current++, name: "" }]);
  }

  function addRow() {
    const id = nextIdRef.current++;
    focusIdRef.current = id;
    setRows((prev) => [...prev, { id, name: "" }]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, name: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }

  async function handleSubmit() {
    if (filledCount === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_date: week, usernames: rows.map((r) => r.name) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add participants");

      const { added, skipped } = body as { added: number; skipped: number };
      const parts = [`Added ${added} participant${added === 1 ? "" : "s"}`];
      if (skipped > 0) parts.push(`${skipped} already in this week`);
      showToast(parts.join(" · "));

      onAdded();
      // The week may be new server-side — refresh so the export dropdown
      // (fed by a server-rendered `weeks` prop) picks it up.
      router.refresh();
      setSubmitting(false);
      setOpen(false);
      setRows([{ id: nextIdRef.current++, name: "" }]);
    } catch (err) {
      showToast((err as Error).message, "error");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add Participants
      </Button>

      {open && (
        <Modal maxWidth="max-w-md">
          <h3 className="text-lg font-extrabold text-foreground">Add Participants</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Added to <span className="font-bold text-foreground">{formatWeekRange(week)}</span> with 0 points.
            New usernames are created automatically.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="mt-4 flex max-h-72 flex-col gap-2 overflow-y-auto p-0.5">
              {rows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current.set(row.id, el);
                      else inputRefs.current.delete(row.id);
                    }}
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, e.target.value)}
                    onKeyDown={(e) => {
                      // Enter on the last row starts a new one instead of submitting.
                      if (e.key === "Enter" && idx === rows.length - 1 && row.name.trim()) {
                        e.preventDefault();
                        addRow();
                      }
                    }}
                    placeholder="Discord username"
                    aria-label={`Participant ${idx + 1} name`}
                    autoFocus={idx === 0}
                    disabled={submitting}
                    className={inputClasses}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={submitting}
                      aria-label={`Remove participant ${idx + 1}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button type="button" variant="ghost" onClick={addRow} disabled={submitting} className="mt-2">
              + Add another
            </Button>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={filledCount === 0 || submitting}>
                {submitting
                  ? "Adding…"
                  : filledCount === 0
                    ? "Add participants"
                    : `Add ${filledCount} participant${filledCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
