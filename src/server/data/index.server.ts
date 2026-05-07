// Single import point for the data layer.
// SPL discovery/pricing → DexScreener + Jupiter
// Holders → GoldRush → fallback Solana RPC
// Classified trades + OHLCV → GeckoTerminal
// Wallet portfolio + activity + native pricing → GoldRush, RPC fallback

import * as solana from "./solana.server";
import {
  grWalletBalances,
  grWalletTransactions,
  grNativeSolPrice,
  grTokenHolders,
  goldrushEnabled,
} from "./goldrush.server";
import { gtPairTrades, gtPairOHLCV } from "./geckoterminal.server";
import type { WalletHolding, WalletTx, SwapRow, HolderRow } from "./types";

export const getTokenStats = solana.getTokenStats;
export const getTrending = solana.getTrending;
export const searchTokens = solana.searchTokens;
export const getWalletApprovals = solana.getWalletApprovals;
export const getNewSolanaTokens = solana.getNewSolanaTokens;
export const getOHLCV = gtPairOHLCV;

export async function getRecentSwaps(pairAddress: string, limit = 50): Promise<SwapRow[]> {
  // GeckoTerminal classified trades; fallback to RPC sigs (no classification).
  const gt = await gtPairTrades(pairAddress, limit);
  if (gt.length > 0) return gt;
  return solana.getRecentSwaps(pairAddress, limit);
}

export async function getTopHolders(mint: string, limit = 20): Promise<HolderRow[]> {
  if (goldrushEnabled()) {
    const gr = await grTokenHolders(mint, limit);
    if (gr && gr.length > 0) return gr;
  }
  return solana.getTopHolders(mint, limit);
}

export async function getWalletHoldings(owner: string): Promise<WalletHolding[]> {
  if (goldrushEnabled()) {
    const gr = await grWalletBalances(owner);
    if (gr && gr.length > 0) return gr;
  }
  return solana.getWalletHoldings(owner);
}

export async function getWalletRecentTx(owner: string, limit = 25): Promise<WalletTx[]> {
  if (goldrushEnabled()) {
    const gr = await grWalletTransactions(owner, limit);
    if (gr && gr.length > 0) return gr;
  }
  return solana.getWalletRecentTx(owner, limit);
}

export async function getNativeSolPrice(): Promise<number | null> {
  if (goldrushEnabled()) {
    const p = await grNativeSolPrice();
    if (p != null) return p;
  }
  return null;
}

export { goldrushEnabled };
