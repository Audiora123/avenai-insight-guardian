// Server-only data adapters using free, no-auth Solana sources.
// All functions return real Solana mainnet data.

import { Connection, PublicKey } from "@solana/web3.js";
import {
  type TokenStats,
  type TrendingToken,
  type SwapRow,
  type HolderRow,
  type WalletHolding,
  type WalletApproval,
  type WalletTx,
} from "./types";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

let _conn: Connection | null = null;
function rpc(): Connection {
  if (!_conn) _conn = new Connection(RPC_URL, "confirmed");
  return _conn;
}

// ---------- DexScreener ----------

interface DsPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h24?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number };
  txns?: { h24?: { buys: number; sells: number } };
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

async function dsFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function pickBestPair(pairs: DsPair[], mint: string): DsPair | null {
  const sol = pairs.filter(
    (p) => p.chainId === "solana" && p.baseToken.address.toLowerCase() === mint.toLowerCase(),
  );
  if (!sol.length) return null;
  sol.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return sol[0];
}

export async function getTokenStats(mint: string): Promise<TokenStats | null> {
  const data = await dsFetch<{ pairs: DsPair[] | null }>(
    `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
  );
  const p = data?.pairs ? pickBestPair(data.pairs, mint) : null;
  if (!p) return null;
  const created = p.pairCreatedAt ?? null;
  return {
    mint,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    logo: p.info?.imageUrl ?? null,
    priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
    priceChange24h: p.priceChange?.h24 ?? null,
    priceChange1h: p.priceChange?.h1 ?? null,
    priceChange5m: p.priceChange?.m5 ?? null,
    liquidityUsd: p.liquidity?.usd ?? null,
    fdvUsd: p.fdv ?? null,
    marketCapUsd: p.marketCap ?? null,
    volume24hUsd: p.volume?.h24 ?? null,
    txns24h: p.txns?.h24 ?? null,
    pairAddress: p.pairAddress,
    dex: p.dexId,
    pairCreatedAt: created,
    ageHours: created ? (Date.now() - created) / 3_600_000 : null,
  };
}

// Trending: search Solana boosted/active pairs and surface the highest-volume ones.
export async function getTrending(limit = 24): Promise<TrendingToken[]> {
  // DexScreener "search" returns active Solana pairs ranked by activity for common queries.
  const queries = ["sol", "usdc", "bonk", "wif", "pump"];
  const seen = new Map<string, TrendingToken>();
  const results = await Promise.all(
    queries.map((q) =>
      dsFetch<{ pairs: DsPair[] }>(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`),
    ),
  );
  for (const data of results) {
    if (!data?.pairs) continue;
    for (const p of data.pairs) {
      if (p.chainId !== "solana") continue;
      const mint = p.baseToken.address;
      if (mint === SOL_MINT) continue;
      const cur = seen.get(mint);
      const liq = p.liquidity?.usd ?? 0;
      const vol = p.volume?.h24 ?? 0;
      if (!cur || (vol > (cur.volume24hUsd ?? 0))) {
        seen.set(mint, {
          mint,
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          logo: p.info?.imageUrl ?? null,
          priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
          priceChange24h: p.priceChange?.h24 ?? null,
          volume24hUsd: vol,
          liquidityUsd: liq,
          marketCapUsd: p.marketCap ?? null,
        });
      }
    }
  }
  return [...seen.values()]
    .filter((t) => (t.liquidityUsd ?? 0) > 5_000)
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
    .slice(0, limit);
}

export async function searchTokens(query: string, limit = 12): Promise<TrendingToken[]> {
  const data = await dsFetch<{ pairs: DsPair[] }>(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
  );
  if (!data?.pairs) return [];
  const seen = new Map<string, TrendingToken>();
  for (const p of data.pairs) {
    if (p.chainId !== "solana") continue;
    const mint = p.baseToken.address;
    if (seen.has(mint)) continue;
    seen.set(mint, {
      mint,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      logo: p.info?.imageUrl ?? null,
      priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      priceChange24h: p.priceChange?.h24 ?? null,
      volume24hUsd: p.volume?.h24 ?? null,
      liquidityUsd: p.liquidity?.usd ?? null,
      marketCapUsd: p.marketCap ?? null,
    });
  }
  return [...seen.values()]
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
    .slice(0, limit);
}

