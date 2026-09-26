import { Loading } from "@/components/common/Loading";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Loading label="Loading events…" />
    </div>
  );
}
