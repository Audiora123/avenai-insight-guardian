import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, ArrowUpRight, ArrowDownRight, Flame, Activity, Copy as CopyIcon } from "lucide-react";

import { fetchTokenPage } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PredictionCards } from "@/components/predict/PredictionCards";
import { CandleChart } from "@/components/charts/CandleChart";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { AnimatedNumber, PulseDot } from "@/components/animated/AnimatedNumber";
import { SwapWidget } from "@/components/swap/SwapWidget";

export const Route = createFileRoute("/token/$mint")({
  loader: ({ params }) => fetchTokenPage({ data: { mint: params.mint } }),
  staleTime: 25_000,
  pendingMs: 800,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.stats ? `${loaderData.stats.symbol} · $${(loaderData.stats.priceUsd ?? 0).toPrecision(4)} — Avenai` : "Token — Avenai" },
      { name: "description", content: loaderData?.stats ? `Live risk, holders, whale signals and prediction for ${loaderData.stats.symbol} on Solana.` : "Solana token risk report." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn't load this token</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">Retry</button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Token not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm underline">Back to discover</Link>
    </div>
  ),
  component: TokenPage,
});

function TokenPage() {
  const { mint } = Route.useParams();
  const data = Route.useLoaderData();
  const { stats, holders, swaps, candles, analogs, rules, signals } = data;
  const [tab, setTab] = React.useState<"overview" | "trades" | "holders" | "predict">("overview");
  useAutoRefresh(20_000);

  if (!stats) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-12">
        <div className="rounded-lg border border-hairline bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold">No market data found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{shortAddr(mint, 8, 8)}</p>
          <p className="mt-1 text-sm text-muted-foreground">This mint isn't listed on any indexed Solana DEX.</p>
        </div>
      </main>
    );
  }

  const ch = stats.priceChange24h ?? 0;
  const high24 = candles.length ? Math.max(...candles.slice(-24).map((c: { h: number }) => c.h)) : null;
  const low24 = candles.length ? Math.min(...candles.slice(-24).map((c: { l: number }) => c.l)) : null;
  const jupUrl = `https://jup.ag/swap/SOL-${mint}`;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      {/* Bybit-style top bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-hairline bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="size-10 overflow-hidden rounded-full bg-surface-2">
            {stats.logo ? <img src={stats.logo} alt="" className="size-full object-cover" /> : null}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{stats.symbol}</h1>
              <span className="text-xs text-muted-foreground">/ USD</span>
              <span className="text-xs text-muted-foreground">· {stats.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">{shortAddr(mint, 6, 6)}</span>
              <button onClick={() => navigator.clipboard?.writeText(mint)} className="inline-flex items-center gap-0.5 rounded border border-hairline px-1 py-0.5 hover:text-foreground" title="Copy mint">
                <CopyIcon className="size-2.5" /> Copy
              </button>
              <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                Solscan <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Live ticker stats */}
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
          <Tick label="Price (USD)">
            <AnimatedNumber value={stats.priceUsd} format={(v) => "$" + (v >= 1 ? v.toFixed(4) : v.toPrecision(4))} className="text-base font-semibold" />
          </Tick>
          <Tick label="24h change">
            <span className={cn("nums text-base font-semibold inline-flex items-center gap-1", ch >= 0 ? "text-safe" : "text-danger")}>
              {ch >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {formatPct(ch)}
            </span>
          </Tick>
          <Tick label="24h high">
            <AnimatedNumber value={high24} format={(v) => "$" + (v >= 1 ? v.toFixed(4) : v.toPrecision(4))} className="text-sm" flash={false} />
          </Tick>
          <Tick label="24h low">
            <AnimatedNumber value={low24} format={(v) => "$" + (v >= 1 ? v.toFixed(4) : v.toPrecision(4))} className="text-sm" flash={false} />
          </Tick>
          <Tick label="24h volume (USD)">
            <AnimatedNumber value={stats.volume24hUsd ?? 0} format={(v) => "$" + compact(v)} className="text-sm" />
          </Tick>
          <Tick label="Liquidity">
            <AnimatedNumber value={stats.liquidityUsd ?? 0} format={(v) => "$" + compact(v)} className="text-sm" />
          </Tick>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/preswap/$mint" params={{ mint }}
            className="rounded-md border border-hairline px-3 py-2 text-sm hover:bg-surface-2"
          >
            Pre-swap check
          </Link>
          <a
            href={jupUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Activity className="size-4" /> Trade on Jupiter
          </a>
        </div>
      </div>

      {/* Two-column work area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Candle chart */}
          <section className="rounded-lg border border-hairline bg-surface p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs">
                <PulseDot tone={ch >= 0 ? "safe" : "danger"} />
                <span className="font-medium">{stats.symbol}/USD · 1H</span>
                <span className="text-muted-foreground">{candles.length} candles · 7d</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Real-time · GeckoTerminal</div>
            </div>
            {candles.length > 0 ? (
              <CandleChart candles={candles} height={420} />
            ) : (
              <div className="grid h-[420px] place-items-center text-sm text-muted-foreground">Waiting for candle data…</div>
            )}
          </section>

          {/* Live signal cards */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SignalCard
              title="Buy pressure"
              value={`${(signals.buySellRatio * 100).toFixed(0)}%`}
              sub={`${signals.buys} buys · ${signals.sells} sells`}
              tone={signals.buySellRatio >= 0.55 ? "safe" : signals.buySellRatio <= 0.45 ? "danger" : "neutral"}
            />
            <SignalCard
              title="Whale wallets"
              value={signals.whaleCount.toString()}
              sub={`+$${compact(signals.whaleBuysUsd)} bought · −$${compact(signals.whaleSellsUsd)} sold`}
              tone={signals.whaleBuysUsd > signals.whaleSellsUsd ? "safe" : signals.whaleSellsUsd > signals.whaleBuysUsd * 1.5 ? "danger" : "neutral"}
            />
            <SignalCard
              title="Volume spike"
              value={signals.volumeSpike > 0 ? `${signals.volumeSpike.toFixed(2)}×` : "—"}
              sub={signals.volumeSpike >= 1.5 ? "Above 24h baseline" : "At baseline"}
              tone={signals.volumeSpike >= 2 ? "safe" : "neutral"}
              icon={Flame}
            />
            <SignalCard
              title="Top-2 holders"
              value={`${signals.devConcentrationPct.toFixed(1)}%`}
              sub={`${signals.sniperCount} snipers in 1st hour`}
              tone={signals.devConcentrationPct > 50 ? "danger" : signals.devConcentrationPct > 30 ? "neutral" : "safe"}
            />
          </section>

          {/* Tabs */}
          <div>
            <div className="border-b border-hairline">
              <nav className="flex gap-1">
                {(["overview", "trades", "holders", "predict"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "border-b-2 px-3 py-2 text-sm transition",
                      tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "overview" ? "Overview" : t === "trades" ? `Trades (${swaps.length})` : t === "holders" ? `Holders (${holders.length})` : "Prediction"}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-4">
              {tab === "overview" && <Overview signals={signals} stats={stats} swaps={swaps} />}
              {tab === "trades" && <TradesTable rows={swaps} symbol={stats.symbol} />}
              {tab === "holders" && <HoldersTable rows={holders} />}
              {tab === "predict" && <PredictionCards analogs={analogs} rules={rules} />}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-3">
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Swap action</div>
            <div className="mt-2 flex flex-col gap-2">
              <a href={jupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90">
                <Activity className="size-4" /> Open Jupiter swap <ExternalLink className="size-3.5 opacity-70" />
              </a>
              <Link to="/preswap/$mint" params={{ mint }} className="rounded-md border border-hairline px-3 py-2 text-center text-sm hover:bg-surface-2">
                Pre-swap safer routes
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Token info</div>
            <dl className="mt-2 space-y-2 text-sm">
              <Row k="Market cap" v={"$" + compact(stats.marketCapUsd ?? stats.fdvUsd ?? 0)} />
              <Row k="FDV" v={"$" + compact(stats.fdvUsd ?? 0)} />
              <Row k="Pair age" v={stats.ageHours ? (stats.ageHours < 24 ? Math.round(stats.ageHours) + "h" : Math.round(stats.ageHours / 24) + "d") : "—"} />
              <Row k="DEX" v={stats.dex ?? "—"} />
              <Row k="1h" v={<span className={cn((stats.priceChange1h ?? 0) >= 0 ? "text-safe" : "text-danger")}>{formatPct(stats.priceChange1h)}</span>} />
              <Row k="5m" v={<span className={cn((stats.priceChange5m ?? 0) >= 0 ? "text-safe" : "text-danger")}>{formatPct(stats.priceChange5m)}</span>} />
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Tick({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="leading-tight">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="nums font-medium">{v}</dd>
    </div>
  );
}

function Overview({ signals, stats, swaps }: { signals: { topMakers: Array<{ address: string; netUsd: number; trades: number }>; uniqueMakers: number }; stats: { symbol: string; volume24hUsd: number | null }; swaps: Array<{ ts: number; side: "buy" | "sell"; amountUsd: number; maker: string | null; txSig: string }> }) {
  const recentBig = swaps.filter((s) => s.amountUsd > 1000).slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top makers · live ranking</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{signals.uniqueMakers} unique</span>
        </div>
        {signals.topMakers.length === 0 ? (
          <Empty msg="No classified trades in current window." />
        ) : (
          <ul className="divide-y divide-hairline">
            {signals.topMakers.map((m, i) => (
              <li key={m.address} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                <a href={`https://solscan.io/account/${m.address}`} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">{shortAddr(m.address, 6, 6)}</a>
                <span className="ml-auto text-xs text-muted-foreground">{m.trades} trades</span>
                <span className={cn("nums w-24 text-right text-sm font-medium", m.netUsd >= 0 ? "text-safe" : "text-danger")}>
                  {m.netUsd >= 0 ? "+" : "−"}${compact(Math.abs(m.netUsd))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent large trades · {stats.symbol}</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">≥ $1k</span>
        </div>
        {recentBig.length === 0 ? (
          <Empty msg="No trades over $1k in the latest window." />
        ) : (
          <ul className="divide-y divide-hairline">
            {recentBig.map((s) => (
              <li key={s.txSig} className="flex items-center gap-3 py-2 text-sm">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  s.side === "buy" ? "bg-safe/15 text-safe" : "bg-danger/15 text-danger",
                )}>{s.side}</span>
                <span className="nums text-sm">${compact(s.amountUsd)}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(s.ts)} ago</span>
                {s.maker && (
                  <a href={`https://solscan.io/account/${s.maker}`} target="_blank" rel="noreferrer" className="ml-auto font-mono text-[11px] text-muted-foreground hover:text-foreground">
                    {shortAddr(s.maker, 4, 4)}
                  </a>
                )}
                <a href={`https://solscan.io/tx/${s.txSig}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SignalCard({ title, value, sub, tone, icon: Icon }: {
  title: string; value: string; sub: string;
  tone: "safe" | "danger" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        {Icon && <Icon className={cn("size-4", tone === "safe" ? "text-safe" : tone === "danger" ? "text-danger" : "text-muted-foreground")} />}
      </div>
      <div className={cn("nums mt-1 text-2xl font-semibold", tone === "safe" && "text-safe", tone === "danger" && "text-danger")}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function HoldersTable({ rows }: { rows: { rank: number; address: string; amount: number; pct: number }[] }) {
  if (rows.length === 0) return <Empty msg="No holder data available." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">#</th>
            <th className="px-4 py-2 text-left">Address</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-right">Share</th>
            <th className="px-4 py-2 text-right">Bar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((h) => (
            <tr key={h.address} className="hover:bg-surface-2">
              <td className="px-4 py-2 text-muted-foreground">{h.rank}</td>
              <td className="px-4 py-2 font-mono text-xs">
                <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noreferrer" className="hover:underline">
                  {shortAddr(h.address, 8, 8)}
                </a>
              </td>
              <td className="nums px-4 py-2 text-right">{compact(h.amount)}</td>
              <td className="nums px-4 py-2 text-right">{h.pct.toFixed(2)}%</td>
              <td className="px-4 py-2">
                <div className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full transition-all duration-700", h.pct > 25 ? "bg-danger" : h.pct > 10 ? "bg-caution" : "bg-foreground/60")} style={{ width: `${Math.min(100, h.pct)}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ rows, symbol }: { rows: { ts: number; txSig: string; side: "buy" | "sell"; amountUsd: number; amountToken: number; priceUsd: number; maker: string | null }[]; symbol: string }) {
  if (rows.length === 0) return <Empty msg="No recent on-chain trades." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">When</th>
            <th className="px-4 py-2 text-left">Side</th>
            <th className="px-4 py-2 text-right">USD</th>
            <th className="px-4 py-2 text-right">{symbol}</th>
            <th className="px-4 py-2 text-right">Price</th>
            <th className="px-4 py-2 text-left">Maker</th>
            <th className="px-4 py-2 text-left">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((s) => (
            <tr key={s.txSig} className={cn("hover:bg-surface-2", s.side === "buy" ? "flash-up" : "flash-down")}>
              <td className="px-4 py-2 text-muted-foreground">{timeAgo(s.ts)} ago</td>
              <td className="px-4 py-2">
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  s.side === "buy" ? "bg-safe/15 text-safe" : "bg-danger/15 text-danger",
                )}>{s.side}</span>
              </td>
              <td className="nums px-4 py-2 text-right">${compact(s.amountUsd)}</td>
              <td className="nums px-4 py-2 text-right">{compact(s.amountToken)}</td>
              <td className="nums px-4 py-2 text-right text-muted-foreground">{formatUsd(s.priceUsd)}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {s.maker ? (
                  <a href={`https://solscan.io/account/${s.maker}`} target="_blank" rel="noreferrer" className="hover:underline">{shortAddr(s.maker, 4, 4)}</a>
                ) : "—"}
              </td>
              <td className="px-4 py-2 font-mono text-xs">
                <a href={`https://solscan.io/tx/${s.txSig}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                  {shortAddr(s.txSig, 4, 4)} <ExternalLink className="size-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-hairline bg-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
