export function Modal({
  children,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-panel border border-border bg-surface p-6 shadow-panel`}>
        {children}
      </div>
    </div>
  );
}
