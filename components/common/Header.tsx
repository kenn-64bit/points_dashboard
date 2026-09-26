import Link from "next/link";
import { LeafMark } from "@/components/common/LeafMark";

// App top bar: brand on the left, whatever the caller passes (account,
// theme switch…) on the right.
export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 rounded-full border border-border bg-surface py-1.5 pl-3 pr-1.5 shadow-panel">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-full pr-2 text-base font-extrabold tracking-tight text-foreground">
          <LeafMark className="h-7 w-7" />
          Points Manager
        </Link>
        {children && <div className="flex min-w-0 items-center gap-1.5">{children}</div>}
      </header>
    </div>
  );
}
