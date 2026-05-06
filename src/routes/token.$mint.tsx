import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion, ArrowUpRight, ArrowDownRight, Flame } from "lucide-react";

import { fetchTokenPage } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PredictionCards } from "@/components/predict/PredictionCards";
import { Sparkline } from "@/components/charts/Sparkline";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export const Route = createFileRoute("/token/$mint")({
  loader: ({ params }) => fetchTokenPage({ data: { mint: params.mint } }),
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
  const { stats, holders, swaps, candles, risk, analogs, rules, signals } = data;
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
  const VIcon = risk.verdict === "safe" ? ShieldCheck : risk.verdict === "danger" ? ShieldAlert : ShieldQuestion;
  const vTone =
    risk.verdict === "safe" ? "border-safe/40 bg-safe/10 text-safe" :
    risk.verdict === "danger" ? "border-danger/40 bg-danger/10 text-danger" :
    "border-caution/40 bg-caution/10 text-caution";
  const vLabel =
    risk.verdict === "safe" ? "Safe to swap" :
    risk.verdict === "danger" ? "Don't swap" : "Swap with caution";

  const sparkPoints = candles.map((c) => c.c);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="size-12 overflow-hidden rounded-full bg-surface-2">
            {stats.logo ? <img src={stats.logo} alt="" className="size-full object-cover" /> : null}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{stats.symbol}</h1>
              <span className="text-sm text-muted-foreground">{stats.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">{shortAddr(mint, 6, 6)}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(mint)}
                className="rounded border border-hairline px-1.5 py-0.5 hover:text-foreground"
                title="Copy mint"
              >Copy</button>
              <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                Solscan <ExternalLink className="size-3" />
              </a>
              <a href={`https://dexscreener.com/solana/${stats.pairAddress ?? mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                DexScreener <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-5">
          <Stat label="Price" value={formatUsd(stats.priceUsd)} sub={<span className={cn(ch >= 0 ? "text-safe" : "text-danger")}>{formatPct(ch)} 24h</span>} />
          <Stat label="Liquidity" value={"$" + compact(stats.liquidityUsd ?? 0)} />
          <Stat label="Mkt cap" value={"$" + compact(stats.marketCapUsd ?? stats.fdvUsd ?? 0)} />
          <Stat label="24h vol" value={"$" + compact(stats.volume24hUsd ?? 0)} />
          <Stat label="Pair age" value={stats.ageHours ? (stats.ageHours < 24 ? Math.round(stats.ageHours) + "h" : Math.round(stats.ageHours / 24) + "d") : "—"} sub={stats.dex ?? ""} />
        </div>

        <Link
          to="/preswap/$mint" params={{ mint }}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          Pre-swap check →
        </Link>
      </div>

      {/* Verdict + sparkline ribbon */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px]">
        <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", vTone)}>
          <VIcon className="size-5" />
          <div className="flex-1">
            <div className="text-sm font-semibold">{vLabel} · risk {risk.score}/100</div>
            <div className="text-xs opacity-90">{risk.headline}</div>
          </div>
          <Link to="/preswap/$mint" params={{ mint }} className="rounded-md border border-current/30 px-3 py-1 text-xs font-medium hover:bg-background/10">
            See safer routes
          </Link>
        </div>
        <div className="rounded-lg border border-hairline bg-surface p-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>7d price (1h candles)</span>
            <span className="nums">{candles.length} candles</span>
          </div>
          <Sparkline points={sparkPoints} positive={ch >= 0} />
        </div>
      </div>

      {/* Live signal cards */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SignalCard
          title="Buy pressure"
          value={`${(signals.buySellRatio * 100).toFixed(0)}%`}
          sub={`${signals.buys} buys · ${signals.sells} sells`}
          tone={signals.buySellRatio >= 0.55 ? "safe" : signals.buySellRatio <= 0.45 ? "danger" : "neutral"}
          icon={signals.buySellRatio >= 0.5 ? ArrowUpRight : ArrowDownRight}
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
          tone={signals.volumeSpike >= 2 ? "safe" : signals.volumeSpike >= 1.2 ? "neutral" : "neutral"}
          icon={Flame}
        />
        <SignalCard
          title="Top holders"
          value={`${signals.devConcentrationPct.toFixed(1)}%`}
          sub={`Top-2 wallets · ${signals.sniperCount} snipers in 1st hour`}
          tone={signals.devConcentrationPct > 50 ? "danger" : signals.devConcentrationPct > 30 ? "neutral" : "safe"}
        />
      </section>

      {/* Tabs */}
      <div className="mt-6">
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
    </main>
  );
}

function Overview({ signals, stats, swaps }: { signals: { topMakers: Array<{ address: string; netUsd: number; trades: number }>; uniqueMakers: number }; stats: { symbol: string; volume24hUsd: number | null }; swaps: Array<{ ts: number; side: "buy" | "sell"; amountUsd: number; maker: string | null; txSig: string }> }) {
  const recentBig = swaps.filter((s) => s.amountUsd > 1000).slice(0, 8);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-hairline bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top makers (24h sample)</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{signals.uniqueMakers} unique</span>
        </div>
        {signals.topMakers.length === 0 ? (
          <Empty msg="No classified trades in current window." />
        ) : (
          <ul className="divide-y divide-hairline">
            {signals.topMakers.map((m) => (
              <li key={m.address} className="flex items-center gap-3 py-2 text-sm">
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

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="nums text-sm font-semibold">{value}</div>
      {sub ? <div className="nums text-[11px] text-muted-foreground">{sub}</div> : null}
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
            <th className="px-4 py-2 text-left">Account (token account)</th>
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
                  <div className={cn("h-full", h.pct > 25 ? "bg-danger" : h.pct > 10 ? "bg-caution" : "bg-foreground/60")} style={{ width: `${Math.min(100, h.pct)}%` }} />
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
            <tr key={s.txSig} className="hover:bg-surface-2">
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
                <a href={`https://solscan.io/tx/${s.txSig}`} target="_blank" rel="noreferrer" className="hover:underline">{shortAddr(s.txSig, 4, 4)}</a>
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
