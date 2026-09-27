"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Event } from "@/types";
import { Modal } from "@/components/common/Modal";
import { Button, buttonClasses } from "@/components/common/Button";
import { PencilIcon } from "@/components/common/icons";
import { EventPassCard, useEventSummary } from "@/components/dashboard/EventPassCard";
import { EditEventModal } from "@/components/dashboard/EditEventModal";
import { useCanEdit } from "@/components/auth/RoleProvider";

export function EventPassModal({
  event,
  onClose,
  onUpdated,
}: {
  event: Event;
  onClose: () => void;
  onUpdated: (event: Event) => void;
}) {
  const titleId = `event-pass-${event.event_id}`;
  const { summary, failed } = useEventSummary(event.event_id);
  const [editing, setEditing] = useState(false);
  const editable = useCanEdit();

  useEffect(() => {
    // While editing, the edit modal owns Escape (it backs out to the pass).
    if (editing) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, editing]);

  if (editing) {
    return (
      <EditEventModal
        event={event}
        summary={summary}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onUpdated(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Modal maxWidth="max-w-xl" bare onClose={onClose} labelledBy={titleId}>
      <EventPassCard
        event={event}
        summary={summary}
        failed={failed}
        titleId={titleId}
        action={
          editable && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit event"
              title="Edit event"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-150 ease-out hover:-rotate-12 active:translate-y-px"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )
        }
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Link href={`/dashboard/events/${event.event_id}`} className={buttonClasses("primary")}>
          Open event
        </Link>
      </div>
    </Modal>
  );
}
