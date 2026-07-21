// app/api/quotes/route.ts
//
// POST { symbols: string[] } -> Quote[]
//
// Kept server-side because: (1) Yahoo's unofficial endpoint works more
// reliably called server-to-server than from a browser, and (2) it lets
// us rate-limit/concurrency-limit centrally rather than trusting the
// client. This route itself has no auth check — add one if you want to
// stop non-logged-in traffic from hammering it, e.g. by checking the
// Supabase session cookie.

import { NextRequest, NextResponse } from "next/server";
import { getQuotesBatch } from "@/lib/yahooSignals";

export async function POST(req: NextRequest) {
  let body: { symbols?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.symbols) || body.symbols.some((s) => typeof s !== "string")) {
    return NextResponse.json({ error: "Body must be { symbols: string[] }" }, { status: 400 });
  }

  const symbols = (body.symbols as string[]).slice(0, 300); // hard cap per request
  if (symbols.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const quotes = await getQuotesBatch(symbols, 8);
    return NextResponse.json({ quotes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}
