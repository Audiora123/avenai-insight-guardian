// GoldRush (Covalent) adapter — wallet + token + activity for Solana.
// Foundational + Activity Feed APIs:
//   /v1/{chain}/address/{addr}/balances_v2/
//   /v1/{chain}/address/{addr}/transactions_v3/
//   /v1/{chain}/address/{addr}/portfolio_v2/
//   /v1/address/{addr}/activity/    (cross-chain)
//   /v1/pricing/historical_by_addresses_v2/{chain}/USD/{addrs}/
//   /v1/{chain}/tokens/{addr}/token_holders_v2/

import type { WalletHolding, WalletTx, HolderRow } from "./types";
import { loadTokenList } from "./solana.server";

const KEY = process.env.GOLDRUSH_API_KEY || "";
const BASE = "https://api.covalenthq.com/v1";
const CHAIN = "solana-mainnet";

export const goldrushEnabled = () => Boolean(KEY);

const SOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_GR = "11111111111111111111111111111111";

function authHeader(): HeadersInit {
  // GoldRush accepts `Authorization: Bearer <key>` or `?key=`. Use header to keep URLs clean.
  return { Accept: "application/json", Authorization: `Bearer ${KEY}` };
}

async function gr<T>(path: string): Promise<T | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(`${BASE}${path}`, { headers: authHeader() });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// ---------- Balances (Wallet API) ----------

interface GRBalance {
  contract_address: string;
  contract_ticker_symbol: string | null;
  contract_name: string | null;
  contract_decimals: number;
  logo_urls?: { token_logo_url?: string };
  balance: string;
  quote: number | null;
  quote_rate: number | null;
  is_spam: boolean;
  type: string;
}

interface GRBalancesResp { data: { items: GRBalance[] } | null; error: boolean }

export async function grWalletBalances(owner: string): Promise<WalletHolding[] | null> {
  const j = await gr<GRBalancesResp>(`/${CHAIN}/address/${owner}/balances_v2/?no-spam=true`);
  if (!j || j.error || !j.data) return null;
  const list = await loadTokenList();
  const out: WalletHolding[] = [];
  for (const it of j.data.items) {
    if (it.is_spam) continue;
    const decimals = it.contract_decimals ?? 0;
    const raw = Number(it.balance || "0");
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const amount = raw / Math.pow(10, decimals);
    const mint = it.contract_address === NATIVE_GR ? SOL_MINT : it.contract_address;
    const meta = list.get(mint);
    out.push({
      mint,
      symbol: it.contract_ticker_symbol || meta?.symbol || mint.slice(0, 4).toUpperCase(),
      name: it.contract_name || meta?.name || "Unknown",
      logo: it.logo_urls?.token_logo_url || meta?.logoURI || null,
      amount,
      decimals,
      priceUsd: it.quote_rate,
      valueUsd: it.quote,
    });
  }
  out.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return out;
}

// ---------- Activity Feed (transactions_v3) ----------

interface GRTx {
  block_signed_at: string;
  tx_hash: string;
  successful: boolean;
  from_address?: string;
  to_address?: string;
  value_quote?: number | null;
  pretty_value_quote?: string | null;
  fees_paid?: string | null;
  gas_quote?: number | null;
  log_events?: Array<{ decoded?: { name?: string } | null }>;
}
interface GRTxResp { data: { items: GRTx[] } | null; error: boolean }

export async function grWalletTransactions(owner: string, pageSize = 25): Promise<WalletTx[] | null> {
  const j = await gr<GRTxResp>(`/${CHAIN}/address/${owner}/transactions_v3/?page-size=${pageSize}`);
  if (!j || j.error || !j.data) return null;
  return j.data.items.map((t): WalletTx => {
    const ev = t.log_events?.find((e) => e.decoded?.name)?.decoded?.name ?? null;
    const type: WalletTx["type"] =
      ev?.toLowerCase().includes("swap") ? "swap" :
      ev?.toLowerCase().includes("transfer") ? "transfer" :
      ev?.toLowerCase().includes("stake") ? "stake" :
      ev?.toLowerCase().includes("approve") ? "approval" : "unknown";
    const summary = ev || (t.successful ? "On-chain activity" : "Failed transaction");
    return {
      ts: new Date(t.block_signed_at).getTime(),
      signature: t.tx_hash,
      type,
      summary,
      counterparty: t.to_address ?? null,
      valueUsd: t.value_quote ?? null,
    };
  });
}

// ---------- Cross-chain Address Activity ----------

interface GRActivityChain { name: string; chain_id: number; last_seen_at: string }
interface GRActivityResp { data: { items: GRActivityChain[] } | null; error: boolean }

export async function grAddressActivity(address: string): Promise<GRActivityChain[] | null> {
  const j = await gr<GRActivityResp>(`/address/${address}/activity/`);
  if (!j || j.error || !j.data) return null;
  return j.data.items;
}

// ---------- Native SOL spot price ----------

export async function grNativeSolPrice(): Promise<number | null> {
  const j = await gr<{ data?: Array<{ items: Array<{ price: number }> }> }>(
    `/pricing/historical_by_addresses_v2/${CHAIN}/USD/${NATIVE_GR}/`,
  );
  return j?.data?.[0]?.items?.[0]?.price ?? null;
}

// ---------- Token spot price (Foundational) ----------

export async function grTokenSpotPrice(mint: string): Promise<number | null> {
  const j = await gr<{ data?: Array<{ items: Array<{ price: number }> }> }>(
    `/pricing/historical_by_addresses_v2/${CHAIN}/USD/${mint}/`,
  );
  return j?.data?.[0]?.items?.[0]?.price ?? null;
}

// ---------- Token holders (Foundational) ----------

interface GRHolderItem { address: string; balance: string; total_supply: string; contract_decimals: number }
interface GRHoldersResp { data: { items: GRHolderItem[] } | null; error: boolean }

export async function grTokenHolders(mint: string, pageSize = 20): Promise<HolderRow[] | null> {
  const j = await gr<GRHoldersResp>(`/${CHAIN}/tokens/${mint}/token_holders_v2/?page-size=${pageSize}`);
  if (!j || j.error || !j.data || !j.data.items.length) return null;
  const supply = Number(j.data.items[0].total_supply || "0") / Math.pow(10, j.data.items[0].contract_decimals);
  return j.data.items.map((it, i) => {
    const amt = Number(it.balance) / Math.pow(10, it.contract_decimals);
    return {
      rank: i + 1,
      address: it.address,
      amount: amt,
      pct: supply > 0 ? (amt / supply) * 100 : 0,
      isProgram: false,
    };
  });
}
