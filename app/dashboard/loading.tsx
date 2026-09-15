import { Loading } from "@/components/common/Loading";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Loading label="Loading events…" />
    </div>
  );
}
