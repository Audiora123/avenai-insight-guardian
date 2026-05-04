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
} from "./data/index.server";
import { scoreToken, scoreWallet } from "./risk";
import { predictByAnalogs, predictByRules } from "./predict";

export const fetchTrending = createServerFn({ method: "GET" }).handler(async () => {
  const tokens = await getTrending(24);
  return { tokens };
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
    const [stats, holders] = await Promise.all([
      getTokenStats(data.mint),
      getTopHolders(data.mint, 20),
    ]);
    const swaps = stats?.pairAddress ? await getRecentSwaps(stats.pairAddress, 25) : [];
    const risk = scoreToken(stats, holders);
    const analogs = predictByAnalogs(stats, holders);
    const rules = predictByRules(stats, holders);
    return { stats, holders, swaps, risk, analogs, rules };
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
    return { holdings, approvals, recent, totalUsd, risk };
  });
