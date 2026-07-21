"use client";

import React from "react";

export const COLORS = {
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
  return (
    <div className={`rounded-xl border border-[#232B40] bg-[#131826] p-5 ${className}`}>
      {(title || eyebrow || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-widest text-[#4F8CFF]">{eyebrow}</div>}
            {title && <h2 className="text-lg font-semibold" style={display}>{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ tone = "default", children }: { tone?: "default" | "good" | "bad" | "warn"; children: React.ReactNode }) {
  const color = { default: COLORS.textMuted, good: COLORS.good, bad: COLORS.bad, warn: COLORS.warn }[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}1F`, color, border: `1px solid ${color}40` }}
    >
      {children}
    </span>
  );
}

export const inputCls =
  "rounded-md border border-[#232B40] bg-[#0B0F17] px-2.5 py-1.5 text-sm text-[#E7EAF3] outline-none transition-colors focus:border-[#4F8CFF]";

export function signalTone(signal: string): "good" | "bad" | "default" {
  if (signal === "BUY") return "good";
  if (signal === "SELL") return "bad";
  return "default";
}

export function gainColor(pct: number | null): string {
  if (pct === null) return COLORS.textMuted;
  if (pct >= 10) return "#00A651";
  if (pct >= 5) return "#3FD68E";
  if (pct >= 2) return "#8CE8B8";
  if (pct <= -10) return "#B30000";
  if (pct <= -5) return "#E85C4A";
  if (pct <= -2) return "#F2A79C";
  return COLORS.text;
}

export function fmtPct(pct: number | null): string {
  if (pct === null) return "N/A";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function fmtPrice(price: number | null): string {
  if (price === null) return "N/A";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
