import type { SwapRow, HolderRow, TokenStats } from "./data/types";

export interface LiveSignals {
  whaleBuysUsd: number;          // sum of buy USD by big makers in window
  whaleSellsUsd: number;
  whaleCount: number;            // unique makers with >$5k single trade
  topMakers: Array<{ address: string; netUsd: number; trades: number }>;
  buys: number;
  sells: number;
  buyVolUsd: number;
  sellVolUsd: number;
  buySellRatio: number;          // buyVol / (buyVol+sellVol)
  uniqueMakers: number;
  largestTrade: SwapRow | null;
  volumeSpike: number;           // 0..3 (multiplier vs typical 24h baseline)
  sniperCount: number;           // makers in first 60min after launch
  devConcentrationPct: number;   // sum of top1+top2 (excl. known programs) — proxy
}

const WHALE_USD = 5_000;

export function computeSignals(
  swaps: SwapRow[],
  holders: HolderRow[],
  stats: TokenStats | null,
): LiveSignals {
  const makers = new Map<string, { net: number; trades: number }>();
  let buys = 0, sells = 0, buyVol = 0, sellVol = 0;
  let whaleBuys = 0, whaleSells = 0;
  const whaleSet = new Set<string>();
  let largest: SwapRow | null = null;

  for (const s of swaps) {
    if (s.side === "buy") { buys++; buyVol += s.amountUsd; }
    else { sells++; sellVol += s.amountUsd; }
    if (s.amountUsd >= WHALE_USD && s.maker) {
      whaleSet.add(s.maker);
      if (s.side === "buy") whaleBuys += s.amountUsd; else whaleSells += s.amountUsd;
    }
    if (s.maker) {
      const cur = makers.get(s.maker) ?? { net: 0, trades: 0 };
      cur.trades++;
      cur.net += (s.side === "buy" ? s.amountUsd : -s.amountUsd);
      makers.set(s.maker, cur);
    }
    if (!largest || s.amountUsd > largest.amountUsd) largest = s;
  }

  const totalVol = buyVol + sellVol;
  const buySellRatio = totalVol > 0 ? buyVol / totalVol : 0.5;

  // Volume spike: sample window vs 24h average per minute.
  const sampleSecs = swaps.length > 1 ? (swaps[0].ts - swaps[swaps.length - 1].ts) / 1000 : 0;
  const sampleRateUsdPerHr = sampleSecs > 0 ? (totalVol / sampleSecs) * 3600 : 0;
  const baseline = (stats?.volume24hUsd ?? 0) / 24;
  const volumeSpike = baseline > 0 ? Math.min(5, sampleRateUsdPerHr / baseline) : 0;

  // Sniper count: makers active in first 60min after launch.
  let sniperCount = 0;
  if (stats?.pairCreatedAt) {
    const cutoff = stats.pairCreatedAt + 60 * 60 * 1000;
    const sniperMakers = new Set<string>();
    for (const s of swaps) if (s.ts <= cutoff && s.maker) sniperMakers.add(s.maker);
    sniperCount = sniperMakers.size;
  }

  // Dev/insider proxy: top-2 holders share, since LP/program addresses skew this on Solana.
  const devConcentrationPct = (holders[0]?.pct ?? 0) + (holders[1]?.pct ?? 0);

  const topMakers = [...makers.entries()]
    .map(([address, v]) => ({ address, netUsd: v.net, trades: v.trades }))
    .sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd))
    .slice(0, 6);

  return {
    whaleBuysUsd: whaleBuys,
    whaleSellsUsd: whaleSells,
    whaleCount: whaleSet.size,
    topMakers,
    buys, sells, buyVolUsd: buyVol, sellVolUsd: sellVol, buySellRatio,
    uniqueMakers: makers.size,
    largestTrade: largest,
    volumeSpike,
    sniperCount,
    devConcentrationPct,
  };
}
