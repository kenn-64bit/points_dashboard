import { Button } from "@/components/common/Button";

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="mx-auto my-8 max-w-md rounded-panel border border-danger-soft bg-danger-soft p-5 text-sm text-danger">
      <p className="font-extrabold">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3 text-xs">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
