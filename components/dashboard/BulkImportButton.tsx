"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { UploadIcon } from "@/components/common/icons";
import { Badge } from "@/components/common/Badge";
import { inputClasses } from "@/components/common/Field";
import { hasAllowedExtension, isWithinMaxSize, ALLOWED_IMPORT_EXTENSIONS } from "@/lib/validation";
import { formatWeekLabel } from "@/lib/week";
import type { BulkImportResult } from "@/types";

export function BulkImportButton({
  eventId,
  week,
  weekNumber,
  onImported,
}: {
  eventId: string;
  week: string;
  weekNumber: number;
  onImported: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!hasAllowedExtension(selected.name)) {
      showToast(`Invalid file type. Allowed: ${ALLOWED_IMPORT_EXTENSIONS.join(", ")}`, "error");
      e.target.value = "";
      setFile(null);
      return;
    }
    if (!isWithinMaxSize(selected.size)) {
      showToast("File too large. Max 5MB.", "error");
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleImport() {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("event_id", eventId);
      formData.append("week_date", week);

      const res = await fetch("/api/users/bulk-import", { method: "POST", body: formData });
      const body: Partial<BulkImportResult> & { error?: string } = await res.json();
      if (!res.ok && body.imported === undefined) throw new Error(body.error ?? "Import failed");

      const importResult = body as BulkImportResult;
      setResult(importResult);
      if (importResult.imported > 0) {
        showToast(body.success ? "Import complete" : "Import finished with some errors", body.success ? "success" : "error");
        onImported();
        router.refresh();
      }
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <IconButton label="Import CSV/Excel" tone="primary" onClick={() => setOpen(true)}>
        <UploadIcon />
      </IconButton>

      {open && (
        <Modal maxWidth="max-w-lg">
          <h3 className="text-lg font-extrabold text-foreground">Import Users &amp; Points</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a .csv or .xlsx file for <span className="font-bold text-foreground">{formatWeekLabel(weekNumber, week)}</span>.
            New usernames are created automatically.
          </p>

          {!result && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMPORT_EXTENSIONS.join(",")}
                onChange={handleFileChange}
                aria-label="File to import"
                className={`mt-4 ${inputClasses} file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-foreground`}
              />
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleImport} disabled={!file || submitting}>
                  {submitting ? "Importing…" : "Import"}
                </Button>
              </div>
            </>
          )}

          {result && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="primary">{result.imported} imported</Badge>
                <Badge tone="neutral">{result.created_users} new users</Badge>
                <Badge tone="neutral">{result.updated_users} points saved</Badge>
                {result.failed > 0 && <Badge tone="danger">{result.failed} failed</Badge>}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 max-h-48 divide-y divide-dashed divide-line overflow-y-auto rounded-field border border-border bg-surface-muted">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-3.5 py-2 text-xs text-muted-foreground">
                      Row {e.row}: {e.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={closeModal}>
                  Close
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
