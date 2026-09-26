"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/common/ErrorState";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState message={error.message || "An unexpected error occurred."} onRetry={reset} retryLabel="Try again" />;
}
