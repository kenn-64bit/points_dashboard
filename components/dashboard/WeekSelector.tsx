"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatWeekRange, getCurrentWeekMonday, getWeeksBetween, normalizeToMonday } from "@/lib/week";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/common/Button";
import { useCanEdit } from "@/components/auth/RoleProvider";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TrashIcon } from "@/components/common/icons";
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

type PickStep = "start" | "end";

// Weeks are owned by the caller (oldest first, so Week 1 is on top) so the
// page can count and number them; this component picks, adds and removes them.
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
  const editable = useCanEdit();
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(`${selectedWeek}T00:00:00Z`));
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  // Which date the next day click sets; null once both are picked.
  const [activeStep, setActiveStep] = useState<PickStep | null>("start");
  const [adding, setAdding] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  // Weeks ticked in the dropdown for a bulk delete; cleared whenever it closes.
  const [checkedWeeks, setCheckedWeeks] = useState<Set<string>>(() => new Set());
  const [weeksPendingRemoval, setWeeksPendingRemoval] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !calendarOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeWeekMenu();
        setCalendarOpen(false);
        cancelPicking();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, calendarOpen]);

  function closeWeekMenu() {
    setOpen(false);
    setCheckedWeeks(new Set());
  }

  function toggleChecked(week: string) {
    setCheckedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }

  function handleSelect(week: string) {
    onChange(week);
    closeWeekMenu();
  }

  function openCalendar() {
    const todayStr = formatDate(new Date());
    setViewDate(new Date(`${selectedWeek < todayStr ? todayStr : selectedWeek}T00:00:00Z`));
    setCalendarOpen((o) => !o);
    closeWeekMenu();
    cancelPicking();
  }

  function shiftMonth(delta: number) {
    setViewDate((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1)));
  }

  function cancelPicking() {
    setPickStart(null);
    setPickEnd(null);
    setActiveStep("start");
    setHoverDate(null);
  }

  // Exact dates: a day click sets whichever of Start/End is active (clicking
  // a card makes it active), then moves on to the one still missing. If the
  // end lands before the start they swap. Once both are set, the next click
  // starts a new range. Nothing is added until the range is confirmed.
  function handleDayClick(date: Date) {
    const clicked = formatDate(date);
    if (clicked < formatDate(new Date())) return;
    let start = pickStart;
    let end = pickEnd;
    if (activeStep === null) {
      start = clicked;
      end = null;
    } else if (activeStep === "start") {
      start = clicked;
    } else {
      end = clicked;
    }
    if (start && end && end < start) [start, end] = [end, start];
    setPickStart(start);
    setPickEnd(end);
    setActiveStep(!start ? "start" : !end ? "end" : null);
  }

  // Saved on the server first, so added weeks survive a reload even before
  // they have any points.
  async function confirmRange() {
    if (!pickStart || !pickEnd) return;
    const weeksToAdd = getWeeksBetween(normalizeToMonday(pickStart), normalizeToMonday(pickEnd));
    setAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/weeks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: weeksToAdd }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add weeks");
      }
      onWeeksChange([...new Set([...weeks, ...weeksToAdd])].sort());
      onChange(weeksToAdd[0]); // earliest week in the picked range
      showToast(`Added ${formatShortDate(pickStart)} – ${formatShortDate(pickEnd)}`);
      cancelPicking();
      setCalendarOpen(false);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }

  // One request for any number of weeks, whether from a row's trash icon or
  // the checked rows.
  async function handleConfirmRemove() {
    if (!weeksPendingRemoval) return;
    const removed = new Set(weeksPendingRemoval);
    const count = removed.size;
    setRemoving(true);
    try {
      const query = new URLSearchParams([...removed].map((w) => ["week", w]));
      const res = await fetch(`/api/events/${eventId}/weeks?${query}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete ${count === 1 ? "week" : "weeks"}`);
      }
      const remaining = weeks.filter((w) => !removed.has(w));
      const fallback = remaining.at(-1) ?? getCurrentWeekMonday();
      onWeeksChange(remaining.length ? remaining : [fallback]);
      if (removed.has(selectedWeek)) onChange(fallback);
      setCheckedWeeks((prev) => new Set([...prev].filter((w) => !removed.has(w))));
      showToast(count === 1 ? "Week deleted" : `${count} weeks deleted`);
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRemoving(false);
      setWeeksPendingRemoval(null);
    }
  }

  const calendarDays = buildCalendarGrid(viewDate);
  // Past dates can't be picked — ranges start today at the earliest.
  const today = formatDate(new Date());
  const viewingCurrentMonth = formatDate(viewDate).slice(0, 7) <= today.slice(0, 7);
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

  // Only the dates the user actually picks are highlighted: the start, the
  // end, and the days in between. While choosing, the hovered day stands in
  // for whichever date is active.
  const previewStart = activeStep === "start" && hoverDate ? hoverDate : pickStart;
  const previewEnd = activeStep === "end" && hoverDate ? hoverDate : pickEnd;
  const picked = [previewStart, previewEnd].filter((d): d is string => !!d).sort();
  const rangeLo = picked[0] ?? null;
  const rangeHi = picked.at(-1) ?? null;
  const pickedWeekCount =
    pickStart && pickEnd ? getWeeksBetween(normalizeToMonday(pickStart), normalizeToMonday(pickEnd)).length : 0;

  // Oldest first, like `weeks`; checks on weeks that are gone don't count.
  const checkedList = weeks.filter((w) => checkedWeeks.has(w));
  const allChecked = weeks.length > 0 && checkedList.length === weeks.length;
  const pendingCount = weeksPendingRemoval?.length ?? 0;

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <SelectTrigger
          open={open}
          onClick={() => {
            if (open) closeWeekMenu();
            else setOpen(true);
            setCalendarOpen(false);
          }}
        >
          {formatWeekRange(selectedWeek)}
        </SelectTrigger>
        {open && (
          <MenuPanel className={editable ? "w-80 max-w-[calc(100vw-2rem)]" : "w-72"}>
            <MenuList>
              {weeks.map((week) => {
                const label = `Week ${weekNumber(week)} (${formatWeekRange(week)})`;
                return (
                  <MenuItem
                    key={week}
                    selected={week === selectedWeek}
                    onSelect={() => handleSelect(week)}
                    leading={
                      editable && (
                        <label className="flex cursor-pointer items-center self-stretch pl-3.5">
                          <input
                            type="checkbox"
                            checked={checkedWeeks.has(week)}
                            onChange={() => toggleChecked(week)}
                            aria-label={`Select ${label} for deletion`}
                            className="h-4 w-4 cursor-pointer accent-primary-ink"
                          />
                        </label>
                      )
                    }
                    trailing={
                      editable && (
                        <button
                          type="button"
                          onClick={() => setWeeksPendingRemoval([week])}
                          title="Delete week"
                          aria-label={`Delete ${label}`}
                          className="px-3.5 py-2 text-muted-foreground transition-colors hover:text-danger-ink"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )
                    }
                  >
                    <span className="text-xs font-bold text-muted-foreground">Week {weekNumber(week)}</span>
                    {formatWeekRange(week)}
                  </MenuItem>
                );
              })}
            </MenuList>
            {editable && (
              <div className="flex items-center justify-between gap-2 border-t border-border py-1.5 pl-3.5 pr-1.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = checkedList.length > 0 && !allChecked;
                    }}
                    onChange={() => setCheckedWeeks(allChecked ? new Set() : new Set(weeks))}
                    aria-label="Select all weeks"
                    className="h-4 w-4 cursor-pointer accent-primary-ink"
                  />
                  {checkedList.length > 0
                    ? `${checkedList.length} ${checkedList.length === 1 ? "week" : "weeks"} selected`
                    : "Select weeks to delete"}
                </label>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setWeeksPendingRemoval(checkedList)}
                  disabled={checkedList.length === 0}
                  className="px-3 py-1.5 text-xs"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete{checkedList.length > 0 ? ` (${checkedList.length})` : ""}
                </Button>
              </div>
            )}
          </MenuPanel>
        )}
      </div>

      {editable && (
        <div className="relative">
          <Button type="button" variant="primary" onClick={openCalendar}>
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
                  {(
                    [
                      { step: "start", label: "Start", value: pickStart },
                      { step: "end", label: "End", value: pickEnd },
                    ] as const
                  ).map(({ step, label, value }) => {
                    const active = activeStep === step;
                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => setActiveStep(step)}
                        aria-pressed={active}
                        aria-label={`${label} date: ${value ? formatShortDate(value) : "not set"}. Click, then pick a day.`}
                        className={`rounded-field border-2 bg-cal-cell px-2.5 py-1 text-left transition-colors hover:border-primary-ink/60 ${
                          active ? "border-primary-ink" : value ? "border-transparent" : "border-dashed border-cal-pill"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
                        <div className={`text-sm font-extrabold ${active ? "text-primary-ink" : value ? "text-foreground" : "text-muted-foreground"}`}>
                          {value ? formatShortDate(value) : active ? "Pick a date" : "—"}
                        </div>
                      </button>
                    );
                  })}
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
                      ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary-ink"
                      : inRange
                        ? "bg-primary-soft text-cal-cell-ink ring-1 ring-primary-ink/40"
                        : isPast
                          ? "bg-cal-cell/60 text-muted-foreground"
                          : `bg-cal-cell shadow-sm hover:ring-2 hover:ring-primary-ink ${inCurrentMonth ? "text-cal-cell-ink" : "text-muted-foreground"}`;

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
                          <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-ink" />
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
                    <Button type="button" variant="secondary" onClick={cancelPicking} disabled={!pickStart && !pickEnd} className="px-3 py-1.5 text-xs">
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={confirmRange}
                      disabled={!pickStart || !pickEnd || adding}
                      className="px-3 py-1.5 text-xs"
                    >
                      {adding ? "Adding…" : "Add weeks"}
                    </Button>
                  </div>
                </div>
              </div>
            </MenuPanel>
          )}
        </div>
      )}

      {weeksPendingRemoval && (
        <ConfirmDialog
          title={pendingCount === 1 ? "Delete this week?" : `Delete ${pendingCount} weeks?`}
          confirmLabel={pendingCount === 1 ? "Delete Week" : `Delete ${pendingCount} Weeks`}
          pendingLabel="Deleting…"
          pending={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setWeeksPendingRemoval(null)}
        >
          {pendingCount === 1 ? (
            <>
              All points for{" "}
              <span className="font-bold text-foreground">
                Week {weekNumber(weeksPendingRemoval[0])} · {formatWeekRange(weeksPendingRemoval[0])}
              </span>{" "}
              will be permanently deleted. This can&apos;t be undone.
            </>
          ) : (
            <>
              All points for these {pendingCount} weeks will be permanently deleted. This can&apos;t be undone.
              <ul className="mt-3 max-h-40 divide-y divide-dashed divide-line overflow-y-auto rounded-field border border-border">
                {weeksPendingRemoval.map((week) => (
                  <li key={week} className="flex items-baseline gap-2 px-3 py-1.5">
                    <span className="text-xs font-bold">Week {weekNumber(week)}</span>
                    <span className="font-bold text-foreground">{formatWeekRange(week)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
