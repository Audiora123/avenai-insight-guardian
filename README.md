# Avenai — Solana Token & Wallet Intelligence

Avenai is a pre-swap intelligence layer for Solana traders. It scores tokens, x-rays
wallets, surfaces whales and volume spikes, and lets users execute swaps — all in one
place — so they can avoid bad routes before they sign.

---

## Problem

Solana traders constantly face:
- Rugs, honeypots, and tokens with concentrated insider supply
- Low-liquidity routes that dump price on entry
- Fragmented data: holders on one site, charts on another, swap on a third

Most aggregators show you a price quote — none of them show you whether the
trade itself is *safe*.

## Solution

Avenai unifies discovery, risk verdict, and execution:

1. **Discover** — trending Solana tokens with live 24h price, volume, liquidity.
2. **Pre-swap check** — risk score, holder concentration, whale flow, sniper
   count, volume spike, sizing simulator with price-impact estimate.
3. **Safer alternatives** — when a token is risky, suggest higher-liquidity
   tokens with stable price action.
4. **Swap in-app** — execute the swap directly inside Avenai with the
   user's connected Phantom/Solana wallet.
5. **Wallet x-ray** — paste any address to see holdings, approvals, recent
   activity, USD value, and risk hygiene.

## Goals

- Make every number on the page **real**, **live**, and **interactive**
- Zero dead-ends: every signal links to a source (Solscan tx / address)
- Sub-second perceived latency via background revalidation, not spinners
- One place to *understand* and then *execute* a swap

---

## GoldRush API Usage

GoldRush (Covalent's unified blockchain data layer) is the primary data
source for wallet, holder and pricing data. Implementation lives in
[`src/server/data/goldrush.server.ts`](src/server/data/goldrush.server.ts).

| Feature in Avenai            | GoldRush endpoint                                                  | Function                  |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Wallet holdings (USD value)  | `/v1/solana-mainnet/address/{addr}/balances_v2/`                   | `grWalletBalances`        |
| Wallet activity feed         | `/v1/solana-mainnet/address/{addr}/transactions_v3/`               | `grWalletTransactions`    |
| Cross-chain address activity | `/v1/address/{addr}/activity/`                                     | `grAddressActivity`       |
| Native SOL spot price        | `/v1/pricing/historical_by_addresses_v2/solana-mainnet/USD/.../`   | `grNativeSolPrice`        |
| Token spot price             | `/v1/pricing/historical_by_addresses_v2/solana-mainnet/USD/{mint}/`| `grTokenSpotPrice`        |
| Top token holders            | `/v1/solana-mainnet/tokens/{mint}/token_holders_v2/`               | `grTokenHolders`          |

The router in [`src/server/data/index.server.ts`](src/server/data/index.server.ts)
prefers GoldRush whenever a key is present, and falls back to RPC only when
GoldRush returns empty.

### Where each call surfaces in the UI

- **Home (`/`)** — `grNativeSolPrice` (SOL/USD pill, live ticker)
- **Token page (`/token/:mint`)** — `grTokenHolders` (holders tab + concentration card), `grTokenSpotPrice` (price fallback), `grNativeSolPrice` (swap widget USD conversion)
- **Pre-swap page (`/preswap/:mint`)** — same as token page + swap-sizing simulator
- **Wallet page (`/wallet/:address`)** — `grWalletBalances` (holdings + USD totals), `grWalletTransactions` (activity feed), `grAddressActivity` (cross-chain footprint)

---

## Architecture Map

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (Avenai UI)                          │
│  TanStack Start • React 19 • Tailwind • lightweight-charts           │
│                                                                      │
│  ┌────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────────┐   │
│  │  /     │   │ /token/:mint │   │ /preswap  │   │ /wallet/:a   │   │
│  └───┬────┘   └──────┬───────┘   └─────┬─────┘   └──────┬───────┘   │
└──────┼───────────────┼─────────────────┼────────────────┼───────────┘
       │ loader        │ loader          │ loader         │ loader
       ▼               ▼                 ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Server Functions (createServerFn — Worker)              │
│                                                                      │
│  fetchTrending  fetchTokenPage  fetchSaferAlternatives  fetchWallet  │
└──────┬────────────────┬────────────────┬───────────────────┬─────────┘
       │                │                │                   │
       ▼                ▼                ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Data Layer (src/server/data)                      │
│                                                                      │
│   ┌─────────────────────────────┐    ┌────────────────────────────┐  │
│   │   GoldRush (PRIMARY)        │    │   Fallbacks                │  │
│   │  goldrush.server.ts         │    │  solana.server.ts (RPC)    │  │
│   │                             │◄──►│  geckoterminal.server.ts   │  │
│   │  • wallet balances          │    │   (OHLCV + classified      │  │
│   │  • wallet transactions      │    │    trades)                 │  │
│   │  • address activity         │    │                            │  │
│   │  • native SOL price         │    │                            │  │
│   │  • token spot price         │    │                            │  │
│   │  • token holders            │    │                            │  │
│   └──────────────┬──────────────┘    └────────────────────────────┘  │
└──────────────────┼───────────────────────────────────────────────────┘
                   │ HTTPS · Bearer GOLDRUSH_API_KEY
                   ▼
        ┌─────────────────────────────────┐
        │   GoldRush API (Covalent)       │
        │   api.covalenthq.com/v1/...     │
        └─────────────────────────────────┘
```

### Where GoldRush plugs into the request lifecycle

```text
User opens /wallet/0xabc...
        │
        ▼
fetchWalletPage (server fn)
        │
        ├── getWalletHoldings ──► goldrush.grWalletBalances ──► GoldRush /balances_v2
        ├── getWalletRecentTx ──► goldrush.grWalletTransactions ──► GoldRush /transactions_v3
        └── getWalletApprovals ──► RPC fallback
        │
        ▼
loader returns { holdings, recent, approvals, totalUsd, risk }
        │
        ▼
Wallet UI renders, useAutoRefresh re-invalidates every 20s
```

---

## Tech Stack

- **Framework:** TanStack Start v1 (React 19, file-based routing, SSR-ready)
- **Build:** Vite 7, deployed to Cloudflare Workers (edge)
- **Styling:** Tailwind CSS v4
- **Charts:** lightweight-charts (Bybit-style candles)
- **Wallet:** `@solana/wallet-adapter-react` (Phantom, Solflare)
- **Data:** GoldRush (Covalent) primary, with RPC fallback for resilience

## Getting Started

```bash
bun install
bun run dev
```

Set `GOLDRUSH_API_KEY` in your environment to enable the GoldRush data path.
Without it, the app degrades gracefully to public RPC fallbacks.

## License

MIT
