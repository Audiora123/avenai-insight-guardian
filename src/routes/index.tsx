import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Shield, Activity, Zap } from "lucide-react";

import { fetchTrending } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avenai — Discover Solana tokens" },
      { name: "description", content: "Trending Solana tokens with live risk scores, holder intelligence, and pre-swap warnings." },
    ],
  }),
  loader: () => fetchTrending(),
  component: Index,
});

function Index() {
  const { tokens } = Route.useLoaderData();
  const gainers = [...tokens].sort((a, b) => (b.priceChange24h ?? -999) - (a.priceChange24h ?? -999)).slice(0, 6);
  const losers = [...tokens].sort((a, b) => (a.priceChange24h ?? 999) - (b.priceChange24h ?? 999)).slice(0, 6);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8">
      {/* Hero */}
      <section className="mb-10 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            See risk before you swap.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            Avenai turns Solana on-chain data into instant verdicts — token risk, wallet hygiene,
            holder intelligence, and live whale signals — so you stop trading blind.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to="/agents" className="inline-flex items-center gap-1 rounded-md border border-hairline px-3 py-2 text-sm hover:border-foreground/40">
              Agents API <ArrowUpRight className="size-3.5" />
            </Link>
            <span className="text-xs text-muted-foreground">x402 paid endpoint · Solana devnet USDC settlement</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
          <Stat icon={Shield} label="Risk factors scored" value="11" />
          <Stat icon={Activity} label="Live signals tracked" value="24/7" />
          <Stat icon={Zap} label="Median verdict latency" value="<2s" />
        </div>
      </section>

      {/* Trending */}
      <SectionHeader title="Trending on Solana" subtitle={`${tokens.length} tokens · ranked by 24h volume`} />
      <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {tokens.slice(0, 12).map((t) => (
          <Link
            key={t.mint}
            to="/token/$mint"
            params={{ mint: t.mint }}
            className="group flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-3 transition hover:border-foreground/40"
          >
            <div className="size-10 shrink-0 overflow-hidden rounded-full bg-surface-2">
              {t.logo ? <img src={t.logo} alt="" className="size-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{t.name}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{shortAddr(t.mint)}</div>
            </div>
            <div className="text-right">
              <div className="nums text-sm">{formatUsd(t.priceUsd)}</div>
              <div className={cn("nums text-xs", (t.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                {formatPct(t.priceChange24h)}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Gainers / Losers */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Movers title="Top gainers · 24h" tokens={gainers} positive />
        <Movers title="Top losers · 24h" tokens={losers} positive={false} />
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function Movers({ title, tokens, positive }: { title: string; tokens: ReturnType<typeof Array.prototype.slice>; positive: boolean }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={cn("text-[11px]", positive ? "text-safe" : "text-danger")}>
          {positive ? "Outperformers" : "Underperformers"}
        </span>
      </div>
      <ul className="divide-y divide-hairline">
        {tokens.map((t: { mint: string; symbol: string; name: string; logo: string | null; priceUsd: number | null; priceChange24h: number | null; volume24hUsd: number | null }) => (
          <li key={t.mint}>
            <Link to="/token/$mint" params={{ mint: t.mint }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              <div className="size-7 shrink-0 overflow-hidden rounded-full bg-surface-2">
                {t.logo ? <img src={t.logo} alt="" className="size-full object-cover" /> : null}
              </div>
              <span className="flex-1 text-sm">{t.symbol}</span>
              <span className="nums text-sm">{formatUsd(t.priceUsd)}</span>
              <span className={cn("nums w-16 text-right text-sm", (t.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                {formatPct(t.priceChange24h)}
              </span>
              <span className="nums hidden w-20 text-right text-xs text-muted-foreground sm:inline">
                {compact(t.volume24hUsd ?? 0)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
