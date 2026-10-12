"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DAY_LABELS } from "@/types";
import type { Day, EventWeek, PointsTableRow } from "@/types";
import { weekDays } from "@/lib/week";
import { Badge } from "@/components/common/Badge";
import { Panel } from "@/components/common/Panel";
import { useCanEdit } from "@/components/auth/RoleProvider";

// Loaded on first open, so its code isn't part of the page's initial JS.
const PointsEditorModal = dynamic(() => import("@/components/dashboard/PointsEditorModal").then((m) => m.PointsEditorModal), {
  ssr: false,
});

type SortState = { day: Day; dir: "asc" | "desc" } | null;

const HOVER_TINT = "bg-accent-soft";

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

// One column per day of `week`, in order (e.g. Thu 20 … Mon 24).
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
  const [editingRow, setEditingRow] = useState<PointsTableRow | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const days = useMemo(() => weekDays(week), [week]);
  const totalCol = days.length + 1;
  // A sort on a day this week doesn't have (after switching weeks) is ignored.
  const activeSort = sort && days.some((d) => d.day === sort.day) ? sort : null;

  const displayRows = useMemo(() => {
    if (!activeSort) return rows;
    const factor = activeSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[activeSort.day] - b[activeSort.day]) * factor);
  }, [rows, activeSort]);

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

  if (rows.length === 0) {
    return (
      <Panel bodyClassName="px-5 py-4">
        <p className="text-sm text-muted-foreground">No participants yet for this event.</p>
      </Panel>
    );
  }

  return (
    <>
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
                      {DAY_LABELS[day]} {Number(date.slice(8))}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-line">
            {displayRows.map((row) => (
              <tr key={row.discord_id} onMouseEnter={() => setHoveredRow(row.discord_id)} className="divide-x divide-border">
                <td
                  onMouseEnter={() => setHoveredCol(null)}
                  className={`px-5 py-4 transition-colors ${hoveredRow === row.discord_id ? HOVER_TINT : ""}`}
                >
                  {editable ? (
                    <button
                      onClick={() => setEditingRow(row)}
                      className="text-left font-bold text-foreground transition-colors hover:text-accent-ink hover:underline hover:decoration-dashed hover:underline-offset-4"
                      title="Edit points"
                    >
                      {row.discord_username}
                    </button>
                  ) : (
                    <span className="font-bold text-foreground">{row.discord_username}</span>
                  )}
                </td>
                {days.map(({ day }, i) => {
                  const colIndex = i + 1;
                  return (
                    <td
                      key={day}
                      onMouseEnter={() => setHoveredCol(colIndex)}
                      className={`px-4 py-4 text-center font-bold tabular-nums text-foreground transition-colors ${cellClass(row.discord_id, colIndex)}`}
                    >
                      {row[day]}
                    </td>
                  );
                })}
                <td
                  onMouseEnter={() => setHoveredCol(totalCol)}
                  className={`px-5 py-4 text-center transition-colors ${cellClass(row.discord_id, totalCol)}`}
                >
                  <Badge tone="total">{row.total_points}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {editingRow && (
        <PointsEditorModal
          row={editingRow}
          week={week}
          onClose={() => setEditingRow(null)}
          onSaved={(updated) => onRowUpdated(updated)}
        />
      )}
    </>
  );
}
