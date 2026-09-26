import { Loading } from "@/components/common/Loading";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
      <Loading label="Loading events…" />
    </div>
  );
}
