import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, X } from "lucide-react";
import type { RiskReport } from "@/server/risk";
import type { TrendingToken } from "@/server/data/types";
import { fetchTrending } from "@/server/api.functions";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const verdictTitle: Record<RiskReport["verdict"], string> = {
  safe: "Safe to swap",
  caution: "Swap with caution",
  danger: "Don't swap",
};

const verdictTone: Record<RiskReport["verdict"], string> = {
  safe: "border-safe/50 bg-safe/10 text-safe",
  caution: "border-caution/50 bg-caution/10 text-caution",
  danger: "border-danger/50 bg-danger/10 text-danger",
};

export function PreSwapModal({
  open,
  onClose,
  symbol,
  report,
  mint,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  mint: string;
  report: RiskReport;
}) {
  const navigate = useNavigate();
  const [alts, setAlts] = React.useState<TrendingToken[]>([]);
  React.useEffect(() => {
    if (!open) return;
    fetchTrending().then((r) => {
      // Show 3 high-volume alternates that aren't this token.
      setAlts(r.tokens.filter((t) => t.mint !== mint).slice(0, 3));
    }).catch(() => {});
  }, [open, mint]);

  if (!open) return null;
  const v = verdictTone[report.verdict];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl"
      >
        <div className={cn("flex items-start gap-3 border-b border-hairline p-5", v)}>
          <ShieldAlert className="mt-0.5 size-6" />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider opacity-70">Pre-swap check</div>
            <div className="mt-0.5 text-xl font-semibold">{verdictTitle[report.verdict]}</div>
            <div className="mt-0.5 text-sm opacity-90">{symbol} · {report.headline}</div>
          </div>
          <button onClick={onClose} className="rounded p-1 opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">What you'd be exposed to</div>
          <ul className="mt-2 space-y-1.5">
            {report.factors.filter((f) => f.contribution > 0).slice(0, 4).map((f) => (
              <li key={f.key} className="flex items-start gap-2 text-sm">
                <span className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  f.severity === "danger" && "bg-danger",
                  f.severity === "caution" && "bg-caution",
                  f.severity === "safe" && "bg-safe",
                )} />
                <div>
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground"> — {f.detail}</span>
                </div>
              </li>
            ))}
          </ul>

          {report.verdict !== "safe" && alts.length > 0 && (
            <div className="mt-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Safer alternatives by 24h volume</div>
              <ul className="mt-2 divide-y divide-hairline rounded-md border border-hairline">
                {alts.map((a) => (
                  <li key={a.mint}>
                    <button
                      onClick={() => { onClose(); navigate({ to: "/token/$mint", params: { mint: a.mint } }); }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <div className="size-7 overflow-hidden rounded-full bg-surface-2">
                        {a.logo ? <img src={a.logo} alt="" className="size-full object-cover" /> : null}
                      </div>
                      <span className="flex-1 text-sm font-medium">{a.symbol}</span>
                      <span className="nums text-sm">{formatUsd(a.priceUsd)}</span>
                      <span className={cn("nums w-14 text-right text-xs", (a.priceChange24h ?? 0) >= 0 ? "text-safe" : "text-danger")}>
                        {formatPct(a.priceChange24h)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-hairline px-4 py-2 text-sm hover:bg-surface-2">
              Close
            </button>
            <a
              href={`https://jup.ag/swap/SOL-${mint}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium",
                report.verdict === "danger"
                  ? "border border-danger/40 text-danger hover:bg-danger/10"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {report.verdict === "danger" ? "Continue anyway →" : "Open in Jupiter →"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
