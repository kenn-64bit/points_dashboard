import Link from "next/link";

export function Header() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
      <header className="flex items-center gap-4 rounded-full border border-border bg-surface px-4 py-2.5 shadow-sm">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-accent-from to-accent-to" />
        </Link>
      </header>
    </div>
  );
}
