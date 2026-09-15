"use client";

import Link from "next/link";
import { useState } from "react";
import type { Event } from "@/types";
import { CreateEventButton } from "@/components/dashboard/CreateEventButton";

function formatMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EventsList({ events }: { events: Event[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const list = groups.get(event.month) ?? [];
    list.push(event);
    groups.set(event.month, list);
  }
  const months = [...groups.keys()].sort().reverse();

  function toggleMonth(month: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border divide-y divide-border">
      {events.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No events yet — create one below.</p>
      )}
      {months.map((month) => {
        const isOpen = !collapsed.has(month);
        const monthEvents = groups.get(month)!;
        return (
          <div key={month} className={isOpen ? "divide-y divide-border" : ""}>
            <button
              type="button"
              onClick={() => toggleMonth(month)}
              className="flex w-full items-center justify-between bg-surface-muted px-4 py-3 text-left text-lg font-semibold text-foreground transition-colors hover:bg-accent-soft"
            >
              <span className="flex items-center gap-2.5">
                {formatMonthLabel(month)}
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {monthEvents.length}
                </span>
              </span>
              <ChevronIcon open={isOpen} />
            </button>
            {isOpen &&
              monthEvents.map((event) => (
                <Link
                  key={event.event_id}
                  href={`/dashboard/events/${event.event_id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent-soft"
                >
                  <span className="font-medium text-foreground">{event.event_name}</span>
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-muted-foreground"
                  >
                    ›
                  </span>
                </Link>
              ))}
          </div>
        );
      })}
      <CreateEventButton variant="row" />
    </div>
  );
}
