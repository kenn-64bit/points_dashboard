import { Skeleton, SkeletonRegion } from "@/components/common/Skeleton";
import { EventWorkspaceSkeleton } from "@/components/dashboard/EventWorkspace";

export default function EventDetailLoading() {
  return (
    <SkeletonRegion label="Loading event…" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-4 h-9 w-36 rounded-full" />
      <EventWorkspaceSkeleton />
    </SkeletonRegion>
  );
}
