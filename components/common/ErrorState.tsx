import { Button } from "@/components/common/Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-md rounded-3xl border border-danger-soft bg-danger-soft p-5 text-sm text-danger">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-danger/80">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3 text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}
