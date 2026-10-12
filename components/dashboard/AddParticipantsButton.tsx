"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { FieldError, inputClasses, inputErrorClasses } from "@/components/common/Field";
import { IconButton } from "@/components/common/IconButton";
import { UserPlusIcon } from "@/components/common/icons";
import { formatWeekLabel } from "@/lib/week";
import { stripDisallowed } from "@/lib/text";
import { MAX_PARTICIPANTS_PER_REQUEST, MAX_USERNAME_LENGTH, parseUsername } from "@/lib/validation";
import { MAX_PASTE_CHARS, parsePastedNames } from "@/lib/import/parsePastedNames";
import type { PastedNames } from "@/lib/import/parsePastedNames";
import type { EventWeek } from "@/types";

type NameRow = { id: number; name: string };

// A paste can reject thousands of lines; the summary lists the first ones.
const MAX_SHOWN_REJECTED = 50;

export function AddParticipantsButton({
  eventId,
  week,
  weekNumber,
  onAdded,
}: {
  eventId: string;
  week: EventWeek;
  weekNumber: number;
  onAdded: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NameRow[]>([{ id: 0, name: "" }]);
  // What the last multi-name paste did, shown under the list.
  const [pasted, setPasted] = useState<PastedNames | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextIdRef = useRef(1);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());
  const focusIdRef = useRef<number | null>(null);

  // Each filled row gets the same check the API runs. `names` are the valid
  // ones, deduped case-insensitively (first spelling wins, as on the server):
  // what the button counts and what gets sent.
  const problems = new Map<number, string>();
  const names: string[] = [];
  const nameKeys = new Set<string>();
  for (const row of rows) {
    if (!row.name.trim()) continue;
    const parsed = parseUsername(row.name);
    if ("error" in parsed) {
      problems.set(row.id, parsed.error);
      continue;
    }
    const key = parsed.name.toLowerCase();
    if (nameKeys.has(key)) continue;
    nameKeys.add(key);
    names.push(parsed.name);
  }

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
    setPasted(null);
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

  // A column (or row) copied from a spreadsheet arrives as lines or
  // tab-separated cells: give each name its own row instead of squashing them
  // into this input. A single name pastes as usual.
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowId: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\r\n]/.test(text.trim())) return;
    e.preventDefault();
    if (text.length > MAX_PASTE_CHARS) {
      showToast("That's too much text to paste at once", "error");
      return;
    }
    const result = parsePastedNames(text, nameKeys, MAX_PARTICIPANTS_PER_REQUEST - names.length);
    setPasted(result);
    if (result.names.length === 0) return;

    const added = result.names.map((name) => ({ id: nextIdRef.current++, name }));
    focusIdRef.current = added[added.length - 1].id;
    // The new rows replace the one pasted into if it's empty, else follow it.
    setRows((prev) => {
      const at = prev.findIndex((r) => r.id === rowId);
      if (at === -1) return [...prev, ...added];
      const keep = prev[at].name.trim() ? [prev[at]] : [];
      return [...prev.slice(0, at), ...keep, ...added, ...prev.slice(at + 1)];
    });
  }

  async function handleSubmit() {
    if (names.length === 0 || problems.size > 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_date: week.week_date, usernames: names }),
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
      setPasted(null);
    } catch (err) {
      showToast((err as Error).message, "error");
      setSubmitting(false);
    }
  }

  const notAdded = pasted ? pasted.rejected.length + pasted.overLimit : 0;

  return (
    <>
      <IconButton label="Add participants" tone="primary" onClick={() => setOpen(true)}>
        <UserPlusIcon />
      </IconButton>

      {open && (
        <Modal maxWidth="max-w-md">
          <h3 className="text-lg font-extrabold text-foreground">Add Participants</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adding to <span className="font-bold text-foreground">{formatWeekLabel(weekNumber, week)}</span>. New
            usernames are created automatically. Paste a column from Excel or Sheets to add many at once.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="mt-4 flex max-h-72 flex-col gap-2 overflow-y-auto p-0.5">
              {rows.map((row, idx) => {
                const problem = problems.get(row.id);
                const errorId = `participant-${row.id}-error`;
                return (
                  <div key={row.id}>
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(row.id, el);
                          else inputRefs.current.delete(row.id);
                        }}
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, stripDisallowed(e.target.value))}
                        onPaste={(e) => handlePaste(e, row.id)}
                        onKeyDown={(e) => {
                          // Enter on the last row starts a new one instead of submitting.
                          if (e.key === "Enter" && idx === rows.length - 1 && row.name.trim()) {
                            e.preventDefault();
                            addRow();
                          }
                        }}
                        maxLength={MAX_USERNAME_LENGTH}
                        placeholder="Discord username"
                        aria-label={`Participant ${idx + 1} name`}
                        aria-invalid={problem ? true : undefined}
                        aria-describedby={problem ? errorId : undefined}
                        autoFocus={idx === 0}
                        disabled={submitting}
                        className={problem ? inputErrorClasses : inputClasses}
                      />
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={submitting}
                          aria-label={`Remove participant ${idx + 1}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-ink disabled:opacity-50"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {problem && <FieldError id={errorId}>{problem}</FieldError>}
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="ghost" onClick={addRow} disabled={submitting} className="mt-2">
              + Add another
            </Button>

            {/* Always mounted, so screen readers announce each new summary. */}
            <div role="status">
              {pasted && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="primary">{pasted.names.length} added</Badge>
                    {pasted.duplicates > 0 && (
                      <Badge tone="neutral">
                        {pasted.duplicates} duplicate{pasted.duplicates === 1 ? "" : "s"} skipped
                      </Badge>
                    )}
                    {notAdded > 0 && <Badge tone="danger">{notAdded} not added</Badge>}
                  </div>
                  {notAdded > 0 && (
                    <div className="mt-2 max-h-32 divide-y divide-dashed divide-line overflow-y-auto rounded-field border border-border bg-surface-muted">
                      {pasted.rejected.slice(0, MAX_SHOWN_REJECTED).map((message, i) => (
                        <div key={i} className="px-3.5 py-2 text-xs text-muted-foreground">
                          {message}
                        </div>
                      ))}
                      {pasted.rejected.length > MAX_SHOWN_REJECTED && (
                        <div className="px-3.5 py-2 text-xs text-muted-foreground">
                          …and {pasted.rejected.length - MAX_SHOWN_REJECTED} more
                        </div>
                      )}
                      {pasted.overLimit > 0 && (
                        <div className="px-3.5 py-2 text-xs text-muted-foreground">
                          Max {MAX_PARTICIPANTS_PER_REQUEST} names at a time. Add the other {pasted.overLimit} in
                          another batch.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={names.length === 0 || problems.size > 0 || submitting}>
                {submitting
                  ? "Adding…"
                  : names.length === 0
                    ? "Add participants"
                    : `Add ${names.length} participant${names.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
