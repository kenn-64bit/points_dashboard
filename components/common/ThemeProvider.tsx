"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  // `origin` is where the reveal circle grows from, in viewport pixels
  // (where the switch's knob lands); defaults to the top-right corner.
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

const REVEAL_DURATION_MS = 650;

const STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

// The `data-theme` attribute on <html> is the source of truth: the blocking
// THEME_INIT_SCRIPT sets it before first paint, and React just subscribes to
// it. The server has no DOM, so it renders the light default; React then
// re-reads the real value during hydration without a mismatch or flash.
function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Until the user explicitly picks a theme, keep following the OS setting.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function handleSystemChange(e: MediaQueryListEvent) {
    if (!readStoredTheme()) document.documentElement.dataset.theme = e.matches ? "dark" : "light";
  }
  media.addEventListener("change", handleSystemChange);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", handleSystemChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback((origin?: { x: number; y: number }) => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (private browsing); theme still
      // applies for the current session via the data-theme attribute.
    }
    const apply = () => {
      document.documentElement.dataset.theme = next;
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduceMotion) {
      apply();
      return;
    }
    // Circular reveal: the new theme's snapshot is clipped to a circle that
    // grows from the switch until it covers the farthest corner of the screen.
    const x = origin?.x ?? window.innerWidth;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: REVEAL_DURATION_MS,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Transition skipped (e.g. tab hidden); the theme is still applied.
      });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;
