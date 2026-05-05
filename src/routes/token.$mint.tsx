import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

import { fetchTokenPage } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PredictionCards } from "@/components/predict/PredictionCards";
import { PreSwapModal } from "@/components/risk/PreSwapModal";
import type { RiskReport } from "@/server/risk";


export const Route = createFileRoute("/token/$mint")({
  loader: ({ params }) => fetchTokenPage({ data: { mint: params.mint } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.stats ? `${loaderData.stats.symbol} — Avenai risk report` : "Token — Avenai" },
      { name: "description", content: loaderData?.stats ? `Risk score, holders, and live signals for ${loaderData.stats.symbol} on Solana.` : "Solana token risk report." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn't load this token</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Retry
        </button>
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
  const { stats, holders, swaps, risk, analogs, rules } = Route.useLoaderData();
  const [tab, setTab] = React.useState<"overview" | "holders" | "trades">("overview");
  const [preSwapOpen, setPreSwapOpen] = React.useState(false);

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
              <span>{shortAddr(mint, 6, 6)}</span>
              <a
                href={`https://solscan.io/token/${mint}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-0.5 hover:text-foreground"
              >
                Solscan <ExternalLink className="size-3" />
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

        <button
          onClick={() => setPreSwapOpen(true)}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          Pre-swap check
        </button>
      </div>

      {/* Verdict ribbon */}
      <div className={cn("mt-4 flex items-center gap-3 rounded-lg border px-4 py-3", vTone)}>
        <VIcon className="size-5" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{vLabel}</div>
          <div className="text-xs opacity-90">{risk.headline}</div>
        </div>
      </div>

      <div className="mt-6">
        <div className="border-b border-hairline">
          <nav className="flex gap-1">
            {(["overview", "holders", "trades"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm transition",
                  tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-4">
          {tab === "overview" && <PredictionCards analogs={analogs} rules={rules} />}
          {tab === "holders" && <HoldersTable rows={holders} />}
          {tab === "trades" && <TradesTable rows={swaps} />}
        </div>
      </div>

      <PreSwapModal
        open={preSwapOpen}
        onClose={() => setPreSwapOpen(false)}
        symbol={stats.symbol}
        mint={mint}
        report={risk}
      />
    </main>
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
            <th className="px-4 py-2 text-left">Address</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((h) => (
            <tr key={h.address} className="hover:bg-surface-2">
              <td className="px-4 py-2 text-muted-foreground">{h.rank}</td>
              <td className="px-4 py-2 font-mono text-xs">
                <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noreferrer" className="hover:underline">
                  {shortAddr(h.address, 6, 6)}
                </a>
              </td>
              <td className="nums px-4 py-2 text-right">{compact(h.amount)}</td>
              <td className="nums px-4 py-2 text-right">{h.pct.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ rows }: { rows: { ts: number; txSig: string; side: "buy" | "sell" }[] }) {
  if (rows.length === 0) return <Empty msg="No recent on-chain activity." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">When</th>
            <th className="px-4 py-2 text-left">Signature</th>
            <th className="px-4 py-2 text-right">Side</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((s) => (
            <tr key={s.txSig} className="hover:bg-surface-2">
              <td className="px-4 py-2 text-muted-foreground">{timeAgo(s.ts)} ago</td>
              <td className="px-4 py-2 font-mono text-xs">
                <a href={`https://solscan.io/tx/${s.txSig}`} target="_blank" rel="noreferrer" className="hover:underline">
                  {shortAddr(s.txSig, 6, 6)}
                </a>
              </td>
              <td className={cn("px-4 py-2 text-right text-xs uppercase tracking-wider", s.side === "buy" ? "text-safe" : "text-danger")}>
                on-chain
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-hairline px-4 py-2 text-[11px] text-muted-foreground">
        Trade direction & USD amounts will be enriched once GoldRush classified-tx is wired.
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-hairline bg-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
