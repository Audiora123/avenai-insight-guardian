// Single import point for the data layer.
// SPL discovery/pricing/holders → Solana RPC + DexScreener + Jupiter (no key needed).
// Wallet portfolio → GoldRush (Covalent) when key present, RPC fallback otherwise.

import * as solana from "./solana.server";
import { grWalletBalances, grNativeSolPrice, goldrushEnabled } from "./goldrush.server";
import type { WalletHolding } from "./types";

export const getTokenStats = solana.getTokenStats;
export const getTrending = solana.getTrending;
export const searchTokens = solana.searchTokens;
export const getRecentSwaps = solana.getRecentSwaps;
export const getTopHolders = solana.getTopHolders;
export const getWalletApprovals = solana.getWalletApprovals;
export const getWalletRecentTx = solana.getWalletRecentTx;
export const getNewSolanaTokens = solana.getNewSolanaTokens;

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
