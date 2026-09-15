"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";

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
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Event
      </Button>

      {open && (
        <Modal>
          <div className="flex items-start gap-3">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 h-8 w-8 shrink-0 text-danger"
            >
              <path
                d="M12 3.5 2 20.5h20L12 3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.12"
              />
              <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="17.25" r="0.9" fill="currentColor" />
            </svg>
            <div>
              <h3 className="text-base font-semibold text-foreground">Delete this event?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{eventName}</span> and all of its points across every
                week will be permanently deleted. This can&apos;t be undone.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Event"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
