"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_COLUMNS, DAY_LABELS } from "@/types";
import type { Day, DayValues, EventWeek, PointsTableRow } from "@/types";
import { formatShortDayLabel, weekDays, weekHasDay } from "@/lib/week";
import { Badge } from "@/components/common/Badge";
import { Panel } from "@/components/common/Panel";
import { IconButton } from "@/components/common/IconButton";
import { CheckIcon, XIcon } from "@/components/common/icons";
import { Skeleton, SkeletonLabel } from "@/components/common/Skeleton";
import { useToast } from "@/components/common/Toast";
import { useCanEdit } from "@/components/auth/RoleProvider";

type SortState = { day: Day; dir: "asc" | "desc" } | null;

const HOVER_TINT = "bg-accent-soft";
// Zeros fade back so the days with points stand out.
const ZERO_FADE = "opacity-40";

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") {
    return (
      <svg viewBox="0 0 12 12" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M6 2.5 10 8H2l4-5.5Z" />
      </svg>
    );
  }
  if (direction === "desc") {
    return (
      <svg viewBox="0 0 12 12" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M6 9.5 2 4h8L6 9.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-4 w-4 opacity-60" fill="currentColor" aria-hidden>
      <path d="M6 1.5 8.5 4.5h-5L6 1.5ZM6 10.5 3.5 7.5h5L6 10.5Z" />
    </svg>
  );
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

// One column per day of `week`, in order (e.g. Thu 20 … Mon 24). Editors type
// points straight into the cells; a row with unsaved edits shows save / discard
// buttons at its right end (Enter / Esc do the same). Edits live only in this
// table, so switching weeks drops any that weren't saved.
export function PointsTable({
  rows,
  week,
  label,
  onRowUpdated,
}: {
  rows: PointsTableRow[];
  week: EventWeek;
  label?: string;
  onRowUpdated: (row: PointsTableRow) => void;
}) {
  const editable = useCanEdit();
  const router = useRouter();
  const { showToast } = useToast();
  const [sort, setSort] = useState<SortState>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  // Unsaved values by discord_id; a row has an entry only while it differs
  // from what's saved.
  const [drafts, setDrafts] = useState<Record<string, DayValues>>({});
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set());

  const days = useMemo(() => weekDays(week), [week]);
  const totalCol = days.length + 1;
  const actionsCol = totalCol + 1;
  // A sort on a day this week doesn't have (after switching weeks) is ignored.
  const activeSort = sort && days.some((d) => d.day === sort.day) ? sort : null;
  const hasDrafts = Object.keys(drafts).length > 0;

  // Sorts by saved values, so a row doesn't jump around while it's edited.
  const displayRows = useMemo(() => {
    if (!activeSort) return rows;
    const factor = activeSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[activeSort.day] - b[activeSort.day]) * factor);
  }, [rows, activeSort]);

  // Asks before a reload or tab close would throw away unsaved edits.
  useEffect(() => {
    if (!hasDrafts) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);

  function toggleSort(day: Day) {
    setSort((prev) => {
      if (!prev || prev.day !== day) return { day, dir: "asc" };
      if (prev.dir === "asc") return { day, dir: "desc" };
      return null;
    });
  }

  function clearHover() {
    setHoveredRow(null);
    setHoveredCol(null);
  }

  function cellClass(rowId: string | null, colIndex: number): string {
    const highlighted = hoveredCol === colIndex || (rowId !== null && hoveredRow === rowId);
    return highlighted ? HOVER_TINT : "";
  }

  // Only `week`'s own days carry points; the others are saved as 0.
  function savedValues(row: PointsTableRow): DayValues {
    return Object.fromEntries(DAY_COLUMNS.map((day) => [day, weekHasDay(week, day) ? row[day] : 0])) as DayValues;
  }

  function setDayValue(row: PointsTableRow, day: Day, value: number) {
    setDrafts((prev) => {
      const next = { ...(prev[row.discord_id] ?? savedValues(row)), [day]: value };
      const unchanged = days.every(({ day: d }) => next[d] === row[d]);
      return unchanged ? withoutKey(prev, row.discord_id) : { ...prev, [row.discord_id]: next };
    });
  }

  function discardRow(row: PointsTableRow) {
    setDrafts((prev) => withoutKey(prev, row.discord_id));
  }

  async function saveRow(row: PointsTableRow) {
    const values = drafts[row.discord_id];
    if (!values || savingIds.has(row.discord_id)) return;
    setSavingIds((prev) => new Set(prev).add(row.discord_id));
    try {
      const isNew = row.point_id === null;
      const res = await fetch(isNew ? "/api/points" : `/api/points/${row.point_id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { event_id: row.event_id, discord_id: row.discord_id, week_date: row.week_date, ...values }
            : values
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save points");

      onRowUpdated({ ...row, ...body.point, discord_username: row.discord_username });
      setDrafts((prev) => withoutKey(prev, row.discord_id));
      showToast(`Points saved for ${row.discord_username}`);
      // Drops the copies Next.js keeps of pages rendered before this save, so
      // the leaderboard, the export list and the back button all show the new
      // points instead of the old ones until a manual reload.
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.discord_id);
        return next;
      });
    }
  }

  if (rows.length === 0) {
    return (
      <Panel bodyClassName="px-5 py-4">
        <p className="text-sm text-muted-foreground">No participants yet for this event.</p>
      </Panel>
    );
  }

  return (
    <Panel label={label} bodyClassName="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm" onMouseLeave={clearHover}>
        <thead className="bg-surface-muted">
          <tr className="divide-x divide-border border-b border-border">
            <th
              onMouseEnter={() => setHoveredCol(null)}
              className="px-5 py-4 text-left font-extrabold text-foreground"
            >
              User
            </th>
            {days.map(({ day, date }, i) => {
              const active = activeSort?.day === day;
              const colIndex = i + 1;
              return (
                <th
                  key={day}
                  onMouseEnter={() => setHoveredCol(colIndex)}
                  className={`px-4 py-4 font-bold transition-colors ${cellClass(null, colIndex)}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(day)}
                    className={`flex w-full items-center justify-center gap-1.5 hover:text-foreground ${
                      active ? "text-accent-ink" : "text-muted-foreground"
                    }`}
                  >
                    {formatShortDayLabel(date)}
                    <SortIcon direction={active ? activeSort!.dir : null} />
                  </button>
                </th>
              );
            })}
            <th
              onMouseEnter={() => setHoveredCol(totalCol)}
              className={`px-5 py-4 text-center font-extrabold text-foreground transition-colors ${cellClass(null, totalCol)}`}
            >
              Total
            </th>
            {editable && (
              <th onMouseEnter={() => setHoveredCol(actionsCol)} className={`w-24 transition-colors ${cellClass(null, actionsCol)}`}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-line">
          {displayRows.map((row) => {
            const draft = drafts[row.discord_id];
            const values = draft ?? row;
            const saving = savingIds.has(row.discord_id);
            const total = draft ? days.reduce((sum, { day }) => sum + draft[day], 0) : row.total_points;
            return (
              <tr key={row.discord_id} onMouseEnter={() => setHoveredRow(row.discord_id)} className="divide-x divide-border">
                <td
                  onMouseEnter={() => setHoveredCol(null)}
                  className={`px-5 py-4 font-bold text-foreground transition-colors ${hoveredRow === row.discord_id ? HOVER_TINT : ""}`}
                >
                  {row.discord_username}
                </td>
                {days.map(({ day }, i) => {
                  const colIndex = i + 1;
                  const value = values[day];
                  const changed = draft !== undefined && value !== row[day];
                  return (
                    <td
                      key={day}
                      onMouseEnter={() => setHoveredCol(colIndex)}
                      className={`text-center font-bold tabular-nums transition-colors ${
                        editable ? "px-2 py-2.5" : "px-4 py-4"
                      } ${cellClass(row.discord_id, colIndex)}`}
                    >
                      {editable ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value}
                          readOnly={saving}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const normalized = Math.max(0, Math.trunc(Number(e.target.value.replace(/\D/g, "")) || 0));
                            // React skips re-rendering the DOM value when the parsed
                            // number is unchanged (e.g. typing "0" then "1" then "0"
                            // parses to 10 both times), which can leave a stale raw
                            // string like "010" visible. Force the input's own text
                            // back in sync regardless of whether state actually changes.
                            e.target.value = String(normalized);
                            setDayValue(row, day, normalized);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveRow(row);
                            } else if (e.key === "Escape") {
                              discardRow(row);
                            }
                          }}
                          aria-label={`${row.discord_username} ${DAY_LABELS[day]} points`}
                          className={`w-16 rounded-field border bg-transparent py-1.5 text-center font-bold tabular-nums outline-none transition-[background-color,border-color,opacity] hover:border-border focus:border-primary focus:bg-primary-soft focus:opacity-100 ${
                            changed ? "border-accent text-accent-ink" : "border-transparent text-foreground"
                          } ${value === 0 && !changed ? ZERO_FADE : ""}`}
                        />
                      ) : (
                        <span className={`text-foreground ${value === 0 ? ZERO_FADE : ""}`}>{value}</span>
                      )}
                    </td>
                  );
                })}
                <td
                  onMouseEnter={() => setHoveredCol(totalCol)}
                  className={`px-5 py-4 text-center transition-colors ${cellClass(row.discord_id, totalCol)}`}
                >
                  <Badge tone="total" className={total === 0 ? ZERO_FADE : ""}>
                    {total}
                  </Badge>
                </td>
                {editable && (
                  <td
                    onMouseEnter={() => setHoveredCol(actionsCol)}
                    className={`w-24 px-3 py-2.5 transition-colors ${cellClass(row.discord_id, actionsCol)}`}
                  >
                    {draft && (
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton
                          label={saving ? "Saving…" : "Save points"}
                          tone="primary"
                          tooltipAlign="end"
                          onClick={() => saveRow(row)}
                          disabled={saving}
                          className="h-8 w-8"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Discard changes"
                          tooltipAlign="end"
                          onClick={() => discardRow(row)}
                          disabled={saving}
                          className="h-8 w-8"
                        >
                          <XIcon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

// Same frame as the table (user, 7 days, total), shown while a week loads.
export function PointsTableSkeleton({ rows = 6 }: { rows?: number }) {
  const cols = Array.from({ length: 7 }, (_, i) => i);
  return (
    <Panel label={<SkeletonLabel className="w-32" />} bodyClassName="overflow-x-auto">
      <div className="w-full min-w-[640px] text-sm">
        <div className="flex divide-x divide-border border-b border-border bg-surface-muted">
          <div className="flex-[2] px-5 py-4">
            <Skeleton className="h-4 w-12 bg-border" />
          </div>
          {cols.map((i) => (
            <div key={i} className="flex flex-1 justify-center px-4 py-4">
              <Skeleton className="h-4 w-10 bg-border" />
            </div>
          ))}
          <div className="flex flex-1 justify-center px-5 py-4">
            <Skeleton className="h-4 w-10 bg-border" />
          </div>
        </div>
        <div className="divide-y divide-dashed divide-line">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center">
              <div className="flex-[2] px-5 py-3.5">
                <Skeleton className={`h-4 ${r % 3 === 0 ? "w-32" : r % 3 === 1 ? "w-24" : "w-28"}`} />
              </div>
              {cols.map((i) => (
                <div key={i} className="flex flex-1 justify-center px-4 py-3.5">
                  <Skeleton className="h-4 w-6" />
                </div>
              ))}
              <div className="flex flex-1 justify-center px-5 py-3.5">
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
