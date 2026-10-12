import { PageHeaderSkeleton, Skeleton, SkeletonRegion } from "@/components/common/Skeleton";
import { TeamManagerSkeleton } from "@/components/team/TeamManager";

export default function TeamLoading() {
  return (
    <SkeletonRegion label="Loading team…" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeaderSkeleton titleWidth="w-24" />
      <Skeleton className="-mt-4 mb-8 h-4 w-80 max-w-full" />
      <TeamManagerSkeleton />
    </SkeletonRegion>
  );
}
