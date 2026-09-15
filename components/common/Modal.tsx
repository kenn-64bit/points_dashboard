export function Modal({
  children,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-3xl border border-border bg-surface p-6 shadow-2xl`}>
        {children}
      </div>
    </div>
  );
}
