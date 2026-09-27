import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";

function WarningIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="mt-0.5 h-8 w-8 shrink-0 text-danger-ink">
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
  );
}

// Confirmation step for destructive, irreversible actions.
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal>
      <div className="flex items-start gap-3">
        <WarningIcon />
        <div>
          <h3 className="text-lg font-extrabold text-foreground">{title}</h3>
          <div className="mt-1 text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={pending}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
