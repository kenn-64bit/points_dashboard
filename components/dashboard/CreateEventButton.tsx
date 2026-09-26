"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Label, inputClasses } from "@/components/common/Field";

export function CreateEventButton({ variant = "pill" }: { variant?: "pill" | "row" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setEventName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = eventName.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_name: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create event");

      showToast("Event created");
      setEventName("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-extrabold text-primary transition-colors hover:bg-accent-soft"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          Create Event
        </button>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Create Event
        </Button>
      )}

      {open && (
        <Modal>
          <h3 className="mb-4 text-lg font-extrabold text-foreground">Create Event</h3>
          <form onSubmit={handleSubmit}>
            <Label htmlFor="event-name">Event name</Label>
            <input
              id="event-name"
              autoFocus
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. September Gaming Night"
              className={inputClasses}
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !eventName.trim()}>
                {submitting ? "Creating…" : "Create Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
