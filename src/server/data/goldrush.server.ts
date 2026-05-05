// GoldRush (Covalent) adapter — used for wallet portfolio + native pricing.
// Discovery/pricing/holders/swaps for SPL tokens stay on DexScreener + Jupiter + Solana RPC,
// because GoldRush's Solana SPL token endpoints are limited at this time.

import type { WalletHolding } from "./types";
import { loadTokenList } from "./solana.server";

const KEY = process.env.GOLDRUSH_API_KEY || "";
const BASE = "https://api.covalenthq.com/v1";

export const goldrushEnabled = () => Boolean(KEY);

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

interface GRBalancesResp {
  data: { items: GRBalance[] } | null;
  error: boolean;
  error_message?: string;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_GR = "11111111111111111111111111111111";

export async function grWalletBalances(owner: string): Promise<WalletHolding[] | null> {
  if (!KEY) return null;
  try {
    const url = `${BASE}/solana-mainnet/address/${owner}/balances_v2/?key=${KEY}&no-spam=true`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as GRBalancesResp;
    if (j.error || !j.data) return null;

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
  } catch {
    return null;
  }
}

export async function grNativeSolPrice(): Promise<number | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(
      `${BASE}/pricing/historical_by_addresses_v2/solana-mainnet/USD/${NATIVE_GR}/?key=${KEY}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Array<{ items: Array<{ price: number }> }> };
    return j.data?.[0]?.items?.[0]?.price ?? null;
  } catch {
    return null;
  }
}
