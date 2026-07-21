export type TabKey = "quantum" | "schwab_institutional" | "schwab_all" | "algo";

export const TAB_LABELS: Record<TabKey, string> = {
  quantum: "Quantum Investment Matrix",
  schwab_institutional: "Schwab Portfolios (Institutional Clients)",
  schwab_all: "Schwab Portfolios (ALL Clients)",
  algo: "Algo Buy/Sell Data",
};

export const TAB_ORDER: TabKey[] = ["quantum", "schwab_institutional", "schwab_all", "algo"];

export interface Ticker {
  id: string;
  tab: TabKey;
  segment: string | null;
  symbol: string;
  name: string;
  stopLoss: number | null;
  target: number | null;
}

export type Signal = "BUY" | "SELL" | "N/A";

export interface Quote {
  symbol: string;
  price: number | null;
  hourlySignal: Signal;
  dailySignal: Signal;
  weeklySignal: Signal;
  dailyGainPct: number | null;
  weeklyGainPct: number | null;
  monthlyGainPct: number | null;
  error?: string;
}
