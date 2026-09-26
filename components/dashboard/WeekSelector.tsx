"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatWeekRange, getCurrentWeekMonday, getWeeksBetween, normalizeToMonday } from "@/lib/week";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MenuItem, MenuList, MenuPanel, SelectTrigger } from "@/components/common/Select";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function buildCalendarGrid(viewDate: Date): Date[] {
  const first = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1));
  const firstWeekday = first.getUTCDay() === 0 ? 7 : first.getUTCDay(); // Mon=1..Sun=7
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - (firstWeekday - 1));

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function WeekSelector({
  eventId,
  selectedWeek,
  onChange,
}: {
  eventId: string;
  selectedWeek: string;
  onChange: (week: string) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(`${selectedWeek}T00:00:00Z`));
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [addedRange, setAddedRange] = useState<{ start: string; end: string; weeks: number } | null>(null);
  const [weekPendingRemoval, setWeekPendingRemoval] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/weeks`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        const fetched: string[] = body.weeks ?? [];
        const withCurrent = fetched.includes(getCurrentWeekMonday())
          ? fetched
          : [getCurrentWeekMonday(), ...fetched];
        setWeeks(withCurrent);
      })
      .catch(() => {
        if (!cancelled) {
          setWeeks([getCurrentWeekMonday()]);
          showToast("Couldn't load the week list", "error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, showToast]);

  useEffect(() => {
    if (!open && !calendarOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCalendarOpen(false);
        setPickStart(null);
        setPickEnd(null);
        setHoverDate(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, calendarOpen]);

  function handleSelect(week: string) {
    onChange(week);
    setOpen(false);
  }

  function openCalendar() {
    const todayStr = formatDate(new Date());
    setViewDate(new Date(`${selectedWeek < todayStr ? todayStr : selectedWeek}T00:00:00Z`));
    setCalendarOpen((o) => !o);
    setOpen(false);
    setPickStart(null);
    setPickEnd(null);
    setHoverDate(null);
  }

  function shiftMonth(delta: number) {
    setViewDate((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1)));
  }

  function cancelPicking() {
    setPickStart(null);
    setPickEnd(null);
    setHoverDate(null);
  }

  // Exact dates: first click sets the start, second sets the end (order
  // doesn't matter), and nothing is added until the range is confirmed.
  function handleDayClick(date: Date) {
    const clicked = formatDate(date);
    if (clicked < formatDate(new Date())) return;
    if (!pickStart || pickEnd) {
      setPickStart(clicked);
      setPickEnd(null);
      return;
    }
    if (clicked < pickStart) {
      setPickEnd(pickStart);
      setPickStart(clicked);
    } else {
      setPickEnd(clicked);
    }
  }

  function confirmRange() {
    if (!pickStart || !pickEnd) return;
    const weeksToAdd = getWeeksBetween(normalizeToMonday(pickStart), normalizeToMonday(pickEnd));
    setWeeks((prev) => {
      const merged = new Set(prev);
      weeksToAdd.forEach((w) => merged.add(w));
      return [...merged].sort().reverse();
    });
    onChange(weeksToAdd[0]); // earliest week in the picked range
    setAddedRange({ start: pickStart, end: pickEnd, weeks: weeksToAdd.length });
    showToast(`Added ${formatShortDate(pickStart)} – ${formatShortDate(pickEnd)}`);
    cancelPicking();
    setCalendarOpen(false);
  }

  async function handleConfirmRemove() {
    if (!weekPendingRemoval) return;
    const week = weekPendingRemoval;
    setRemoving(true);
    try {
      const res = await fetch(`/api/points?event_id=${eventId}&week_date=${week}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to remove week");
      }
      const remaining = weeks.filter((w) => w !== week);
      const fallback = remaining[0] ?? getCurrentWeekMonday();
      setWeeks(remaining.length ? remaining : [fallback]);
      if (week === selectedWeek) onChange(fallback);
      showToast("Week removed");
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRemoving(false);
      setWeekPendingRemoval(null);
    }
  }

  const calendarDays = buildCalendarGrid(viewDate);
  // Past dates can't be picked — ranges start today at the earliest.
  const today = formatDate(new Date());
  const viewingCurrentMonth = formatDate(viewDate).slice(0, 7) <= today.slice(0, 7);
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  // Only the dates the user actually picks are highlighted: the start, the
  // end (or the hovered day while choosing it), and the days in between.
  const previewEnd = pickEnd ?? (pickStart && hoverDate ? hoverDate : null);
  const rangeLo = pickStart && previewEnd && previewEnd < pickStart ? previewEnd : pickStart;
  const rangeHi = pickStart && previewEnd && previewEnd < pickStart ? pickStart : previewEnd ?? pickStart;
  const pickedWeekCount =
    pickStart && pickEnd ? getWeeksBetween(normalizeToMonday(pickStart), normalizeToMonday(pickEnd)).length : 0;

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <SelectTrigger
          open={open}
          onClick={() => {
            setOpen((o) => !o);
            setCalendarOpen(false);
          }}
        >
          {formatWeekRange(selectedWeek)}
        </SelectTrigger>
        {open && (
          <MenuPanel className="w-64">
            <MenuList>
              {weeks.map((week) => (
                <MenuItem
                  key={week}
                  selected={week === selectedWeek}
                  onSelect={() => handleSelect(week)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setWeekPendingRemoval(week)}
                      title="Remove week"
                      aria-label={`Remove ${formatWeekRange(week)}`}
                      className="px-3.5 py-2 font-bold text-muted-foreground transition-colors hover:text-danger"
                    >
                      ×
                    </button>
                  }
                >
                  {formatWeekRange(week)}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPanel>
        )}
      </div>

      {addedRange && (
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-xs font-bold text-accent-ink">
          {formatShortDate(addedRange.start)} – {formatShortDate(addedRange.end)} · {addedRange.weeks}{" "}
          {addedRange.weeks === 1 ? "week" : "weeks"}
          <button
            type="button"
            onClick={() => setAddedRange(null)}
            aria-label="Dismiss"
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent-soft"
          >
            ×
          </button>
        </span>
      )}

      <div className="relative">
        <Button type="button" variant="secondary" onClick={openCalendar}>
          Add Week
        </Button>
        {calendarOpen && (
          <MenuPanel className="w-72 p-3" onMouseLeave={() => setHoverDate(null)}>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                disabled={viewingCurrentMonth}
                aria-label="Previous month"
                className="disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent flex h-7 w-7 items-center justify-center rounded-full font-bold text-muted-foreground transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                ‹
              </button>
              <span className="text-sm font-extrabold text-foreground">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-muted-foreground transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                ›
              </button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                { label: "Start", value: pickStart, active: !pickStart },
                { label: "End", value: pickEnd, active: !!pickStart && !pickEnd },
              ].map((step) => (
                <div
                  key={step.label}
                  className={`rounded-field border-2 px-3 py-1.5 transition-colors ${
                    step.active
                      ? "border-primary bg-primary-soft"
                      : step.value
                        ? "border-border bg-surface-muted"
                        : "border-dashed border-line"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{step.label}</div>
                  <div className={`text-sm font-extrabold ${step.value ? "text-foreground" : step.active ? "text-primary" : "text-muted-foreground"}`}>
                    {step.value ? formatShortDate(step.value) : step.active ? "Pick a date" : "—"}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="font-bold text-muted-foreground">
                  {label}
                </span>
              ))}
              {calendarDays.map((date) => {
                const dateStr = formatDate(date);
                const inCurrentMonth = date.getUTCMonth() === viewDate.getUTCMonth();
                const inRange = !!rangeLo && !!rangeHi && dateStr >= rangeLo && dateStr <= rangeHi;
                const isEndpoint = dateStr === rangeLo || dateStr === rangeHi;
                const isPast = dateStr < today;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={isPast}
                    title={isPast ? "Past dates can't be added" : undefined}
                    onMouseEnter={() => !isPast && setHoverDate(dateStr)}
                    onClick={() => handleDayClick(date)}
                    className={`py-1 text-foreground transition-colors ${
                      inCurrentMonth ? "" : "text-muted-foreground/50"
                    } ${inRange && !isEndpoint ? "bg-primary-soft" : ""} ${isPast ? "cursor-not-allowed text-muted-foreground/30 line-through" : !isEndpoint ? "rounded-full hover:ring-2 hover:ring-primary" : ""}`}
                  >
                    {isEndpoint ? (
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary font-extrabold text-primary-foreground`}>
                        {date.getUTCDate()}
                      </span>
                    ) : (
                      date.getUTCDate()
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-line pt-3">
              <span className="text-xs font-bold text-muted-foreground">
                {pickedWeekCount > 0 ? `${pickedWeekCount} ${pickedWeekCount === 1 ? "week" : "weeks"}` : ""}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={cancelPicking} disabled={!pickStart} className="px-3 py-1.5 text-xs">
                  Clear
                </Button>
                <Button type="button" variant="primary" onClick={confirmRange} disabled={!pickEnd} className="px-3 py-1.5 text-xs">
                  Add weeks
                </Button>
              </div>
            </div>
          </MenuPanel>
        )}
      </div>

      {weekPendingRemoval && (
        <ConfirmDialog
          title="Remove this week?"
          confirmLabel="Remove Week"
          pendingLabel="Removing…"
          pending={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setWeekPendingRemoval(null)}
        >
          All points for <span className="font-bold text-foreground">{formatWeekRange(weekPendingRemoval)}</span> will
          be permanently deleted. This can&apos;t be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
