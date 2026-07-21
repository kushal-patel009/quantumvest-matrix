/**
 * yahooSignals.ts — SERVER-ONLY. Do not import from client components.
 *
 * Ports the signal/gain logic from the original Python script:
 * - EMA(8) vs SMA(21) crossover -> BUY/SELL, computed separately for
 *   hourly, daily, and weekly timeframes.
 * - Daily/weekly/monthly % gain off the daily close series.
 *
 * Yahoo's chart endpoint has no official support contract — it can
 * change or rate-limit without notice, same caveat as the yfinance
 * library your Python script used. Retries + fallback ranges here
 * mirror the Python script's approach to riding out transient failures.
 */

import type { Quote, Signal } from "./types";

const TIMEFRAME_CONFIG: Record<"1h" | "1d" | "1wk", { range: string; interval: string }> = {
  "1h": { range: "5d", interval: "1h" },
  "1d": { range: "3mo", interval: "1d" },
  "1wk": { range: "2y", interval: "1wk" },
};

interface ChartSeries {
  timestamps: number[];
  closes: number[];
}

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string,
  attempt = 0
): Promise<ChartSeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}`;

  try {
    const res = await fetch(url, {
      headers: {
        // Yahoo's chart endpoint is more reliable with a browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      // Yahoo occasionally hangs; don't let one symbol stall the whole batch.
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return fetchYahooChart(symbol, range, interval, attempt + 1);
      }
      return null;
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closesRaw: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    // Filter out null bars (Yahoo pads gaps with null rather than omitting).
    const timestamps2: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < closesRaw.length; i++) {
      if (closesRaw[i] !== null && closesRaw[i] !== undefined) {
        timestamps2.push(timestamps[i]);
        closes.push(closesRaw[i] as number);
      }
    }

    if (closes.length === 0) return null;
    return { timestamps: timestamps2, closes };
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchYahooChart(symbol, range, interval, attempt + 1);
    }
    return null;
  }
}

function computeEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const alpha = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = alpha * closes[i] + (1 - alpha) * ema;
  }
  return ema;
}

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function signalFrom(ema8: number | null, sma21: number | null): Signal {
  if (ema8 === null || sma21 === null) return "N/A";
  return ema8 > sma21 ? "BUY" : "SELL";
}

async function getSignalForTimeframe(symbol: string, tf: "1h" | "1d" | "1wk"): Promise<Signal> {
  const { range, interval } = TIMEFRAME_CONFIG[tf];
  const series = await fetchYahooChart(symbol, range, interval);
  if (!series || series.closes.length < 21) return "N/A";
  const ema8 = computeEMA(series.closes, 8);
  const sma21 = computeSMA(series.closes, 21);
  return signalFrom(ema8, sma21);
}

async function getGains(symbol: string): Promise<{
  price: number | null;
  dailyGainPct: number | null;
  weeklyGainPct: number | null;
  monthlyGainPct: number | null;
}> {
  let series = await fetchYahooChart(symbol, "3mo", "1d");
  if (!series || series.closes.length < 2) {
    series = await fetchYahooChart(symbol, "1mo", "1d");
  }
  if (!series || series.closes.length === 0) {
    return { price: null, dailyGainPct: null, weeklyGainPct: null, monthlyGainPct: null };
  }

  const closes = series.closes;
  const current = closes[closes.length - 1];

  const dailyGainPct =
    closes.length >= 2 ? ((current - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 : null;

  const weekIdx = closes.length - 1 - Math.min(5, closes.length - 1);
  const weeklyGainPct =
    closes.length >= 5 && closes[weekIdx] > 0 ? ((current - closes[weekIdx]) / closes[weekIdx]) * 100 : null;

  const monthIdx = closes.length - 1 - Math.min(20, closes.length - 1);
  const monthlyGainPct =
    closes.length >= 20 && closes[monthIdx] > 0 ? ((current - closes[monthIdx]) / closes[monthIdx]) * 100 : null;

  return { price: current, dailyGainPct, weeklyGainPct, monthlyGainPct };
}

export async function getQuote(symbol: string): Promise<Quote> {
  try {
    const [hourly, daily, weekly, gains] = await Promise.all([
      getSignalForTimeframe(symbol, "1h"),
      getSignalForTimeframe(symbol, "1d"),
      getSignalForTimeframe(symbol, "1wk"),
      getGains(symbol),
    ]);

    return {
      symbol,
      price: gains.price,
      hourlySignal: hourly,
      dailySignal: daily,
      weeklySignal: weekly,
      dailyGainPct: gains.dailyGainPct,
      weeklyGainPct: gains.weeklyGainPct,
      monthlyGainPct: gains.monthlyGainPct,
    };
  } catch (e) {
    return {
      symbol,
      price: null,
      hourlySignal: "N/A",
      dailySignal: "N/A",
      weeklySignal: "N/A",
      dailyGainPct: null,
      weeklyGainPct: null,
      monthlyGainPct: null,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/**
 * Fetches quotes for many symbols with bounded concurrency (mirrors the
 * Python script's ThreadPoolExecutor(max_workers=10)) so a large tab
 * (e.g. Quantum's 200+ tickers) doesn't fire 200 simultaneous requests
 * at Yahoo and get rate-limited.
 */
export async function getQuotesBatch(symbols: string[], concurrency = 8): Promise<Quote[]> {
  const results: Quote[] = new Array(symbols.length);
  let index = 0;

  async function worker() {
    while (index < symbols.length) {
      const i = index++;
      results[i] = await getQuote(symbols[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
