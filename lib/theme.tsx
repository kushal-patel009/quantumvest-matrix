"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface Palette {
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  good: string;
  bad: string;
  warn: string;
}

export const DARK_COLORS: Palette = {
  bg: "#0B0F17",
  panel: "#131826",
  panelAlt: "#182036",
  border: "#232B40",
  text: "#E7EAF3",
  textMuted: "#8A93AB",
  accent: "#4F8CFF",
  good: "#3FD68E",
  bad: "#F2564C",
  warn: "#F2B84B",
};

export const LIGHT_COLORS: Palette = {
  bg: "#F5F7FB",
  panel: "#FFFFFF",
  panelAlt: "#EEF1F8",
  border: "#DDE3EF",
  text: "#1A2033",
  textMuted: "#6B7280",
  accent: "#3B6FE0",
  good: "#1E9E64",
  bad: "#D93B31",
  warn: "#B8790C",
};

type Mode = "light" | "dark";

interface ThemeContextValue {
  mode: Mode;
  colors: Palette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "qvm-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark on first render (matches server render); swap to the
  // saved preference right after mount to avoid a server/client mismatch.
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setMode(saved);
    } else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      setMode("light");
    }
  }, []);

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const colors = mode === "dark" ? DARK_COLORS : LIGHT_COLORS;

  // Keep the actual page background in sync too, since some browser UI
  // (scrollbars, overscroll) reflects the underlying <body> background.
  useEffect(() => {
    document.body.style.backgroundColor = colors.bg;
    document.body.style.colorScheme = mode;
  }, [colors.bg, mode]);

  return <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
