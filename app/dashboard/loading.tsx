import { PageHeaderSkeleton, SkeletonRegion } from "@/components/common/Skeleton";
import { EventsListSkeleton } from "@/components/dashboard/EventsList";

export default function DashboardLoading() {
  return (
    <SkeletonRegion
      label="Loading events…"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16"
    >
      <PageHeaderSkeleton back={false} titleWidth="w-32" />
      <EventsListSkeleton />
    </SkeletonRegion>
  );
}
