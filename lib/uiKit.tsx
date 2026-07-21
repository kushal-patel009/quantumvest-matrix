"use client";

import React from "react";
import { useTheme, Palette, DARK_COLORS } from "./theme";

// Kept as a static export for any legacy/non-React usage; prefer
// useTheme().colors inside components so light/dark actually switches.
export const COLORS = DARK_COLORS;

export const mono = { fontFamily: "'JetBrains Mono', monospace" };
export const display = { fontFamily: "'Space Grotesk', sans-serif" };

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { colors } = useTheme();
  return (
    <div className={`rounded-xl border p-5 ${className}`} style={{ borderColor: colors.border, backgroundColor: colors.panel }}>
      {(title || eyebrow || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: colors.accent }}>{eyebrow}</div>}
            {title && <h2 className="text-lg font-semibold" style={{ ...display, color: colors.text }}>{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ tone = "default", children }: { tone?: "default" | "good" | "bad" | "warn"; children: React.ReactNode }) {
  const { colors } = useTheme();
  const color = { default: colors.textMuted, good: colors.good, bad: colors.bad, warn: colors.warn }[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}1F`, color, border: `1px solid ${color}40` }}
    >
      {children}
    </span>
  );
}

/** Structural-only classes (no color) — pair with inputStyle(colors) for the theme-driven look. */
export const inputCls = "rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors";

export function inputStyle(colors: Palette): React.CSSProperties {
  return {
    backgroundColor: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.text,
  };
}

export function signalTone(signal: string): "good" | "bad" | "default" {
  if (signal === "BUY") return "good";
  if (signal === "SELL") return "bad";
  return "default";
}

export function gainColor(pct: number | null, colors: Palette): string {
  if (pct === null) return colors.textMuted;
  if (pct >= 10) return "#00A651";
  if (pct >= 5) return "#3FD68E";
  if (pct >= 2) return "#8CE8B8";
  if (pct <= -10) return "#B30000";
  if (pct <= -5) return "#E85C4A";
  if (pct <= -2) return "#F2A79C";
  return colors.text;
}

export function fmtPct(pct: number | null): string {
  if (pct === null) return "N/A";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function fmtPrice(price: number | null): string {
  if (price === null) return "N/A";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
