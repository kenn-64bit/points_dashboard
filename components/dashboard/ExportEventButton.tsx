"use client";

import { useEffect, useRef, useState } from "react";
import { formatWeekRange } from "@/lib/week";
import { Modal } from "@/components/common/Modal";
import { Button, buttonClasses } from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { DownloadIcon } from "@/components/common/icons";
import { MenuItem, MenuList, MenuPanel, SelectTrigger } from "@/components/common/Select";

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
      <IconButton label="Export event data" onClick={() => setOpen(true)}>
        <DownloadIcon />
      </IconButton>

      {open && (
        <Modal maxWidth="max-w-md">
          <h3 className="text-lg font-extrabold text-foreground">Export Event Data</h3>

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
              <div className="mt-4 rounded-field border border-border bg-surface-muted p-4">
                <p className="text-sm font-extrabold text-foreground">Single week</p>
                <p className="mt-1 text-sm text-muted-foreground">Export the points for one week.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div ref={containerRef} className="relative">
                    <SelectTrigger open={dropdownOpen} onClick={() => setDropdownOpen((o) => !o)} className="bg-surface">
                      {formatWeekRange(selectedWeek)}
                    </SelectTrigger>
                    {dropdownOpen && (
                      <MenuPanel className="w-60">
                        <MenuList>
                          {weeks.map((week) => (
                            <MenuItem
                              key={week}
                              selected={week === selectedWeek}
                              onSelect={() => {
                                setSelectedWeek(week);
                                setDropdownOpen(false);
                              }}
                            >
                              {formatWeekRange(week)}
                            </MenuItem>
                          ))}
                        </MenuList>
                      </MenuPanel>
                    )}
                  </div>
                  <a href={`/api/events/${eventId}/export?week=${selectedWeek}`} className={buttonClasses("primary")}>
                    Export {formatWeekRange(selectedWeek)}
                  </a>
                </div>
              </div>

              <div className="mt-3 rounded-field border border-border bg-surface-muted p-4">
                <p className="text-sm font-extrabold text-foreground">Whole event</p>
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
