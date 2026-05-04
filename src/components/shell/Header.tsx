import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Search, Activity } from "lucide-react";

import { fetchSearch } from "@/server/api.functions";
import { isSolanaAddress, shortAddr, formatUsd, formatPct } from "@/lib/format";
import type { TrendingToken } from "@/server/data/types";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<TrendingToken[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounced = useDebounced(q, 220);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  React.useEffect(() => {
    if (!debounced.trim()) { setResults([]); return; }
    if (isSolanaAddress(debounced)) { setResults([]); return; }
    let alive = true;
    setLoading(true);
    fetchSearch({ data: { q: debounced } })
      .then((r) => { if (alive) setResults(r.results); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [debounced]);

  function submit(addr: string) {
    const a = addr.trim();
    if (!a) return;
    setOpen(false);
    setQ("");
    // Heuristic: holders array near 32 chars likely a wallet, but we can't tell wallet-vs-mint just by length.
    // Strategy: if it parses as an address, take user to /token/$mint by default; wallet pages are reachable from header dropdown / landing.
    // Better UX: let user pick from suggestions. If raw paste, go to token page first (most-used flow).
    navigate({ to: "/token/$mint", params: { mint: a } });
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (isSolanaAddress(q)) submit(q);
      else if (results[0]) navigate({ to: "/token/$mint", params: { mint: results[0].mint } });
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 focus-within:border-foreground/40">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Search token, paste mint or wallet address…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          spellCheck={false}
        />
        <kbd className="hidden rounded border border-hairline px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">⏎</kbd>
      </div>
      {open && (q.trim() || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-hairline bg-popover shadow-2xl">
          {isSolanaAddress(q) ? (
            <div className="flex flex-col">
              <button
                onClick={() => submit(q)}
                className="flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface-2"
              >
                <span>Open token page <span className="text-muted-foreground">{shortAddr(q, 6, 6)}</span></span>
                <span className="text-xs text-muted-foreground">↵</span>
              </button>
              <button
                onClick={() => { setOpen(false); navigate({ to: "/wallet/$address", params: { address: q.trim() } }); }}
                className="flex items-center justify-between border-t border-hairline px-4 py-3 text-left text-sm hover:bg-surface-2"
              >
                <span>Open wallet X-ray <span className="text-muted-foreground">{shortAddr(q, 6, 6)}</span></span>
              </button>
            </div>
          ) : loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Searching Solana…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No matches</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {results.map((t) => (
                <button
                  key={t.mint}
                  onClick={() => { setOpen(false); setQ(""); navigate({ to: "/token/$mint", params: { mint: t.mint } }); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2"
                >
                  <div className="size-8 shrink-0 overflow-hidden rounded-full bg-surface-2">
                    {t.logo ? <img src={t.logo} alt="" className="size-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{t.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{shortAddr(t.mint, 4, 4)}</div>
                  </div>
                  <div className="text-right">
                    <div className="nums text-sm">{formatUsd(t.priceUsd)}</div>
                    <div className={cn("nums text-[11px]", (t.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                      {formatPct(t.priceChange24h)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedShortcut() {
  const { publicKey, connected } = useWallet();
  if (!connected || !publicKey) return null;
  return (
    <Link
      to="/wallet/$address"
      params={{ address: publicKey.toBase58() }}
      className="hidden rounded-md border border-hairline px-3 py-1.5 text-xs hover:border-foreground/40 md:inline-flex"
    >
      My wallet · {shortAddr(publicKey.toBase58())}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-foreground text-background">
            <Activity className="size-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">Avenai</span>
          <span className="hidden rounded border border-hairline px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground md:inline-block">
            Solana
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground" activeProps={{ className: "text-foreground bg-surface" }} activeOptions={{ exact: true }}>
            Discover
          </Link>
          <Link to="/agents" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground" activeProps={{ className: "text-foreground bg-surface" }}>
            Agents API
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-center px-2">
          <GlobalSearch />
        </div>

        <ConnectedShortcut />
        <WalletMultiButton style={{
          background: "var(--color-foreground)",
          color: "var(--color-background)",
          height: 36,
          padding: "0 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1,
        }} />
      </div>
    </header>
  );
}
