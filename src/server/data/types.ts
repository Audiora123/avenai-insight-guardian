// Avenai data-source contract.
// Implementations: today = jupiter + dexscreener + solana RPC (no key needed).
// Tomorrow = swap to GoldRush by changing the import in `src/server/data/index.server.ts`.

export type Chain = "solana";

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
}

export interface TokenStats {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  priceChange1h: number | null;
  priceChange5m: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairAddress: string | null;
  dex: string | null;
  pairCreatedAt: number | null;   // ms epoch
  ageHours: number | null;
}

export interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
}

export interface SwapRow {
  ts: number;            // ms epoch
  side: "buy" | "sell";
  priceUsd: number;
  amountToken: number;
  amountUsd: number;
  txSig: string;
  maker: string | null;
}

export interface HolderRow {
  rank: number;
  address: string;
  amount: number;
  pct: number;             // % of supply
  isProgram: boolean;
}

export interface WalletHolding {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  amount: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface WalletApproval {
  programId: string;
  programLabel: string | null;
  mint: string;
  symbol: string | null;
  delegatedAmount: number;
  isUnlimited: boolean;
  riskLevel: "safe" | "caution" | "danger";
  reason: string;
}

export interface WalletTx {
  ts: number;
  signature: string;
  type: "swap" | "transfer" | "nft" | "stake" | "approval" | "unknown";
  summary: string;
  counterparty: string | null;
  valueUsd: number | null;
}
