"use client";

import Link from "next/link";
import { useState } from "react";
import type { Event } from "@/types";
import { CreateEventButton } from "@/components/dashboard/CreateEventButton";
import { Panel } from "@/components/common/Panel";
import { Badge } from "@/components/common/Badge";
import { ChevronDownIcon } from "@/components/common/Select";

function formatMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
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
    <Panel
      label={`${events.length} ${events.length === 1 ? "event" : "events"}`}
      bodyClassName="divide-y divide-border"
    >
      {events.length === 0 && (
        <p className="px-5 py-4 text-sm text-muted-foreground">No events yet — create one below.</p>
      )}
      {months.map((month) => {
        const isOpen = !collapsed.has(month);
        const monthEvents = groups.get(month)!;
        return (
          <div key={month} className={isOpen ? "divide-y divide-dashed divide-line" : ""}>
            <button
              type="button"
              onClick={() => toggleMonth(month)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between bg-surface-muted px-5 py-3 text-left text-lg font-extrabold text-foreground transition-colors hover:bg-accent-soft"
            >
              <span className="flex items-center gap-2.5">
                {formatMonthLabel(month)}
                <Badge className="bg-surface py-0.5 text-muted-foreground">{monthEvents.length}</Badge>
              </span>
              <ChevronDownIcon open={isOpen} />
            </button>
            {isOpen &&
              monthEvents.map((event) => (
                <Link
                  key={event.event_id}
                  href={`/dashboard/events/${event.event_id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-accent-soft"
                >
                  <span className="font-bold text-foreground group-hover:text-accent-ink">{event.event_name}</span>
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted font-bold text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                  >
                    ›
                  </span>
                </Link>
              ))}
          </div>
        );
      })}
      <CreateEventButton variant="row" />
    </Panel>
  );
}
