import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function ChevronDownIcon({ open = false, className = "" }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""} ${className}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface SelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  open: boolean;
}

export function SelectTrigger({ open, children, className = "", ...props }: SelectTriggerProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      {...props}
      className={`flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent-soft ${className}`}
    >
      {children}
      <ChevronDownIcon open={open} />
    </button>
  );
}

// Floating panel anchored below its (relative) parent.
export function MenuPanel({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`absolute left-0 top-full z-20 mt-2 overflow-hidden rounded-field border border-border bg-surface shadow-panel ${className}`}
    >
      {children}
    </div>
  );
}

export function MenuList({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 divide-y divide-dashed divide-line overflow-y-auto">{children}</div>;
}

// One option row. The orange dot marks the current choice ("you are here");
// `trailing` holds an optional secondary action such as a remove button.
export function MenuItem({
  selected,
  onSelect,
  children,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center transition-colors hover:bg-accent-soft">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={`flex flex-1 items-center gap-2 px-3.5 py-2 text-left text-sm ${
          selected ? "font-extrabold text-accent-ink" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-accent" : ""}`} />
        {children}
      </button>
      {trailing}
    </div>
  );
}
