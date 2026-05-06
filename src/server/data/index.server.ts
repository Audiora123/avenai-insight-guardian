// Single import point for the data layer.
// SPL discovery/pricing → DexScreener + Jupiter
// Holders → Solana RPC
// Classified trades + OHLCV → GeckoTerminal
// Wallet portfolio + native pricing → GoldRush (Covalent), RPC fallback

import * as solana from "./solana.server";
import { grWalletBalances, grNativeSolPrice, goldrushEnabled } from "./goldrush.server";
import { gtPairTrades, gtPairOHLCV } from "./geckoterminal.server";
import type { WalletHolding, SwapRow } from "./types";

export const getTokenStats = solana.getTokenStats;
export const getTrending = solana.getTrending;
export const searchTokens = solana.searchTokens;
export const getTopHolders = solana.getTopHolders;
export const getWalletApprovals = solana.getWalletApprovals;
export const getWalletRecentTx = solana.getWalletRecentTx;
export const getNewSolanaTokens = solana.getNewSolanaTokens;
export const getOHLCV = gtPairOHLCV;

export async function getRecentSwaps(pairAddress: string, limit = 50): Promise<SwapRow[]> {
  // Prefer GeckoTerminal classified trades; fallback to RPC sigs (no classification).
  const gt = await gtPairTrades(pairAddress, limit);
  if (gt.length > 0) return gt;
  return solana.getRecentSwaps(pairAddress, limit);
}

export async function getWalletHoldings(owner: string): Promise<WalletHolding[]> {
  if (goldrushEnabled()) {
    const gr = await grWalletBalances(owner);
    if (gr && gr.length > 0) return gr;
  }
  return solana.getWalletHoldings(owner);
}

export async function getNativeSolPrice(): Promise<number | null> {
  if (goldrushEnabled()) {
    const p = await grNativeSolPrice();
    if (p != null) return p;
  }
  return null;
}

export { goldrushEnabled };
