import Link from "next/link";
import { LeafMark } from "@/components/common/LeafMark";

// App top bar, pinned while the page scrolls: brand and `nav` links on the
// left, whatever the caller passes (theme switch, account menu…) on the
// right. Below `sm` the nav is hidden, so its links must also be reachable
// from the right-hand items (AccountMenu repeats them).
export function Header({ nav, children }: { nav?: React.ReactNode; children?: React.ReactNode }) {
  return (
    // The wrapper is page-colored so content scrolling under the pinned bar
    // doesn't show through the gap above it.
    <div className="sticky top-0 z-30 mx-auto w-full max-w-5xl bg-background px-4 pt-4 sm:px-6">
      <header className="flex items-center gap-3 rounded-full border border-border bg-surface py-1.5 pl-3 pr-1.5 shadow-panel">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-full pr-1 text-base font-extrabold tracking-tight text-foreground">
          <LeafMark className="h-7 w-7" />
          Points Manager
        </Link>
        {nav && (
          <>
            <span aria-hidden className="hidden h-6 border-l border-dashed border-line sm:block" />
            <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
              {nav}
            </nav>
          </>
        )}
        {children && <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div>}
      </header>
    </div>
  );
}
