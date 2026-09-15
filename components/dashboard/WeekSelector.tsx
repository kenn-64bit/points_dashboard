"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatWeekRange, getCurrentWeekMonday, getWeeksBetween, normalizeToMonday } from "@/lib/week";
import { useToast } from "@/components/common/Toast";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";

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

  // The highlighted span: while picking or hovering, a live emerald preview
  // (possibly spanning several weeks); otherwise a muted static indicator of
  // the currently selected week.
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
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setCalendarOpen(false);
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3.5 py-2 text-sm text-foreground"
        >
          {formatWeekRange(selectedWeek)}
          <span aria-hidden className="text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-lg">
            {weeks.map((week) => (
              <div key={week} className="flex items-center hover:bg-accent-soft">
                <button
                  type="button"
                  onClick={() => handleSelect(week)}
                  className={`flex-1 px-3.5 py-2 text-left text-sm ${
                    week === selectedWeek ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {formatWeekRange(week)}
                </button>
                <button
                  type="button"
                  onClick={() => setWeekPendingRemoval(week)}
                  title="Remove week"
                  aria-label={`Remove ${formatWeekRange(week)}`}
                  className="px-3.5 py-2 text-muted-foreground hover:text-danger"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <Button type="button" variant="secondary" onClick={openCalendar}>
          Add Week
        </Button>
        {calendarOpen && (
          <div
            className="absolute left-0 top-full z-20 mt-1 w-64 rounded-2xl border border-border bg-surface p-3 shadow-lg"
            onMouseLeave={() => setHoverDate(null)}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-full px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-accent-soft"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-foreground">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-full px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-accent-soft"
              >
                ›
              </button>
            </div>
            {pickStart ? (
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-accent">Pick an end date…</span>
                <button type="button" onClick={cancelPicking} className="text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground">
                Click a start date, then an end date to add multiple weeks at once.
              </p>
            )}
            <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="text-muted-foreground">
                  {label}
                </span>
              ))}
              {calendarDays.map((date) => {
                const dateStr = formatDate(date);
                const inCurrentMonth = date.getUTCMonth() === viewDate.getUTCMonth();
                const inRange = dateStr >= rangeStart && dateStr <= rangeEnd;
                const isEndpoint = dateStr === rangeStart || dateStr === rangeEnd;

                const barClass = isActivePreview ? "bg-accent-soft" : "bg-surface-muted";
                const circleClass = isActivePreview
                  ? "bg-gradient-to-br from-accent-from to-accent-to text-accent-foreground"
                  : "bg-foreground text-background";

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
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full font-medium ${circleClass}`}>
                        {date.getUTCDate()}
                      </span>
                    ) : (
                      date.getUTCDate()
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {weekPendingRemoval && (
        <Modal>
          <div className="flex items-start gap-3">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" className="mt-0.5 h-8 w-8 shrink-0 text-danger">
              <path
                d="M12 3.5 2 20.5h20L12 3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="currentColor"
                fillOpacity="0.12"
              />
              <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="17.25" r="0.9" fill="currentColor" />
            </svg>
            <div>
              <h3 className="text-base font-semibold text-foreground">Remove this week?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                All points for <span className="font-medium text-foreground">{formatWeekRange(weekPendingRemoval)}</span>{" "}
                will be permanently deleted. This can&apos;t be undone.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWeekPendingRemoval(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove Week"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
