"use client";

import { useMemo, useState } from "react";
import { DAY_COLUMNS, DAY_LABELS } from "@/types";
import type { Day, PointsTableRow } from "@/types";
import { PointsEditorModal } from "@/components/dashboard/PointsEditorModal";
import { Badge } from "@/components/common/Badge";

type SortState = { day: Day; dir: "asc" | "desc" } | null;

const TOTAL_COL = DAY_COLUMNS.length + 1;
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
    <svg viewBox="0 0 12 12" className="h-4 w-4 opacity-40" fill="currentColor" aria-hidden>
      <path d="M6 1.5 8.5 4.5h-5L6 1.5ZM6 10.5 3.5 7.5h5L6 10.5Z" />
    </svg>
  );
}

export function PointsTable({
  rows,
  onRowUpdated,
}: {
  rows: PointsTableRow[];
  onRowUpdated: (row: PointsTableRow) => void;
}) {
  const [editingRow, setEditingRow] = useState<PointsTableRow | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const displayRows = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[sort.day] - b[sort.day]) * factor);
  }, [rows, sort]);

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
    return <p className="text-sm text-muted-foreground">No participants yet for this event.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-3xl border border-border">
        <table className="w-full min-w-[640px] text-sm" onMouseLeave={clearHover}>
          <thead className="bg-surface-muted">
            <tr className="divide-x divide-border border-b border-border">
              <th
                onMouseEnter={() => setHoveredCol(null)}
                className="px-5 py-4 text-left font-medium text-foreground"
              >
                User
              </th>
              {DAY_COLUMNS.map((day, i) => {
                const active = sort?.day === day;
                const colIndex = i + 1;
                return (
                  <th
                    key={day}
                    onMouseEnter={() => setHoveredCol(colIndex)}
                    className={`px-4 py-4 font-medium transition-colors ${cellClass(null, colIndex)}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(day)}
                      className={`flex w-full items-center justify-center gap-1.5 hover:text-foreground ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {DAY_LABELS[day]}
                      <SortIcon direction={active ? sort!.dir : null} />
                    </button>
                  </th>
                );
              })}
              <th
                onMouseEnter={() => setHoveredCol(TOTAL_COL)}
                className={`px-5 py-4 text-center font-medium text-foreground transition-colors ${cellClass(null, TOTAL_COL)}`}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayRows.map((row) => (
              <tr key={row.discord_id} onMouseEnter={() => setHoveredRow(row.discord_id)} className="divide-x divide-border">
                <td
                  onMouseEnter={() => setHoveredCol(null)}
                  className={`px-5 py-4 transition-colors ${hoveredRow === row.discord_id ? HOVER_TINT : ""}`}
                >
                  <button
                    onClick={() => setEditingRow(row)}
                    className="text-left text-foreground hover:underline"
                    title="Edit points"
                  >
                    {row.discord_username}
                  </button>
                </td>
                {DAY_COLUMNS.map((day, i) => {
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
                  onMouseEnter={() => setHoveredCol(TOTAL_COL)}
                  className={`px-5 py-4 text-center transition-colors ${cellClass(row.discord_id, TOTAL_COL)}`}
                >
                  <Badge tone="accent">{row.total_points}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingRow && (
        <PointsEditorModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={(updated) => onRowUpdated(updated)}
        />
      )}
    </>
  );
}
