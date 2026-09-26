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

function sundayOf(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return formatDate(d);
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
  const [hoverDate, setHoverDate] = useState<string | null>(null);
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
    setViewDate(new Date(`${selectedWeek}T00:00:00Z`));
    setCalendarOpen((o) => !o);
    setOpen(false);
    setPickStart(null);
    setHoverDate(null);
  }

  function shiftMonth(delta: number) {
    setViewDate((prev) => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1)));
  }

  function cancelPicking() {
    setPickStart(null);
    setHoverDate(null);
  }

  function handleDayClick(date: Date) {
    const clickedWeek = normalizeToMonday(formatDate(date));

    if (!pickStart) {
      setPickStart(clickedWeek);
      return;
    }

    const weeksToAdd = getWeeksBetween(pickStart, clickedWeek);
    setWeeks((prev) => {
      const merged = new Set(prev);
      weeksToAdd.forEach((w) => merged.add(w));
      return [...merged].sort().reverse();
    });
    onChange(weeksToAdd[0]); // earliest week in the picked range
    if (weeksToAdd.length > 1) showToast(`Added ${weeksToAdd.length} weeks`);
    setPickStart(null);
    setHoverDate(null);
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
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  // The highlighted span: while picking or hovering, a live teal preview
  // (possibly spanning several weeks); otherwise an orange "you are here"
  // indicator of the currently selected week.
  let rangeStart: string;
  let rangeEnd: string;
  let isActivePreview: boolean;
  if (pickStart) {
    const hoverWeek = hoverDate ? normalizeToMonday(hoverDate) : pickStart;
    const lo = pickStart <= hoverWeek ? pickStart : hoverWeek;
    const hi = pickStart <= hoverWeek ? hoverWeek : pickStart;
    rangeStart = lo;
    rangeEnd = sundayOf(hi);
    isActivePreview = true;
  } else if (hoverDate) {
    const week = normalizeToMonday(hoverDate);
    rangeStart = week;
    rangeEnd = sundayOf(week);
    isActivePreview = true;
  } else {
    rangeStart = selectedWeek;
    rangeEnd = sundayOf(selectedWeek);
    isActivePreview = false;
  }

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
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-muted-foreground transition-colors hover:bg-accent-soft hover:text-foreground"
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
            {pickStart ? (
              <div className="mb-2 flex items-center justify-between border-b border-dashed border-line pb-2 text-xs">
                <span className="font-bold text-primary">Pick an end date…</span>
                <button
                  type="button"
                  onClick={cancelPicking}
                  className="font-bold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="mb-2 border-b border-dashed border-line pb-2 text-xs text-muted-foreground">
                Click a start date, then an end date to add multiple weeks at once.
              </p>
            )}
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="font-bold text-muted-foreground">
                  {label}
                </span>
              ))}
              {calendarDays.map((date) => {
                const dateStr = formatDate(date);
                const inCurrentMonth = date.getUTCMonth() === viewDate.getUTCMonth();
                const inRange = dateStr >= rangeStart && dateStr <= rangeEnd;
                const isEndpoint = dateStr === rangeStart || dateStr === rangeEnd;

                const barClass = isActivePreview ? "bg-primary-soft" : "bg-accent-soft";
                const circleClass = isActivePreview
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground";

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onMouseEnter={() => setHoverDate(dateStr)}
                    onClick={() => handleDayClick(date)}
                    className={`py-1 text-foreground transition-colors ${
                      inCurrentMonth ? "" : "text-muted-foreground/50"
                    } ${inRange && !isEndpoint ? barClass : ""}`}
                  >
                    {isEndpoint ? (
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full font-extrabold ${circleClass}`}>
                        {date.getUTCDate()}
                      </span>
                    ) : (
                      date.getUTCDate()
                    )}
                  </button>
                );
              })}
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
