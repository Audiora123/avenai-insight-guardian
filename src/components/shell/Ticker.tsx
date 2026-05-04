import * as React from "react";
import { Link } from "@tanstack/react-router";
import { fetchTrending } from "@/server/api.functions";
import { compact, formatPct, formatUsd } from "@/lib/format";
import type { TrendingToken } from "@/server/data/types";
import { cn } from "@/lib/utils";

export function Ticker() {
  const [tokens, setTokens] = React.useState<TrendingToken[]>([]);

  React.useEffect(() => {
    let alive = true;
    function load() {
      fetchTrending().then((r) => { if (alive) setTokens(r.tokens.slice(0, 20)); }).catch(() => {});
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (tokens.length === 0) {
    return <div className="h-9 border-b border-hairline bg-surface/50" />;
  }

  // Duplicate list for seamless marquee.
  const list = [...tokens, ...tokens];

  return (
    <div className="border-b border-hairline bg-surface/50">
      <div className="no-scrollbar mx-auto flex h-9 max-w-[1400px] items-center gap-6 overflow-x-hidden px-4">
        <div className="flex animate-[marquee_60s_linear_infinite] gap-6 whitespace-nowrap">
          {list.map((t, i) => (
            <Link
              key={`${t.mint}-${i}`}
              to="/token/$mint"
              params={{ mint: t.mint }}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="font-medium text-foreground">{t.symbol}</span>
              <span className="nums">{formatUsd(t.priceUsd)}</span>
              <span className={cn("nums", (t.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                {formatPct(t.priceChange24h)}
              </span>
              <span className="nums text-muted-foreground">vol {compact(t.volume24hUsd ?? 0)}</span>
            </Link>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
