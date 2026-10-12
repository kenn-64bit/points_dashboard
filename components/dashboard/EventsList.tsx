"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Event } from "@/types";
import { CreateEventButton } from "@/components/dashboard/CreateEventButton";
import { useCanEdit } from "@/components/auth/RoleProvider";
import { EventTypePill, eventTypeOf } from "@/components/dashboard/eventType";
import { Panel } from "@/components/common/Panel";
import { Skeleton, SkeletonLabel } from "@/components/common/Skeleton";
import { Badge } from "@/components/common/Badge";
import { ChevronDownIcon } from "@/components/common/Select";

// Loaded on first open, so its code isn't part of the page's initial JS.
const EventPassModal = dynamic(() => import("@/components/dashboard/EventPassModal").then((m) => m.EventPassModal), {
  ssr: false,
});

function formatMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function EventsList({ events }: { events: Event[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [passEvent, setPassEvent] = useState<Event | null>(null);
  const editable = useCanEdit();

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
    <>
      <Panel
        label={`${events.length} ${events.length === 1 ? "event" : "events"}`}
        bodyClassName="divide-y divide-border"
      >
        {events.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted-foreground">{editable ? "No events yet — create one below." : "No events yet."}</p>
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
                  <button
                    key={event.event_id}
                    type="button"
                    onClick={() => setPassEvent(event)}
                    className="group flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-accent-soft"
                  >
                    <span className="min-w-0 truncate font-bold text-foreground group-hover:text-accent-ink">
                      {event.event_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <EventTypePill type={eventTypeOf(event)} />
                      <span
                        aria-hidden
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted font-bold text-muted-foreground transition-[background-color,color,transform] duration-150 group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-primary-foreground"
                      >
                        ›
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
        {editable && <CreateEventButton variant="row" />}
      </Panel>
      {passEvent && (
        <EventPassModal event={passEvent} onClose={() => setPassEvent(null)} onUpdated={setPassEvent} />
      )}
    </>
  );
}

// Two months of events, shaped like the list.
export function EventsListSkeleton() {
  const months = [3, 2];
  return (
    <Panel label={<SkeletonLabel />} bodyClassName="divide-y divide-border">
      {months.map((count, m) => (
        <div key={m} className="divide-y divide-dashed divide-line">
          <div className="flex items-center justify-between bg-surface-muted px-5 py-3.5">
            <Skeleton className="h-5 w-36 bg-border" />
            <Skeleton className="h-4 w-4 bg-border" />
          </div>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <Skeleton className={`h-4 ${i % 2 ? "w-40" : "w-56"} max-w-full`} />
              <span className="flex shrink-0 items-center gap-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </span>
            </div>
          ))}
        </div>
      ))}
    </Panel>
  );
}
