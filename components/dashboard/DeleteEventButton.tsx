"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { IconButton } from "@/components/common/IconButton";
import { TrashIcon } from "@/components/common/icons";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete event");
      }
      showToast("Event deleted");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
      setDeleting(false);
    }
  }

  return (
    <>
      <IconButton label="Delete event" tone="danger" tooltipAlign="end" onClick={() => setOpen(true)}>
        <TrashIcon />
      </IconButton>

      {open && (
        <ConfirmDialog
          title="Delete this event?"
          confirmLabel="Delete Event"
          pendingLabel="Deleting…"
          pending={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setOpen(false)}
        >
          <span className="font-bold text-foreground">{eventName}</span> and all of its points across every week will
          be permanently deleted. This can&apos;t be undone.
        </ConfirmDialog>
      )}
    </>
  );
}
