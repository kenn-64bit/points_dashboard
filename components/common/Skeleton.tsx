// A pulsing placeholder bar. Size and shape come from `className`, which can
// also swap the color with its own `bg-*`.
export function Skeleton({ className = "" }: { className?: string }) {
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-surface-muted";
  return <span aria-hidden className={`block rounded-md motion-safe:animate-pulse ${bg} ${className}`} />;
}

// Wraps a page's skeleton so screen readers hear one "loading" message
// instead of a pile of empty shapes.
export function SkeletonRegion({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// The back link and page title every dashboard page starts with.
export function PageHeaderSkeleton({ back = true, titleWidth = "w-48" }: { back?: boolean; titleWidth?: string }) {
  return (
    <>
      {back && <Skeleton className="mb-4 h-9 w-36 rounded-full" />}
      <Skeleton className={`mb-6 h-8 sm:h-9 ${titleWidth}`} />
    </>
  );
}

// Placeholder text for a Panel's orange label pill: pass it as `label`.
export function SkeletonLabel({ className = "w-14" }: { className?: string }) {
  return <Skeleton className={`h-3 bg-accent-soft ${className}`} />;
}
