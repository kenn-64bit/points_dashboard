import Link from "next/link";
import { buttonClasses } from "@/components/common/Button";

export default function EventNotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      <div className="mx-auto my-8 max-w-md rounded-3xl border border-border bg-surface-muted p-5 text-sm">
        <p className="font-medium text-foreground">Event not found</p>
        <p className="mt-1 text-muted-foreground">
          This event doesn&apos;t exist, or may have been deleted.
        </p>
      </div>
    </div>
  );
}
