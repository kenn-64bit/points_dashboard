export function Modal({
  children,
  maxWidth = "max-w-sm",
  bare = false,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  // Skip the surface panel so the content can bring its own card.
  bare?: boolean;
  // When set, clicking the backdrop closes the modal.
  onClose?: () => void;
  labelledBy?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex overflow-y-auto bg-overlay p-4"
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`m-auto w-full ${maxWidth} ${bare ? "" : "rounded-panel border border-border bg-surface p-6 shadow-panel"}`}
      >
        {children}
      </div>
    </div>
  );
}
