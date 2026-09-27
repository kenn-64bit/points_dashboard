"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/components/common/Button";

// A header nav pill. On its own page (or one below it) it turns orange —
// "you are here" — and is marked as the current page for screen readers.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // `!` so the active colors beat the ghost variant's own hover colors.
      className={buttonClasses("ghost", `px-3 py-1.5 ${active ? "bg-accent-soft! text-accent-ink!" : ""}`)}
    >
      {children}
    </Link>
  );
}
