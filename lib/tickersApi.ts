import { supabase } from "./supabaseClient";
import type { Ticker, TabKey } from "./types";

interface TickerRow {
  id: string;
  tab: string;
  segment: string | null;
  symbol: string;
  name: string;
  stop_loss: number | null;
  target: number | null;
}

function rowToTicker(row: TickerRow): Ticker {
  return {
    id: row.id,
    tab: row.tab as TabKey,
    segment: row.segment,
    symbol: row.symbol,
    name: row.name,
    stopLoss: row.stop_loss,
    target: row.target,
  };
}

export async function fetchTickers(tab: TabKey): Promise<Ticker[]> {
  const { data, error } = await supabase
    .from("tickers")
    .select("*")
    .eq("tab", tab)
    .order("symbol", { ascending: true });

  if (error) {
    console.error("fetchTickers error:", error.message);
    throw new Error(error.message);
  }
  return (data as TickerRow[]).map(rowToTicker);
}

export async function addTicker(input: {
  tab: TabKey;
  segment: string | null;
  symbol: string;
  name: string;
  stopLoss: number | null;
  target: number | null;
}): Promise<Ticker> {
  const { data, error } = await supabase
    .from("tickers")
    .insert({
      tab: input.tab,
      segment: input.segment,
      symbol: input.symbol.toUpperCase().trim(),
      name: input.name,
      stop_loss: input.stopLoss,
      target: input.target,
    })
    .select()
    .single();

  if (error) {
    console.error("addTicker error:", error.message);
    throw new Error(error.message);
  }
  return rowToTicker(data as TickerRow);
}

export async function updateTicker(
  id: string,
  patch: Partial<Pick<Ticker, "symbol" | "name" | "stopLoss" | "target" | "segment">>
): Promise<Ticker> {
  const row: Record<string, unknown> = {};
  if (patch.symbol !== undefined) row.symbol = patch.symbol.toUpperCase().trim();
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.stopLoss !== undefined) row.stop_loss = patch.stopLoss;
  if (patch.target !== undefined) row.target = patch.target;
  if (patch.segment !== undefined) row.segment = patch.segment;
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("tickers").update(row).eq("id", id).select().single();
  if (error) {
    console.error("updateTicker error:", error.message);
    throw new Error(error.message);
  }
  return rowToTicker(data as TickerRow);
}

export async function deleteTicker(id: string): Promise<void> {
  const { error } = await supabase.from("tickers").delete().eq("id", id);
  if (error) {
    console.error("deleteTicker error:", error.message);
    throw new Error(error.message);
  }
}

/**
 * Bulk upsert for the Excel import feature. Matches existing rows by
 * (tab, symbol) and updates name/stopLoss/target if found, otherwise
 * inserts a new row. Runs as individual upserts rather than a single
 * batch call so one bad row doesn't fail the whole import.
 */
export async function bulkUpsertTickers(
  tab: TabKey,
  rows: { symbol: string; name: string; stopLoss?: number | null; target?: number | null; segment?: string | null }[]
): Promise<{ succeeded: number; failed: { symbol: string; error: string }[] }> {
  let succeeded = 0;
  const failed: { symbol: string; error: string }[] = [];

  for (const r of rows) {
    const symbol = r.symbol.toUpperCase().trim();
    if (!symbol) continue;
    try {
      const { error } = await supabase.from("tickers").upsert(
        {
          tab,
          segment: r.segment ?? null,
          symbol,
          name: r.name ?? "",
          stop_loss: r.stopLoss ?? null,
          target: r.target ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tab,symbol" }
      );
      if (error) throw new Error(error.message);
      succeeded++;
    } catch (e) {
      failed.push({ symbol, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return { succeeded, failed };
}
