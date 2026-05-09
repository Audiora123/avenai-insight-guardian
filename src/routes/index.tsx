import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp, Wallet, ShieldCheck } from "lucide-react";

import { fetchTrending } from "@/server/api.functions";
import { compact, formatPct, formatUsd, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrendingToken } from "@/server/data/types";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avenai — Solana token & wallet intelligence" },
      { name: "description", content: "Discover trending Solana tokens, get pre-swap risk verdicts, and X-ray any wallet." },
    ],
  }),
  loader: () => fetchTrending(),
  staleTime: 20_000,
  pendingMs: 800,
  component: Index,
});

type Tab = "trending" | "gainers" | "losers" | "new";

function Index() {
  const { tokens, fresh, solPrice, goldrush } = Route.useLoaderData();
  const [tab, setTab] = React.useState<Tab>("trending");
  useAutoRefresh(20_000);

  const rows = React.useMemo(() => {
    if (tab === "gainers") return [...tokens].sort((a, b) => (b.priceChange24h ?? -999) - (a.priceChange24h ?? -999)).slice(0, 30);
    if (tab === "losers") return [...tokens].sort((a, b) => (a.priceChange24h ?? 999) - (b.priceChange24h ?? 999)).slice(0, 30);
    if (tab === "new") return fresh;
    return tokens.slice(0, 30);
  }, [tab, tokens, fresh]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Hero strip */}
      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2 rounded-lg border border-hairline bg-surface p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Solana intelligence</span>
            {goldrush && (
              <span className="inline-flex items-center gap-1 rounded border border-hairline px-1.5 py-0.5 text-[10px] normal-case text-foreground">
                <span className="size-1.5 rounded-full bg-safe animate-pulse" /> Live
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">
            See risk before you swap.
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Trending tokens, fresh launches, holder concentration and wallet hygiene — all from real on-chain data.
          </p>
          {solPrice != null && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">SOL</span>
              <span className="nums font-semibold">${solPrice.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground">spot price</span>
            </div>
          )}
        </div>
        <Tile icon={ShieldCheck} title="Pre-swap check" desc="Open any token to get a verdict." />
        <Tile icon={Wallet} title="Wallet X-ray" desc="Paste a Solana address." />
      </section>

      {/* Token table */}
      <section className="rounded-lg border border-hairline bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "trending"} onClick={() => setTab("trending")} icon={TrendingUp} label="Trending" />
            <TabBtn active={tab === "gainers"} onClick={() => setTab("gainers")} label="Top gainers" />
            <TabBtn active={tab === "losers"} onClick={() => setTab("losers")} label="Top losers" />
            <TabBtn active={tab === "new"} onClick={() => setTab("new")} icon={Sparkles} label="New on Solana" />
          </div>
          <div className="text-[11px] text-muted-foreground">
            {rows.length} tokens · refreshes every 20s
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">#</th>
                <th className="px-4 py-2.5 text-left">Token</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="px-4 py-2.5 text-right">24h</th>
                <th className="hidden px-4 py-2.5 text-right md:table-cell">Volume 24h</th>
                <th className="hidden px-4 py-2.5 text-right md:table-cell">Liquidity</th>
                <th className="hidden px-4 py-2.5 text-right lg:table-cell">Mkt cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((t: TrendingToken, i: number) => (
                <tr key={t.mint} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5 text-muted-foreground tabular">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Link to="/token/$mint" params={{ mint: t.mint }} className="flex items-center gap-2.5">
                      <div className="size-7 shrink-0 overflow-hidden rounded-full bg-surface-2">
                        {t.logo ? <img src={t.logo} alt="" className="size-full object-cover" loading="lazy" /> : null}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.symbol}</span>
                          <span className="truncate text-xs text-muted-foreground">{t.name}</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{shortAddr(t.mint, 4, 4)}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="nums px-4 py-2.5 text-right">{formatUsd(t.priceUsd)}</td>
                  <td className={cn("nums px-4 py-2.5 text-right", (t.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                    {formatPct(t.priceChange24h)}
                  </td>
                  <td className="nums hidden px-4 py-2.5 text-right md:table-cell">${compact(t.volume24hUsd ?? 0)}</td>
                  <td className="nums hidden px-4 py-2.5 text-right md:table-cell">${compact(t.liquidityUsd ?? 0)}</td>
                  <td className="nums hidden px-4 py-2.5 text-right lg:table-cell">${compact(t.marketCapUsd ?? 0)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading market data…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Tile({ icon: Icon, title, desc }: { icon: typeof Wallet; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <Icon className="size-5 text-muted-foreground" />
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon?: typeof Wallet; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {label}
    </button>
  );
}
