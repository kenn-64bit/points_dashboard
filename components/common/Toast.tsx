"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

// Each kind is a pill label on the card's top edge, like a Panel label.
const KIND_STYLES: Record<ToastKind, { label: string; pill: string }> = {
  success: { label: "Done!", pill: "bg-primary text-primary-foreground" },
  error: { label: "Oops!", pill: "bg-danger text-danger-foreground" },
  info: { label: "Heads up", pill: "bg-accent text-accent-foreground" },
};

const TOAST_MS = 4000;
// Matches the toast-out animation in globals.css.
const LEAVE_MS = 300;

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind, leaving: false }]);
    setTimeout(
      () => setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))),
      TOAST_MS - LEAVE_MS
    );
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Top-center, just under the sticky header so it's never covered by it. */}
      <div className="pointer-events-none fixed inset-x-4 top-24 z-50 flex flex-col items-center gap-4 print:hidden">
        {toasts.map((t) => {
          const style = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`${t.leaving ? "toast-out" : "toast-in"} pointer-events-auto relative w-full max-w-md pt-3`}
            >
              <span
                className={`absolute left-5 top-0 z-10 rounded-full px-3.5 py-1 text-sm font-extrabold leading-none shadow-sm ${style.pill}`}
              >
                {style.label}
              </span>
              <div className="toast-card border border-border bg-surface px-7 pb-5 pt-6 text-center text-base font-bold text-foreground">
                {t.message}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
