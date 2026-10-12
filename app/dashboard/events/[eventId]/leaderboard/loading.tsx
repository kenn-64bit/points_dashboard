import { PageHeaderSkeleton, SkeletonRegion } from "@/components/common/Skeleton";
import { LeaderboardSkeleton } from "@/components/dashboard/Leaderboard";

export default function LeaderboardLoading() {
  return (
    <SkeletonRegion label="Loading leaderboard…" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeaderSkeleton titleWidth="w-44" />
      <LeaderboardSkeleton />
    </SkeletonRegion>
  );
}
