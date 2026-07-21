"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { getCurrentProfile, signOut, Profile } from "../lib/auth";
import { fetchTickers, addTicker, updateTicker, deleteTicker, bulkUpsertTickers } from "../lib/tickersApi";
import type { Ticker, TabKey, Quote } from "../lib/types";
import { TAB_LABELS, TAB_ORDER } from "../lib/types";
import { useTheme } from "../lib/theme";
import { display, mono, Panel, Pill, inputCls, inputStyle, signalTone, gainColor, fmtPct, fmtPrice } from "../lib/uiKit";

function emptyDraft(tab: TabKey): Omit<Ticker, "id"> {
  return { tab, segment: tab === "quantum" ? "UNSORTED" : null, symbol: "", name: "", stopLoss: null, target: null };
}

export default function QuantumVestMatrix() {
  const { colors: COLORS, mode, toggleTheme } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = still checking
  const [activeTab, setActiveTab] = useState<TabKey>("quantum");
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingTickers, setLoadingTickers] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Ticker>>({});
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Omit<Ticker, "id">>(emptyDraft("quantum"));
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  // Auth gate --------------------------------------------------------
  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p);
      if (!p) router.push("/login");
    });
  }, [router]);

  // Load tickers for active tab --------------------------------------
  const loadTickers = useCallback(async () => {
    setLoadingTickers(true);
    setError(null);
    try {
      const data = await fetchTickers(activeTab);
      setTickers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickers");
    } finally {
      setLoadingTickers(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (profile) loadTickers();
  }, [profile, activeTab, loadTickers]);

  // Load live quotes whenever the ticker list for this tab changes ----
  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    setLoadingQuotes(true);
    fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: tickers.map((t) => t.symbol) }),
    })
      .then((r) => r.json())
      .then((data: { quotes: Quote[] }) => {
        if (cancelled) return;
        const map: Record<string, Quote> = {};
        for (const q of data.quotes ?? []) map[q.symbol] = q;
        setQuotes(map);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load live prices — Yahoo's feed may be rate-limiting right now.");
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  const grouped = useMemo(() => {
    if (activeTab !== "quantum") return { "": tickers };
    const groups: Record<string, Ticker[]> = {};
    for (const t of tickers) {
      const key = t.segment ?? "UNSORTED";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [tickers, activeTab]);

  const showStopTarget = activeTab === "schwab_all";

  // Signal summary (Hourly/Daily/Weekly buy-sell breakdown) shown at the
  // bottom of every tab except Quantum, which is already broken into
  // segments and doesn't need an extra rollup on top.
  interface SummaryRow {
    timeframe: string;
    buyCount: number;
    buyPct: number;
    sellCount: number;
    sellPct: number;
    naCount: number;
    naPct: number;
    total: number;
  }
  const summaryRows: SummaryRow[] = useMemo(() => {
    if (tickers.length === 0) return [];
    const fields: { key: "hourlySignal" | "dailySignal" | "weeklySignal"; label: string }[] = [
      { key: "hourlySignal", label: "Hourly" },
      { key: "dailySignal", label: "Daily" },
      { key: "weeklySignal", label: "Weekly" },
    ];
    return fields.map(({ key, label }) => {
      const signals = tickers.map((t) => quotes[t.symbol]?.[key] ?? "N/A");
      const total = signals.length;
      const buyCount = signals.filter((s) => s === "BUY").length;
      const sellCount = signals.filter((s) => s === "SELL").length;
      const naCount = total - buyCount - sellCount;
      return {
        timeframe: label,
        buyCount,
        buyPct: total > 0 ? (buyCount / total) * 100 : 0,
        sellCount,
        sellPct: total > 0 ? (sellCount / total) * 100 : 0,
        naCount,
        naPct: total > 0 ? (naCount / total) * 100 : 0,
        total,
      };
    });
  }, [tickers, quotes]);

  // Admin actions ------------------------------------------------------
  const startEdit = (t: Ticker) => {
    setEditingId(t.id);
    setEditDraft({ symbol: t.symbol, name: t.name, stopLoss: t.stopLoss, target: t.target });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };
  const saveEdit = async (id: string) => {
    try {
      await updateTicker(id, editDraft);
      cancelEdit();
      loadTickers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const removeTicker = async (t: Ticker) => {
    if (!window.confirm(`Remove ${t.symbol} from ${TAB_LABELS[activeTab]}?`)) return;
    try {
      await deleteTicker(t.id);
      loadTickers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const openAdd = () => {
    setAddDraft(emptyDraft(activeTab));
    setAdding(true);
  };
  const submitAdd = async () => {
    if (!addDraft.symbol.trim()) return;
    try {
      await addTicker(addDraft);
      setAdding(false);
      loadTickers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add ticker");
    }
  };

  const handleExcelUpload = async (file: File) => {
    setUploadBusy(true);
    setUploadMsg(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

      const norm = (r: Record<string, unknown>, keys: string[]): string => {
        for (const k of Object.keys(r)) {
          if (keys.includes(k.trim().toLowerCase())) return String(r[k] ?? "").trim();
        }
        return "";
      };
      const normNum = (r: Record<string, unknown>, keys: string[]): number | null => {
        const v = norm(r, keys);
        if (!v) return null;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };

      const parsed = rows
        .map((r) => ({
          symbol: norm(r, ["symbol", "ticker"]),
          name: norm(r, ["name", "company", "company name"]),
          stopLoss: showStopTarget ? normNum(r, ["stop loss", "stoploss", "stop_loss"]) : null,
          target: showStopTarget ? normNum(r, ["target"]) : null,
          segment: activeTab === "quantum" ? norm(r, ["segment"]) || "UNSORTED" : null,
        }))
        .filter((r) => r.symbol);

      if (parsed.length === 0) {
        setUploadMsg("No rows found — make sure the file has a 'Symbol' column.");
        return;
      }

      const result = await bulkUpsertTickers(activeTab, parsed);
      setUploadMsg(
        `Imported ${result.succeeded} ticker${result.succeeded === 1 ? "" : "s"}.` +
          (result.failed.length ? ` ${result.failed.length} failed: ${result.failed.map((f) => f.symbol).join(", ")}` : "")
      );
      loadTickers();
    } catch (e) {
      setUploadMsg(e instanceof Error ? `Import failed: ${e.message}` : "Import failed");
    } finally {
      setUploadBusy(false);
    }
  };

  // ---------------------------------------------------------------------

  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: COLORS.bg, color: COLORS.textMuted }}>
        Checking session…
      </div>
    );
  }
  if (!profile) return null; // redirecting to /login

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: COLORS.accent }}>
              Quantumvest Matrix
            </div>
            <h1 className="text-2xl font-bold md:text-3xl" style={display}>
              Live Signals
            </h1>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              Signed in as {profile.email} · <span style={{ color: isAdmin ? COLORS.good : COLORS.textMuted }}>{isAdmin ? "Admin" : "Viewer"}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={toggleTheme}
              className="rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
              title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {mode === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="rounded-lg border px-4 py-2 text-sm"
              style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border p-1" style={{ borderColor: COLORS.border, backgroundColor: COLORS.panel }}>
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab ? COLORS.accent : "transparent",
                color: activeTab === tab ? "white" : COLORS.textMuted,
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border px-4 py-2 text-sm" style={{ borderColor: COLORS.bad, color: COLORS.bad }}>
            {error}
          </div>
        )}

        {/* Admin toolbar */}
        {isAdmin && (
          <Panel className="mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={openAdd} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: COLORS.accent }}>
                + Add Ticker
              </button>
              <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm" style={{ borderColor: COLORS.border, color: COLORS.text }}>
                {uploadBusy ? "Importing…" : "Upload Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={uploadBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcelUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>
                Expects columns: Symbol, Name{showStopTarget ? ", Stop Loss, Target" : ""}{activeTab === "quantum" ? ", Segment (optional)" : ""}
              </span>
            </div>
            {uploadMsg && <p className="mt-2 text-sm" style={{ color: COLORS.text }}>{uploadMsg}</p>}

            {adding && (
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}>
                <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <input placeholder="Symbol" className={inputCls} style={inputStyle(COLORS)} value={addDraft.symbol} onChange={(e) => setAddDraft({ ...addDraft, symbol: e.target.value })} />
                  <input placeholder="Name" className={inputCls} style={inputStyle(COLORS)} value={addDraft.name} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} />
                  {activeTab === "quantum" && (
                    <input placeholder="Segment" className={inputCls} style={inputStyle(COLORS)} value={addDraft.segment ?? ""} onChange={(e) => setAddDraft({ ...addDraft, segment: e.target.value })} />
                  )}
                  {showStopTarget && (
                    <>
                      <input type="number" step={0.01} placeholder="Stop Loss" className={inputCls} style={inputStyle(COLORS)} value={addDraft.stopLoss ?? ""} onChange={(e) => setAddDraft({ ...addDraft, stopLoss: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                      <input type="number" step={0.01} placeholder="Target" className={inputCls} style={inputStyle(COLORS)} value={addDraft.target ?? ""} onChange={(e) => setAddDraft({ ...addDraft, target: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={submitAdd} className="rounded-lg px-4 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: COLORS.accent }}>Save</button>
                  <button onClick={() => setAdding(false)} className="rounded-lg border px-4 py-1.5 text-sm" style={{ borderColor: COLORS.border, color: COLORS.textMuted }}>Cancel</button>
                </div>
              </div>
            )}
          </Panel>
        )}

        {loadingTickers && <p className="mb-4 text-sm" style={{ color: COLORS.textMuted }}>Loading tickers…</p>}
        {loadingQuotes && !loadingTickers && (
          <p className="mb-4 text-sm" style={{ color: COLORS.textMuted }}>
            Fetching live prices from Yahoo Finance… large tabs can take a minute.
          </p>
        )}

        {/* Ticker tables, grouped by segment for the Quantum tab */}
        {!loadingTickers &&
          Object.entries(grouped).map(([segment, rows]) => (
            <Panel key={segment || "flat"} eyebrow={segment || undefined} title={segment ? undefined : TAB_LABELS[activeTab]} className="mb-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr style={{ color: COLORS.textMuted }}>
                      <th className="px-2 py-2 text-left text-xs uppercase">Symbol</th>
                      <th className="px-2 py-2 text-left text-xs uppercase">Name</th>
                      {showStopTarget && <th className="px-2 py-2 text-right text-xs uppercase">Stop Loss</th>}
                      {showStopTarget && <th className="px-2 py-2 text-right text-xs uppercase">Target</th>}
                      <th className="px-2 py-2 text-right text-xs uppercase">Price</th>
                      <th className="px-2 py-2 text-center text-xs uppercase">1H</th>
                      <th className="px-2 py-2 text-center text-xs uppercase">1D</th>
                      <th className="px-2 py-2 text-center text-xs uppercase">1W</th>
                      <th className="px-2 py-2 text-right text-xs uppercase">Daily %</th>
                      <th className="px-2 py-2 text-right text-xs uppercase">Weekly %</th>
                      <th className="px-2 py-2 text-right text-xs uppercase">Monthly %</th>
                      {isAdmin && <th className="px-2 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      const q = quotes[t.symbol];
                      const editing = editingId === t.id;
                      return (
                        <tr key={t.id} className="border-t" style={{ borderColor: COLORS.border }}>
                          <td className="px-2 py-2 font-medium" style={mono}>
                            {editing ? (
                              <input className={`${inputCls} w-24`} style={inputStyle(COLORS)} value={editDraft.symbol ?? ""} onChange={(e) => setEditDraft({ ...editDraft, symbol: e.target.value })} />
                            ) : (
                              t.symbol
                            )}
                          </td>
                          <td className="px-2 py-2" style={{ color: COLORS.textMuted }}>
                            {editing ? (
                              <input className={`${inputCls} w-full`} style={inputStyle(COLORS)} value={editDraft.name ?? ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                            ) : (
                              t.name
                            )}
                          </td>
                          {showStopTarget && (
                            <td className="px-2 py-2 text-right" style={mono}>
                              {editing ? (
                                <input type="number" step={0.01} className={`${inputCls} w-24 text-right`} style={inputStyle(COLORS)} value={editDraft.stopLoss ?? ""} onChange={(e) => setEditDraft({ ...editDraft, stopLoss: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                              ) : t.stopLoss !== null ? (
                                fmtPrice(t.stopLoss)
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          {showStopTarget && (
                            <td className="px-2 py-2 text-right" style={mono}>
                              {editing ? (
                                <input type="number" step={0.01} className={`${inputCls} w-24 text-right`} style={inputStyle(COLORS)} value={editDraft.target ?? ""} onChange={(e) => setEditDraft({ ...editDraft, target: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                              ) : t.target !== null ? (
                                fmtPrice(t.target)
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2 text-right" style={mono}>{q ? fmtPrice(q.price) : "…"}</td>
                          <td className="px-2 py-2 text-center">{q ? <Pill tone={signalTone(q.hourlySignal)}>{q.hourlySignal}</Pill> : "…"}</td>
                          <td className="px-2 py-2 text-center">{q ? <Pill tone={signalTone(q.dailySignal)}>{q.dailySignal}</Pill> : "…"}</td>
                          <td className="px-2 py-2 text-center">{q ? <Pill tone={signalTone(q.weeklySignal)}>{q.weeklySignal}</Pill> : "…"}</td>
                          <td className="px-2 py-2 text-right" style={{ ...mono, color: q ? gainColor(q.dailyGainPct, COLORS) : COLORS.textMuted }}>{q ? fmtPct(q.dailyGainPct) : "…"}</td>
                          <td className="px-2 py-2 text-right" style={{ ...mono, color: q ? gainColor(q.weeklyGainPct, COLORS) : COLORS.textMuted }}>{q ? fmtPct(q.weeklyGainPct) : "…"}</td>
                          <td className="px-2 py-2 text-right" style={{ ...mono, color: q ? gainColor(q.monthlyGainPct, COLORS) : COLORS.textMuted }}>{q ? fmtPct(q.monthlyGainPct) : "…"}</td>
                          {isAdmin && (
                            <td className="px-2 py-2 text-right">
                              {editing ? (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => saveEdit(t.id)} className="rounded px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: COLORS.accent }}>Save</button>
                                  <button onClick={cancelEdit} className="rounded border px-2 py-1 text-xs" style={{ borderColor: COLORS.border, color: COLORS.textMuted }}>Cancel</button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => startEdit(t)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: COLORS.border, color: COLORS.textMuted }}>Edit</button>
                                  <button onClick={() => removeTicker(t)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: COLORS.border, color: COLORS.bad }}>Delete</button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}

        {/* Signal summary — every tab except Quantum, which already has per-segment breakdowns */}
        {!loadingTickers && activeTab !== "quantum" && summaryRows.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: COLORS.border }}>
            <div
              className="px-5 py-3 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: `linear-gradient(90deg, ${COLORS.accent}, #7C5CFF)` }}
            >
              📊 Signal Summary ({tickers.length} tickers)
            </div>
            <div className="overflow-x-auto" style={{ backgroundColor: COLORS.panel }}>
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr style={{ backgroundColor: COLORS.panelAlt, color: COLORS.textMuted }}>
                    <th className="px-4 py-2 text-left text-xs uppercase">Timeframe</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">Buy Count</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">Buy %</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">Sell Count</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">Sell %</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">N/A Count</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">N/A %</th>
                    <th className="px-4 py-2 text-right text-xs uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r, i) => (
                    <tr key={r.timeframe} className="border-t" style={{ borderColor: COLORS.border, backgroundColor: i % 2 === 1 ? COLORS.panelAlt : "transparent" }}>
                      <td className="px-4 py-2.5 font-semibold" style={display}>{r.timeframe}</td>
                      <td className="px-4 py-2.5 text-right" style={mono}>{r.buyCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ ...mono, color: COLORS.good }}>{r.buyPct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right" style={mono}>{r.sellCount}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ ...mono, color: COLORS.bad }}>{r.sellPct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right" style={{ ...mono, color: COLORS.textMuted }}>{r.naCount}</td>
                      <td className="px-4 py-2.5 text-right" style={{ ...mono, color: COLORS.textMuted }}>{r.naPct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={mono}>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
