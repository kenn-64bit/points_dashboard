"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/common/IconButton";
import { SettingsIcon } from "@/components/common/icons";

const CROSSHAIR_KEY = "points-table-crosshair";
const listeners = new Set<() => void>();

function readCrosshair(): boolean {
  try {
    return localStorage.getItem(CROSSHAIR_KEY) !== "off";
  } catch {
    return true; // Storage blocked; keep the default.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Whether hovering a cell tints its whole row and column. Remembered per
// browser; on when nothing is stored (or storage is unavailable).
export function useCrosshairSetting(): [boolean, (on: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readCrosshair, () => true);

  function update(on: boolean) {
    try {
      localStorage.setItem(CROSSHAIR_KEY, on ? "on" : "off");
    } catch {
      // Storage blocked; the toggle won't stick.
    }
    listeners.forEach((l) => l());
  }

  return [enabled, update];
}

// Gear button with a small popover of table display options.
export function TableSettingsButton({
  crosshair,
  onCrosshairChange,
}: {
  crosshair: boolean;
  onCrosshairChange: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        label="Table settings"
        pressed={open}
        aria-expanded={open}
        aria-controls="table-settings"
        onClick={() => setOpen((v) => !v)}
      >
        <SettingsIcon />
      </IconButton>
      {open && (
        <div
          id="table-settings"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border bg-surface p-3 shadow-panel"
        >
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-accent-soft">
            <span className="text-sm font-bold text-foreground">Crosshair highlight</span>
            <input
              type="checkbox"
              role="switch"
              checked={crosshair}
              onChange={(e) => onCrosshairChange(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-6 w-10 shrink-0 rounded-full bg-control-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-4"
            />
          </label>
        </div>
      )}
    </div>
  );
}
