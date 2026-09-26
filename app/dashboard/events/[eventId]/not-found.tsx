import Link from "next/link";
import { buttonClasses } from "@/components/common/Button";
import { Panel } from "@/components/common/Panel";

export default function EventNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/dashboard" className={buttonClasses("ghost", "mb-4")}>
        ← Back to events
      </Link>
      <Panel className="mx-auto my-8 max-w-md" bodyClassName="p-5 text-sm">
        <p className="font-extrabold text-foreground">Event not found</p>
        <p className="mt-1 text-muted-foreground">This event doesn&apos;t exist, or may have been deleted.</p>
      </Panel>
    </div>
  );
}
