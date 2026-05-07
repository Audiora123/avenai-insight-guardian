import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { fetchWalletPage } from "@/server/api.functions";
import { compact, formatUsd, shortAddr, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RiskPanel } from "@/components/risk/RiskPanel";
import { ShieldAlert } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export const Route = createFileRoute("/wallet/$address")({
  loader: ({ params }) => fetchWalletPage({ data: { address: params.address } }),
  staleTime: 25_000,
  pendingMs: 800,
  head: ({ params }) => ({
    meta: [
      { title: `Wallet ${params.address.slice(0, 6)}… — Avenai X-ray` },
      { name: "description", content: "Holdings, approvals, and risk score for any Solana wallet." },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn't load this wallet</h1>
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
      <h1 className="text-xl font-semibold">Wallet not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm underline">Back to discover</Link>
    </div>
  ),
  component: WalletPage,
});

function WalletPage() {
  const { address } = Route.useParams();
  const { holdings, approvals, recent, totalUsd, risk } = Route.useLoaderData();
  const [tab, setTab] = React.useState<"holdings" | "approvals" | "activity">("holdings");
  useAutoRefresh(30_000);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="rounded-lg border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Wallet X-ray</div>
            <div className="font-mono text-sm">{shortAddr(address, 8, 8)}</div>
            <div className="mt-2 nums text-3xl font-semibold">{formatUsd(totalUsd)}</div>
            <div className="text-xs text-muted-foreground">
              {holdings.length} positions · {approvals.length} open approval{approvals.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <a href={`https://solscan.io/account/${address}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
              View on Solscan →
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="border-b border-hairline">
            <nav className="flex gap-1">
              {(["holdings", "approvals", "activity"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm transition",
                    tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  {t === "approvals" && approvals.some((a: { riskLevel: string }) => a.riskLevel === "danger") && (
                    <ShieldAlert className="ml-1.5 inline-block size-3.5 text-danger" />
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-4">
            {tab === "holdings" && <Holdings rows={holdings} />}
            {tab === "approvals" && <Approvals rows={approvals} />}
            {tab === "activity" && <Activity rows={recent} />}
          </div>
        </div>
        <aside>
          <RiskPanel title="Wallet risk" report={risk} />
        </aside>
      </div>
    </main>
  );
}

function Holdings({ rows }: { rows: { mint: string; symbol: string; name: string; logo: string | null; amount: number; valueUsd: number | null; priceUsd: number | null }[] }) {
  if (rows.length === 0) return <Empty msg="This wallet has no SPL token balances." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Token</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-right">Price</th>
            <th className="px-4 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.slice(0, 50).map((h) => (
            <tr key={h.mint} className="hover:bg-surface-2">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 overflow-hidden rounded-full bg-surface-2">
                    {h.logo ? <img src={h.logo} alt="" className="size-full object-cover" /> : null}
                  </div>
                  <div>
                    <Link to="/token/$mint" params={{ mint: h.mint }} className="font-medium hover:underline">{h.symbol}</Link>
                    <div className="text-[11px] text-muted-foreground">{h.name}</div>
                  </div>
                </div>
              </td>
              <td className="nums px-4 py-2.5 text-right">{compact(h.amount)}</td>
              <td className="nums px-4 py-2.5 text-right text-muted-foreground">{formatUsd(h.priceUsd)}</td>
              <td className="nums px-4 py-2.5 text-right font-medium">{formatUsd(h.valueUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Approvals({ rows }: { rows: { programId: string; programLabel: string | null; mint: string; symbol: string | null; isUnlimited: boolean; riskLevel: "safe" | "caution" | "danger"; reason: string }[] }) {
  if (rows.length === 0) return <Empty msg="No open token approvals — clean wallet." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Token</th>
            <th className="px-4 py-2 text-left">Delegated to</th>
            <th className="px-4 py-2 text-left">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((a) => (
            <tr key={`${a.mint}:${a.programId}`} className="hover:bg-surface-2">
              <td className="px-4 py-2.5">{a.symbol ?? shortAddr(a.mint)}</td>
              <td className="px-4 py-2.5">
                <div>{a.programLabel ?? <span className="text-danger">Unverified program</span>}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{shortAddr(a.programId, 6, 6)}</div>
              </td>
              <td className="px-4 py-2.5">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  a.riskLevel === "safe" && "bg-safe/15 text-safe",
                  a.riskLevel === "caution" && "bg-caution/15 text-caution",
                  a.riskLevel === "danger" && "bg-danger/15 text-danger",
                )}>
                  {a.riskLevel}
                </span>
                <div className="mt-1 text-[11px] text-muted-foreground">{a.reason}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Activity({ rows }: { rows: { ts: number; signature: string; summary: string }[] }) {
  if (rows.length === 0) return <Empty msg="No recent on-chain activity." />;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <ul className="divide-y divide-hairline">
        {rows.map((tx) => (
          <li key={tx.signature} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
            <span className="w-16 text-[11px] text-muted-foreground">{timeAgo(tx.ts)} ago</span>
            <span className="flex-1 truncate">{tx.summary}</span>
            <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground hover:text-foreground">
              {shortAddr(tx.signature, 6, 6)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-hairline bg-surface p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
