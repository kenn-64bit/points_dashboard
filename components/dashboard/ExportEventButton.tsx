"use client";

import { useEffect, useRef, useState } from "react";
import { formatWeekRange } from "@/lib/week";
import { Modal } from "@/components/common/Modal";
import { Button, buttonClasses } from "@/components/common/Button";

export function ExportEventButton({ eventId, weeks }: { eventId: string; weeks: string[] }) {
  const [open, setOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(weeks[0] ?? "");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Export CSV
      </Button>

      {open && (
        <Modal maxWidth="max-w-md">
          <h3 className="text-base font-semibold text-foreground">Export CSV</h3>

          {weeks.length === 0 ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">No points exist for this event yet.</p>
              <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-2xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">Single week</p>
                <p className="mt-1 text-sm text-muted-foreground">Export the points for one week.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div ref={containerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen((o) => !o)}
                      className="flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3.5 py-2 text-sm text-foreground"
                    >
                      {formatWeekRange(selectedWeek)}
                      <span aria-hidden className="text-xs text-muted-foreground">
                        ▾
                      </span>
                    </button>
                    {dropdownOpen && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-lg">
                        {weeks.map((week) => (
                          <button
                            key={week}
                            type="button"
                            onClick={() => {
                              setSelectedWeek(week);
                              setDropdownOpen(false);
                            }}
                            className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-accent-soft ${
                              week === selectedWeek ? "font-medium text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {formatWeekRange(week)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <a href={`/api/events/${eventId}/export?week=${selectedWeek}`} className={buttonClasses("primary")}>
                    Export {formatWeekRange(selectedWeek)}
                  </a>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">Whole event</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Export every week ({weeks.length} total) in one file, organized into weekly sections.
                </p>
                <a
                  href={`/api/events/${eventId}/export?week=all`}
                  className={buttonClasses("primary", "mt-3")}
                >
                  Export all {weeks.length} weeks
                </a>
              </div>

              <div className="mt-6 flex justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
