"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatWeekRange, getCurrentWeekMonday, getWeeksBetween, normalizeToMonday } from "@/lib/week";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MenuItem, MenuList, MenuPanel, SelectTrigger } from "@/components/common/Select";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Scalloped bottom edge of the calendar header, filled with the body color.
const WAVE_PATH = `M0 10 V5 ${Array.from({ length: 12 }, (_, i) => `Q${i * 10 + 5} ${i % 2 ? 9 : 1} ${i * 10 + 10} 5`).join(" ")} V10 Z`;

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

// Weeks are owned by the caller (newest first) so the page can count and
// number them; this component picks, adds and removes them.
export function WeekSelector({
  eventId,
  weeks,
  onWeeksChange,
  weekNumber,
  selectedWeek,
  onChange,
}: {
  eventId: string;
  weeks: string[];
  onWeeksChange: (weeks: string[]) => void;
  weekNumber: (week: string) => number;
  selectedWeek: string;
  onChange: (week: string) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(`${selectedWeek}T00:00:00Z`));
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [weekPendingRemoval, setWeekPendingRemoval] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    onWeeksChange([...new Set([...weeks, ...weeksToAdd])].sort().reverse());
    onChange(weeksToAdd[0]); // earliest week in the picked range
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
      onWeeksChange(remaining.length ? remaining : [fallback]);
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
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

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
          <MenuPanel className="w-72">
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
                  <span className="text-xs font-bold text-muted-foreground">Week {weekNumber(week)}</span>
                  {formatWeekRange(week)}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPanel>
        )}
      </div>

      <div className="relative">
        <Button type="button" variant="secondary" onClick={openCalendar}>
          Add Week
        </Button>
        {calendarOpen && (
          <MenuPanel
            className="w-[21rem] rounded-panel max-sm:fixed max-sm:inset-x-4 max-sm:top-auto max-sm:w-auto"
            onMouseLeave={() => setHoverDate(null)}
          >
            <div className="cal-dots relative bg-cal-header px-3 pb-4 pt-2.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={viewingCurrentMonth}
                  aria-label="Previous month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-cal-cell text-base font-extrabold text-cal-title shadow-sm transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ‹
                </button>
                <div className="text-center leading-none">
                  <div className="text-2xl font-extrabold tracking-tight text-cal-title">{monthName}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-cal-title/80">{viewDate.getUTCFullYear()}</div>
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-cal-cell text-base font-extrabold text-cal-title shadow-sm transition-colors hover:bg-surface"
                >
                  ›
                </button>
              </div>
              <svg
                aria-hidden
                viewBox="0 0 120 10"
                preserveAspectRatio="none"
                className="absolute inset-x-0 -bottom-px h-3 w-full fill-cal-body"
              >
                <path d={WAVE_PATH} />
              </svg>
            </div>

            <div className="cal-dots bg-cal-body px-3 pb-3 pt-1.5">
              <div className="mb-2 grid grid-cols-2 gap-2">
                {[
                  { label: "Start", value: pickStart, active: !pickStart },
                  { label: "End", value: pickEnd, active: !!pickStart && !pickEnd },
                ].map((step) => (
                  <div
                    key={step.label}
                    className={`rounded-field border-2 bg-cal-cell px-2.5 py-1 transition-colors ${
                      step.active ? "border-primary" : step.value ? "border-transparent" : "border-dashed border-cal-pill"
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{step.label}</div>
                    <div className={`text-sm font-extrabold ${step.value ? "text-foreground" : step.active ? "text-primary" : "text-muted-foreground"}`}>
                      {step.value ? formatShortDate(step.value) : step.active ? "Pick a date" : "—"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label} className="rounded-full bg-cal-pill py-0.5 text-[10px] font-extrabold text-cal-pill-ink">
                    {label}
                  </span>
                ))}
                {calendarDays.map((date) => {
                  const dateStr = formatDate(date);
                  const inCurrentMonth = date.getUTCMonth() === viewDate.getUTCMonth();
                  const inRange = !!rangeLo && !!rangeHi && dateStr >= rangeLo && dateStr <= rangeHi;
                  const isEndpoint = dateStr === rangeLo || dateStr === rangeHi;
                  const isPast = dateStr < today;
                  const isToday = dateStr === today;

                  const tile = isEndpoint
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : inRange
                      ? "bg-primary-soft text-cal-cell-ink ring-1 ring-primary/40"
                      : isPast
                        ? "bg-cal-cell/60 text-muted-foreground"
                        : `bg-cal-cell shadow-sm hover:ring-2 hover:ring-primary ${inCurrentMonth ? "text-cal-cell-ink" : "text-muted-foreground"}`;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isPast}
                      title={isPast ? "Past dates can't be added" : undefined}
                      aria-pressed={isEndpoint}
                      onMouseEnter={() => !isPast && setHoverDate(dateStr)}
                      onClick={() => handleDayClick(date)}
                      className={`relative flex h-9 flex-col items-center rounded-lg pt-1.5 text-sm font-extrabold tabular-nums transition-colors disabled:cursor-not-allowed ${tile}`}
                    >
                      {date.getUTCDate()}
                      {isToday && !isEndpoint && (
                        <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-full bg-cal-cell/80 py-1 pl-3 pr-1">
                <span className="text-xs font-bold text-muted-foreground">
                  {pickedWeekCount > 0 ? `${pickedWeekCount} ${pickedWeekCount === 1 ? "week" : "weeks"}` : "Pick a start and end"}
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
