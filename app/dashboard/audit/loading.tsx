import { Loading } from "@/components/common/Loading";

export default function AuditLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <Loading label="Loading audit log…" />
    </div>
  );
}
