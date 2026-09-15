"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always starts as "dark" to match the server-rendered markup (there is no
  // `document` on the server) — the blocking THEME_INIT_SCRIPT has already
  // set the real data-theme attribute before this ever paints, and the
  // effect below reads it back into state without re-writing the attribute
  // on that first sync, so this never causes a hydration mismatch or flash.
  const [theme, setTheme] = useState<Theme>("dark");
  const skipNextWrite = useRef(true);

  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") setTheme(attr);
  }, []);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        // localStorage may be unavailable (private browsing); theme still
        // applies for the current session via the data-theme attribute.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;
