// Brand mark: a simple leaf with a cut-out vein.
export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`shrink-0 text-leaf ${className}`}>
      <g transform="rotate(-24 16 16)">
        <path d="M16 3C9 8 7 15 9.5 21.5 11 25.5 13.5 27.5 16 27.5s5-2 6.5-6C25 15 23 8 16 3Z" fill="currentColor" />
        <path d="M16 27v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <g stroke="var(--surface)" strokeLinecap="round">
          <path d="M16 8v17" strokeWidth="1.6" />
          <path d="M16 14.5l-3.5-3M16 19.5l4-3.5" strokeWidth="1.4" />
        </g>
      </g>
    </svg>
  );
}
