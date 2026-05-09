import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { fetchTokenPage, fetchSaferAlternatives, fetchTrending } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SwapWidget } from "@/components/swap/SwapWidget";
import type { TrendingToken } from "@/server/data/types";

export const Route = createFileRoute("/preswap/$mint")({
  loader: async ({ params }) => {
    const [page, alts, trend] = await Promise.all([
      fetchTokenPage({ data: { mint: params.mint } }),
      fetchSaferAlternatives({ data: { mint: params.mint } }),
      fetchTrending(),
    ]);
    return { page, alts, solPrice: trend.solPrice };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.page.stats ? `Pre-swap check · ${loaderData.page.stats.symbol} — Avenai` : "Pre-swap check — Avenai" },
      { name: "description", content: "Risk verdict, exposure breakdown, and safer route alternatives before you swap on Solana." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn't load this token</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm text-background">Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="mx-auto max-w-xl px-4 py-16 text-center">Token not found</div>,
  component: PreSwapPage,
});

function PreSwapPage() {
  const { mint } = Route.useParams();
  const { page, alts, solPrice } = Route.useLoaderData();
  const { stats, signals, holders } = page;
  const [size, setSize] = React.useState<number>(100);

  if (!stats) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">No market data</h1>
        <p className="mt-2 text-sm text-muted-foreground">{shortAddr(mint, 8, 8)} is not indexed on any Solana DEX.</p>
        <Link to="/" className="mt-4 inline-block text-sm underline">Back</Link>
      </main>
    );
  }

  // Estimated price impact for the chosen swap size against a constant-product approximation.
  const liq = stats.liquidityUsd ?? 0;
  const impactPct = liq > 0 ? Math.min(100, (size / liq) * 100 * 2) : 100;
  const impactTone = impactPct < 0.5 ? "text-safe" : impactPct < 2 ? "text-caution" : "text-danger";

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Discover</Link>
        <span>/</span>
        <Link to="/token/$mint" params={{ mint }} className="hover:text-foreground">{stats.symbol}</Link>
        <span>/</span>
        <span className="text-foreground">Pre-swap</span>
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">

          {/* Sizing simulator */}
          <section className="rounded-lg border border-hairline bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Swap sizing simulator</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Constant-product estimate</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="range" min={10} max={Math.max(10000, liq * 0.05)} step={10}
                value={size} onChange={(e) => setSize(Number(e.target.value))}
                className="flex-1 accent-foreground"
              />
              <input
                type="number" value={size} min={1}
                onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
                className="w-32 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-sm"
              />
              <span className="text-sm">USD</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Pool liquidity" value={`$${compact(liq)}`} />
              <Stat label="Est. price impact" value={<span className={impactTone}>{impactPct.toFixed(2)}%</span>} />
              <Stat label="Tokens received" value={stats.priceUsd ? compact(size / stats.priceUsd) + " " + stats.symbol : "—"} />
            </div>
          </section>

          {/* In-platform swap (Jupiter aggregator under the hood) */}
          <SwapWidget
            outputMint={mint}
            outputSymbol={stats.symbol}
            initialUsd={size}
            solPriceUsd={solPrice}
          />

          {/* Live trade pulse */}
          <section className="rounded-lg border border-hairline bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live trade pulse</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last {page.swaps.length} swaps</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Buys / Sells" value={`${signals.buys} / ${signals.sells}`} />
              <Stat label="Buy pressure" value={`${(signals.buySellRatio * 100).toFixed(0)}%`} />
              <Stat label="Whale wallets" value={signals.whaleCount} />
              <Stat label="Top holders share" value={`${signals.devConcentrationPct.toFixed(1)}%`} />
            </div>
            {holders.length > 0 && (
              <div className="mt-4 text-[11px] text-muted-foreground">
                Largest holder: <span className="font-mono text-foreground">{shortAddr(holders[0].address, 6, 6)}</span>
                {" "}· {holders[0].pct.toFixed(2)}% of supply
              </div>
            )}
          </section>
        </div>

        {/* Safer alternatives — the ask */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-hairline bg-surface p-5">
            <h2 className="text-sm font-semibold">Safer routes & alternatives</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Higher liquidity, healthier price stability. Ranked from your token's risk profile.
            </p>
            {alts.alts.length === 0 ? (
              <div className="mt-4 text-sm text-muted-foreground">No safer alternates surfaced right now.</div>
            ) : (
              <ul className="mt-3 divide-y divide-hairline rounded-md border border-hairline">
                {alts.alts.map((a: TrendingToken) => (
                  <li key={a.mint} className="flex items-center gap-3 p-3">
                    <div className="size-8 overflow-hidden rounded-full bg-surface-2">
                      {a.logo ? <img src={a.logo} alt="" className="size-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to="/preswap/$mint" params={{ mint: a.mint }} className="text-sm font-medium hover:underline">{a.symbol}</Link>
                      <div className="text-[11px] text-muted-foreground">
                        Liq ${compact(a.liquidityUsd ?? 0)} · Vol ${compact(a.volume24hUsd ?? 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="nums text-sm">{formatUsd(a.priceUsd)}</div>
                      <div className={cn("nums text-[11px]", (a.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>{formatPct(a.priceChange24h)}</div>
                    </div>
                    <Link
                      to="/preswap/$mint" params={{ mint: a.mint }}
                      className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:bg-foreground/90"
                      title="Pre-swap & swap on Avenai"
                    >
                      Swap
                    </Link>
                    <Link
                      to="/preswap/$mint" params={{ mint: a.mint }}
                      className="rounded-md border border-hairline p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      title="Run pre-swap"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 rounded-lg border border-hairline bg-surface p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Continue</div>
            <Link to="/token/$mint" params={{ mint }} className="block w-full rounded-md border border-hairline px-4 py-2.5 text-center text-sm hover:bg-surface-2">
              Back to token report
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="nums mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
