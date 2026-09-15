"use client";

import { useEffect } from "react";
import { Button } from "@/components/common/Button";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto my-8 max-w-md rounded-3xl border border-danger-soft bg-danger-soft p-5 text-sm text-danger">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-danger/80">{error.message || "An unexpected error occurred."}</p>
      <Button variant="secondary" onClick={reset} className="mt-3 text-xs">
        Try again
      </Button>
    </div>
  );
}
