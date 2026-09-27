"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import {
  EMPTY_EVENT_FORM,
  EventFormFields,
  eventFormPayload,
  isEventFormValid,
  type EventFormValues,
} from "@/components/dashboard/EventFormFields";

export function CreateEventButton({ variant = "pill" }: { variant?: "pill" | "row" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [submitting, setSubmitting] = useState(false);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setValues(EMPTY_EVENT_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEventFormValid(values)) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormPayload(values)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create event");

      showToast("Event created");
      setValues(EMPTY_EVENT_FORM);
      setOpen(false);
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
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
        <Modal maxWidth="max-w-md">
          <h3 className="mb-4 text-lg font-extrabold text-foreground">Create Event</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <EventFormFields values={values} onChange={setValues} disabled={submitting} />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !isEventFormValid(values)}>
                {submitting ? "Creating…" : "Create Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
