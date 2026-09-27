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
      className={`flex items-center gap-2 rounded-full border border-control-border bg-control px-3.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-accent-soft ${className}`}
    >
      {children}
      <ChevronDownIcon open={open} />
    </button>
  );
}

interface MenuPanelProps extends HTMLAttributes<HTMLDivElement> {
  // Which edge of the parent the panel lines up with; `end` for triggers at
  // the right of the screen.
  align?: "start" | "end";
}

// Floating panel anchored below its (relative) parent.
export function MenuPanel({ children, align = "start", className = "", ...props }: MenuPanelProps) {
  return (
    <div
      {...props}
      className={`absolute top-full z-20 mt-2 overflow-hidden rounded-field border border-border bg-surface shadow-panel ${
        align === "end" ? "right-0" : "left-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function MenuList({ children }: { children: React.ReactNode }) {
  return <div className="max-h-72 divide-y divide-dashed divide-line overflow-y-auto">{children}</div>;
}

// One option row. The orange dot marks the current choice ("you are here");
// `leading` and `trailing` hold optional controls beside it, such as a
// checkbox or a remove button, that don't select the option.
export function MenuItem({
  selected,
  onSelect,
  children,
  leading,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center transition-colors hover:bg-accent-soft">
      {leading}
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className={`flex flex-1 items-center gap-2 px-3.5 py-2 text-left text-sm ${
          selected ? "font-extrabold text-accent-ink" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-accent-ink" : ""}`} />
        {children}
      </button>
      {trailing}
    </div>
  );
}
