// The Island card: a cream panel with an optional orange label pill sitting
// on its top edge. The label lives outside the clipped body so it can
// overlap the border, while the body stays overflow-hidden for rounded rows.
export function Panel({
  children,
  label,
  className = "",
  bodyClassName = "",
}: {
  children: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`relative ${label ? "pt-3" : ""} ${className}`}>
      {label && (
        <span className="absolute left-6 top-0 z-10 rounded-full bg-accent px-3 py-1 text-xs font-extrabold leading-none text-accent-foreground shadow-sm">
          {label}
        </span>
      )}
      <div className={`overflow-hidden rounded-panel border border-border bg-surface shadow-panel ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
