"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

// "Sep 27, 14:02" in the viewer's own time zone ("Sep 27, 2025, 14:02" for
// another year). The server doesn't know that zone, so the server render and
// hydration show UTC, labelled as such; React then swaps in local time
// without a hydration mismatch (the same pattern as ThemeProvider).
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const timeZone = inBrowser ? undefined : "UTC";
  const year = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", timeZone });
  const text = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: year(date) === year(new Date()) ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });

  return (
    <time dateTime={iso} title={date.toISOString()} className={className}>
      {inBrowser ? text : `${text} UTC`}
    </time>
  );
}
