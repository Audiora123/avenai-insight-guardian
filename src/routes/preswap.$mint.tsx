import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, ShieldQuestion, ArrowRight, ExternalLink, Activity } from "lucide-react";
import { fetchTokenPage, fetchSaferAlternatives } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preswap/$mint")({
  loader: async ({ params }) => {
    const [page, alts] = await Promise.all([
      fetchTokenPage({ data: { mint: params.mint } }),
      fetchSaferAlternatives({ data: { mint: params.mint } }),
    ]);
    return { page, alts };
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
  const { page, alts } = Route.useLoaderData();
  const { stats, risk, signals, holders } = page;
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

  const VIcon = risk.verdict === "safe" ? ShieldCheck : risk.verdict === "danger" ? ShieldAlert : ShieldQuestion;
  const vTone =
    risk.verdict === "safe" ? "border-safe/40 bg-safe/10 text-safe" :
    risk.verdict === "danger" ? "border-danger/40 bg-danger/10 text-danger" :
    "border-caution/40 bg-caution/10 text-caution";
  const vLabel =
    risk.verdict === "safe" ? "Safe to swap" :
    risk.verdict === "danger" ? "Don't swap" : "Swap with caution";

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

      <div className={cn("flex items-center gap-3 rounded-lg border px-5 py-4", vTone)}>
        <VIcon className="size-6" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider opacity-70">Pre-swap verdict for {stats.symbol}</div>
          <div className="text-xl font-semibold">{vLabel} · risk {risk.score}/100</div>
          <div className="text-xs opacity-90">{risk.headline}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Exposure */}
          <section className="rounded-lg border border-hairline bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Exposure breakdown</h2>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live · Solana RPC + GeckoTerminal</span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {risk.factors.filter((f) => f.contribution > 0 || f.severity !== "safe").map((f) => (
                <li key={f.key} className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3 text-sm">
                  <span className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    f.severity === "danger" && "bg-danger",
                    f.severity === "caution" && "bg-caution",
                    f.severity === "safe" && "bg-safe",
                  )} />
                  <div>
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

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
                {alts.alts.map((a) => (
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
                      className="rounded-md border border-hairline p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      title="Run pre-swap on this token"
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
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Continue trading</div>
            <a
              href={`https://jup.ag/swap/SOL-${mint}`} target="_blank" rel="noreferrer"
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium",
                risk.verdict === "danger" ? "border border-danger/50 text-danger hover:bg-danger/10" :
                "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              <Activity className="size-4" />
              {risk.verdict === "danger" ? "Continue anyway on Jupiter" : "Open in Jupiter"}
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
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
