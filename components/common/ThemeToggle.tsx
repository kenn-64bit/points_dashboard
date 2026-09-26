"use client";

import { useTheme } from "@/components/common/ThemeProvider";

function SunIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
      </g>
    </svg>
  );
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
    </svg>
  );
}

// Day/Night switch. The knob's position and icon are driven by the
// `data-theme` attribute (via the `dark:` variant) rather than React state,
// so they're correct on first paint instead of animating into place after
// hydration — this is the one component allowed to use `dark:` (see DESIGN.md).
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Night mode"
      title={isDark ? "Switch to day" : "Switch to night"}
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-surface-muted px-0.5 transition-colors hover:bg-accent-soft"
    >
      <SunIcon className="absolute left-2 h-3.5 w-3.5 text-muted-foreground/50" />
      <MoonIcon className="absolute right-2 h-3.5 w-3.5 text-muted-foreground/50" />
      <span className="relative flex h-6.5 w-6.5 items-center justify-center rounded-full border border-border bg-surface shadow-sm transition-transform duration-200 ease-out dark:translate-x-6">
        <SunIcon className="h-4 w-4 text-accent-ink dark:hidden" />
        <MoonIcon className="hidden h-4 w-4 text-accent-ink dark:block" />
      </span>
    </button>
  );
}
