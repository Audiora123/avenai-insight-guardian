import { createServerFn } from "@tanstack/react-start";
import {
  getTokenStats,
  getTrending,
  searchTokens,
  getRecentSwaps,
  getTopHolders,
  getWalletHoldings,
  getWalletApprovals,
  getWalletRecentTx,
  getNewSolanaTokens,
  getOHLCV,
  getNativeSolPrice,
  goldrushEnabled,
} from "./data/index.server";
import { scoreToken, scoreWallet } from "./risk";
import { predictByAnalogs, predictByRules } from "./predict";
import { computeSignals } from "./signals";
import type { TrendingToken } from "./data/types";

export const fetchTrending = createServerFn({ method: "GET" }).handler(async () => {
  const [tokens, fresh, solPrice] = await Promise.all([
    getTrending(40),
    getNewSolanaTokens(12),
    getNativeSolPrice(),
  ]);
  return { tokens, fresh, solPrice, goldrush: goldrushEnabled() };
});

export const fetchSearch = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    if (!data.q || data.q.length < 1) return { results: [] };
    const results = await searchTokens(data.q, 12);
    return { results };
  });

export const fetchTokenPage = createServerFn({ method: "GET" })
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data }) => {
    const stats = await getTokenStats(data.mint);
    const [holders, swaps, candles, solPrice] = await Promise.all([
      getTopHolders(data.mint, 20),
      stats?.pairAddress ? getRecentSwaps(stats.pairAddress, 60) : Promise.resolve([]),
      stats?.pairAddress ? getOHLCV(stats.pairAddress, "hour", 1, 168) : Promise.resolve([]),
      getNativeSolPrice(),
    ]);
    const risk = scoreToken(stats, holders);
    const analogs = predictByAnalogs(stats, holders);
    const rules = predictByRules(stats, holders);
    const signals = computeSignals(swaps, holders, stats);
    return { stats, holders, swaps, candles, risk, analogs, rules, signals, solPrice };
  });

// Safer alternatives engine — for Pre-Swap suggestions.
export const fetchSaferAlternatives = createServerFn({ method: "GET" })
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data }) => {
    const [trending, target] = await Promise.all([getTrending(60), getTokenStats(data.mint)]);
    function scoreAlt(t: TrendingToken): number {
      // Higher = safer. Reward liquidity, volume, low price drawdown.
      const liq = Math.log10(Math.max(1, t.liquidityUsd ?? 0));
      const vol = Math.log10(Math.max(1, t.volume24hUsd ?? 0));
      const ch = t.priceChange24h ?? 0;
      const stability = 1 / (1 + Math.abs(ch) / 25);
      return liq * 1.2 + vol + stability * 2;
    }
    const alts = trending
      .filter((t) => t.mint !== data.mint)
      .filter((t) => (t.liquidityUsd ?? 0) > 250_000 && (t.volume24hUsd ?? 0) > 100_000)
      .sort((a, b) => scoreAlt(b) - scoreAlt(a))
      .slice(0, 6);
    return { target, alts };
  });

export const fetchWalletPage = createServerFn({ method: "GET" })
  .inputValidator((d: { address: string }) => d)
  .handler(async ({ data }) => {
    const [holdings, approvals, recent] = await Promise.all([
      getWalletHoldings(data.address),
      getWalletApprovals(data.address),
      getWalletRecentTx(data.address, 25),
    ]);
    const totalUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
    const risk = scoreWallet(holdings, approvals);
    return { holdings, approvals, recent, totalUsd, risk, goldrush: goldrushEnabled() };
  });
