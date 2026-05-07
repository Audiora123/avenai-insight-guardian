## Goal
Make the platform feel real and alive: Bybit-style token page, working search/wallet/swap CTAs, no flickery "Loading…" between refreshes, and deeper GoldRush integration.

## Scope of changes

### 1. GoldRush integration (foundational + activity, no streaming)
GoldRush Streaming and Pipeline APIs require WebSocket/server infra not appropriate for a TanStack Start Worker — I'll skip those and use the REST foundational endpoints instead, polled on a short interval to feel live.

New `src/server/data/goldrush.server.ts` functions:
- `grWalletBalances(address)` — already present, keep.
- `grWalletTransactions(address, pageSize)` — Activity Feed via `/v1/{chain}/address/{addr}/transactions_v3/`.
- `grAddressActivity(address)` — cross-chain activity via `/v1/address/{addr}/activity/`.
- `grHistoricalPortfolio(address)` — `/v1/{chain}/address/{addr}/portfolio_v2/` for sparkline.
- `grTokenSpotPrice(mint)` and `grHistoricalTokenPrice(mint, from, to)`.
- `grTokenHolders(mint)` — `/v1/{chain}/tokens/{mint}/token_holders_v2/` (Solana support best-effort, fall back to RPC).

`src/server/data/index.server.ts` routes wallet holdings, transactions, portfolio sparkline through GoldRush; falls back to existing RPC/DexScreener path if GoldRush returns empty.

### 2. Search + Phantom wallet
- Wire the header search input to `fetchSearch` with debounce + dropdown and a working "Open token" link.
- Auto-load wallet data when Phantom connects: route `/wallet/$address` is already there; the header connect button will navigate to it on connect.

### 3. Token page redesign (Bybit-style)
Rebuild `src/routes/token.$mint.tsx`:
- Header: token logo, name, animated price, 24h change pill (green/red, count-up animation), market cap, 24h volume, 24h high/low, liquidity — all animated.
- Main column: real candlestick chart (lightweight-charts, no dummies — uses GeckoTerminal OHLCV adapter we already have).
- Tabs: Overview / Holders / Trades / Predictions.
  - Overview: stats grid + sparkline + signal cards (whales, volume spike, sniper count, concentration) — animated numbers.
  - Holders: top-20 list, % of supply, bar, address links to Solscan.
  - Trades: live recent trades table, side-colored, maker truncated, links to Solscan tx.
  - Predictions: keep existing analog/rules predictions.
- Right rail: Pre-swap CTA + safer alternatives (compact). Removes the verbose "Pre-swap verdict for PUMP" headline and "GeckoTerminal Live…" subtitle.
- "Continue to Jupiter" CTA: `https://jup.ag/swap/SOL-{mint}` opens in new tab; from a safer-alt card, the same scheme with `SOL-{altMint}`.

### 4. Pre-swap page cleanup
- Remove the big verdict banner text and exposure-breakdown card per request.
- Each safer-alternative item gets two buttons: "Pre-swap" (in-app) and "Swap on Jupiter" (`https://jup.ag/swap/SOL-{mint}` new tab).

### 5. Stop the flicker
Replace `<div>Loading…</div>` pending components and forced loader re-renders:
- Set `staleTime` on token, wallet, and index routes to ~25s and `pendingMs: 800` so background refresh never replaces the UI.
- Use `useAutoRefresh` to call `router.invalidate()` quietly without unmounting.
- New `<AnimatedNumber>` component (CSS transition + count-up) renders the latest value smoothly when loader data updates.

### 6. New components
- `src/components/animated/AnimatedNumber.tsx` — count-up + flash on change.
- `src/components/animated/PulseDot.tsx` — green/red live pulse.
- `src/components/charts/CandleChart.tsx` — lightweight-charts wrapper, dynamic-imported client-side.
- `src/components/header/SearchBox.tsx` — debounced search dropdown.

### 7. Dependencies
- `bun add lightweight-charts` for the candlestick chart.

## Out of scope
- GoldRush Streaming / Pipeline WebSocket (incompatible runtime).
- Jupiter in-app swap execution (still routes to jup.ag — Avenai stays the analytics/risk layer).

## Files
Create: `AnimatedNumber.tsx`, `PulseDot.tsx`, `CandleChart.tsx`, `SearchBox.tsx`.
Edit: `goldrush.server.ts`, `index.server.ts`, `api.functions.ts`, `token.$mint.tsx`, `wallet.$address.tsx`, `preswap.$mint.tsx`, `Header.tsx`, `routes/index.tsx`.
