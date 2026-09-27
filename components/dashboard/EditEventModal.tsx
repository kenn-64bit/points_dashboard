"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Event, EventSummary } from "@/types";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast";
import { EventPassCard, useEventSummary } from "@/components/dashboard/EventPassCard";
import {
  EventFormFields,
  eventFormPayload,
  isEventFormValid,
  eventFormValuesOf,
  type EventFormValues,
} from "@/components/dashboard/EventFormFields";

// Edit form with the event pass on top as a live preview of the changes.
export function EditEventModal({
  event,
  summary: preloadedSummary,
  onCancel,
  onSaved,
}: {
  event: Event;
  summary?: EventSummary | null;
  onCancel: () => void;
  onSaved: (event: Event) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { summary, failed } = useEventSummary(event.event_id, preloadedSummary);
  const [values, setValues] = useState<EventFormValues>(() => eventFormValuesOf(event));
  const [saving, setSaving] = useState(false);
  const titleId = `edit-event-${event.event_id}`;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel, saving]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isEventFormValid(values)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.event_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormPayload(values)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update event");

      showToast("Event updated");
      onSaved(body.event as Event);
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
      setSaving(false);
    }
  }

  const payload = eventFormPayload(values);
  const preview: Event = {
    ...event,
    event_name: payload.event_name || "Untitled event",
    event_type: payload.event_type,
    description: payload.description,
  };

  return (
    <Modal maxWidth="max-w-xl" labelledBy={titleId}>
      <h3 id={titleId} className="mb-4 text-lg font-extrabold text-foreground">
        Edit event
      </h3>
      <EventPassCard event={preview} summary={summary} failed={failed} />
      <form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
        <EventFormFields values={values} onChange={setValues} disabled={saving} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving || !isEventFormValid(values)}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
