import { PageHeaderSkeleton, Skeleton, SkeletonRegion } from "@/components/common/Skeleton";
import { AuditLogSkeleton } from "@/components/dashboard/AuditLog";

export default function AuditLoading() {
  return (
    <SkeletonRegion label="Loading audit log…" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeaderSkeleton titleWidth="w-40" />
      <Skeleton className="-mt-4 mb-6 h-4 w-96 max-w-full" />
      <AuditLogSkeleton />
    </SkeletonRegion>
  );
}