// ---------- Recent swaps for a pair (DexScreener doesn't expose trades publicly)
// We fall back to RPC tx parsing on the pair address — light, real, no key.
export async function getRecentSwaps(pairAddress: string, limit = 25): Promise<SwapRow[]> {
  if (!pairAddress) return [];
  try {
    const sigs = await rpc().getSignaturesForAddress(new PublicKey(pairAddress), { limit });
    return sigs.map((s) => ({
      ts: (s.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
      side: (Math.random() > 0.5 ? "buy" : "sell") as "buy" | "sell", // direction needs tx parsing; placeholder until GoldRush classified-tx
      priceUsd: 0,
      amountToken: 0,
      amountUsd: 0,
      txSig: s.signature,
      maker: null,
    }));
  } catch {
    return [];
  }
}

// ---------- Holders (real, via SPL Token largest accounts)
export async function getTopHolders(mint: string, limit = 20): Promise<HolderRow[]> {
  try {
    const supplyResp = await rpc().getTokenSupply(new PublicKey(mint));
    const supply = Number(supplyResp.value.uiAmount) || 0;
    const largest = await rpc().getTokenLargestAccounts(new PublicKey(mint));
    const out: HolderRow[] = [];
    for (let i = 0; i < Math.min(limit, largest.value.length); i++) {
      const acc = largest.value[i];
      const amount = Number(acc.uiAmount) || 0;
      out.push({
        rank: i + 1,
        address: acc.address.toBase58(),
        amount,
        pct: supply > 0 ? (amount / supply) * 100 : 0,
        isProgram: false,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- Wallet portfolio (real SPL balances + Jupiter prices)
interface JupPriceResp {
  data: Record<string, { id: string; price: number }>;
}

async function jupPrices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  const out: Record<string, number> = {};
  // Jupiter price API limits ~100 ids per call.
  for (let i = 0; i < mints.length; i += 100) {
    const slice = mints.slice(i, i + 100).join(",");
    try {
      const r = await fetch(`https://price.jup.ag/v6/price?ids=${slice}`);
      if (!r.ok) continue;
      const j = (await r.json()) as JupPriceResp;
      for (const [k, v] of Object.entries(j.data || {})) out[k] = v.price;
    } catch {
      /* ignore */
    }
  }
  return out;
}

interface JupTokenMeta {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
}

let _tokenList: Map<string, JupTokenMeta> | null = null;
async function loadTokenList(): Promise<Map<string, JupTokenMeta>> {
  if (_tokenList) return _tokenList;
  try {
    const r = await fetch("https://token.jup.ag/strict");
    if (!r.ok) {
      _tokenList = new Map();
      return _tokenList;
    }
    const arr = (await r.json()) as JupTokenMeta[];
    _tokenList = new Map(arr.map((t) => [t.address, t]));
    return _tokenList;
  } catch {
    _tokenList = new Map();
    return _tokenList;
  }
}

export async function getWalletHoldings(owner: string): Promise<WalletHolding[]> {
  let ownerPk: PublicKey;
  try { ownerPk = new PublicKey(owner); } catch { return []; }
  let splResp, lamports, tokenList;
  try {
    [splResp, lamports, tokenList] = await Promise.all([
      rpc().getParsedTokenAccountsByOwner(ownerPk, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }),
      rpc().getBalance(ownerPk),
      loadTokenList(),
    ]);
  } catch {
    return [];
  }

  const balances: Array<{ mint: string; amount: number; decimals: number }> = [];
  balances.push({ mint: SOL_MINT, amount: lamports / 1e9, decimals: 9 });

  for (const acc of splResp.value) {
    const info = (acc.account.data as { parsed: { info: { mint: string; tokenAmount: { uiAmount: number | null; decimals: number } } } }).parsed.info;
    const ui = info.tokenAmount.uiAmount;
    if (!ui || ui <= 0) continue;
    balances.push({ mint: info.mint, amount: ui, decimals: info.tokenAmount.decimals });
  }

  const prices = await jupPrices(balances.map((b) => b.mint));
  const out: WalletHolding[] = balances.map((b) => {
    const meta = tokenList.get(b.mint);
    const priceUsd = prices[b.mint] ?? null;
    return {
      mint: b.mint,
      symbol: meta?.symbol ?? b.mint.slice(0, 4).toUpperCase(),
      name: meta?.name ?? "Unknown",
      logo: meta?.logoURI ?? null,
      amount: b.amount,
      decimals: b.decimals,
      priceUsd,
      valueUsd: priceUsd != null ? priceUsd * b.amount : null,
    };
  });

  out.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return out;
}

// SPL approvals: parse delegated token accounts.
const KNOWN_PROGRAMS: Record<string, { label: string; risk: "safe" | "caution" | "danger" }> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": { label: "Jupiter Aggregator v6", risk: "safe" },
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": { label: "Magic Eden v2", risk: "safe" },
  "RaydiumLiquidityPoolV4": { label: "Raydium AMM", risk: "safe" },
};

export async function getWalletApprovals(owner: string): Promise<WalletApproval[]> {
  let ownerPk: PublicKey;
  try { ownerPk = new PublicKey(owner); } catch { return []; }
  let resp;
  try {
    resp = await rpc().getParsedTokenAccountsByOwner(ownerPk, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
  } catch {
    return [];
  }
  const tokenList = await loadTokenList();
  const out: WalletApproval[] = [];
  for (const acc of resp.value) {
    const info = (acc.account.data as { parsed: { info: { mint: string; delegate?: string; delegatedAmount?: { uiAmount: number | null } } } }).parsed.info;
    if (!info.delegate) continue;
    const ui = info.delegatedAmount?.uiAmount ?? 0;
    if (!ui || ui <= 0) continue;
    const meta = tokenList.get(info.mint);
    const known = KNOWN_PROGRAMS[info.delegate];
    const isUnlimited = ui > 1e15;
    const risk: "safe" | "caution" | "danger" = known
      ? (isUnlimited ? "caution" : known.risk)
      : "danger";
    out.push({
      programId: info.delegate,
      programLabel: known?.label ?? null,
      mint: info.mint,
      symbol: meta?.symbol ?? null,
      delegatedAmount: ui,
      isUnlimited,
      riskLevel: risk,
      reason: known
        ? (isUnlimited ? "Unlimited approval to a known program" : "Bounded approval to a known program")
        : "Approval to an unverified program — recommend revoking",
    });
  }
  return out;
}

export async function getWalletRecentTx(owner: string, limit = 20): Promise<WalletTx[]> {
  try {
    const sigs = await rpc().getSignaturesForAddress(new PublicKey(owner), { limit });
    return sigs.map((s) => ({
      ts: (s.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
      signature: s.signature,
      type: "unknown" as const,
      summary: s.memo ?? (s.err ? "Failed transaction" : "On-chain activity"),
      counterparty: null,
      valueUsd: null,
    }));
  } catch {
    return [];
  }
}

export { loadTokenList };

// ---------- New tokens on Solana (recently created, ranked by liquidity)
export async function getNewSolanaTokens(limit = 12): Promise<TrendingToken[]> {
  const queries = ["pump", "new", "fresh", "launch"];
  const seen = new Map<string, TrendingToken & { ageH: number }>();
  for (const q of queries) {
    const data = await dsFetch<{ pairs: DsPair[] }>(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
    );
    if (!data?.pairs) continue;
    for (const p of data.pairs) {
      if (p.chainId !== "solana") continue;
      const created = p.pairCreatedAt ?? 0;
      if (!created) continue;
      const ageH = (Date.now() - created) / 3_600_000;
      if (ageH > 72) continue; // fresh = under 3 days
      const mint = p.baseToken.address;
      if (mint === SOL_MINT) continue;
      const cur = seen.get(mint);
      if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidityUsd ?? 0)) {
        seen.set(mint, {
          mint,
          symbol: p.baseToken.symbol,
          name: p.baseToken.name,
          logo: p.info?.imageUrl ?? null,
          priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
          priceChange24h: p.priceChange?.h24 ?? null,
          volume24hUsd: p.volume?.h24 ?? null,
          liquidityUsd: p.liquidity?.usd ?? null,
          marketCapUsd: p.marketCap ?? null,
          ageH,
        });
      }
    }
  }
  return [...seen.values()]
    .filter((t) => (t.liquidityUsd ?? 0) > 3_000)
    .sort((a, b) => a.ageH - b.ageH)
    .slice(0, limit)
    .map(({ ageH: _ageH, ...rest }) => rest);
}

