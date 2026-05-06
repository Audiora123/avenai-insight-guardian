// GeckoTerminal public API — no key required.
// Provides classified swaps (buy/sell + USD + maker) and OHLCV candles for any Solana pair.

import type { SwapRow } from "./types";

const BASE = "https://api.geckoterminal.com/api/v2";

interface GTTradeAttrs {
  block_timestamp: string;
  tx_hash: string;
  tx_from_address: string;
  kind: "buy" | "sell";
  volume_in_usd: string;
  from_token_amount: string;
  to_token_amount: string;
  price_to_in_usd?: string;
  price_from_in_usd?: string;
}
interface GTTrade { id: string; type: "trade"; attributes: GTTradeAttrs }

export async function gtPairTrades(pairAddress: string, limit = 50): Promise<SwapRow[]> {
  if (!pairAddress) return [];
  try {
    const r = await fetch(`${BASE}/networks/solana/pools/${pairAddress}/trades`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { data: GTTrade[] };
    const rows: SwapRow[] = (j.data || []).slice(0, limit).map((t) => {
      const a = t.attributes;
      return {
        ts: new Date(a.block_timestamp).getTime(),
        side: a.kind,
        priceUsd: Number(a.price_from_in_usd ?? a.price_to_in_usd ?? 0),
        amountToken: Number(a.kind === "buy" ? a.to_token_amount : a.from_token_amount),
        amountUsd: Number(a.volume_in_usd),
        txSig: a.tx_hash,
        maker: a.tx_from_address,
      };
    });
    return rows;
  } catch {
    return [];
  }
}

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

export async function gtPairOHLCV(
  pairAddress: string,
  timeframe: "minute" | "hour" | "day" = "hour",
  aggregate = 1,
  limit = 168,
): Promise<Candle[]> {
  if (!pairAddress) return [];
  try {
    const url = `${BASE}/networks/solana/pools/${pairAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      data: { attributes: { ohlcv_list: number[][] } };
    };
    const arr = j.data?.attributes?.ohlcv_list ?? [];
    return arr
      .map((row) => ({ t: row[0] * 1000, o: row[1], h: row[2], l: row[3], c: row[4], v: row[5] }))
      .sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}
