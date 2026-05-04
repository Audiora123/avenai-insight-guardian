import * as React from "react";
import type { PatternPrediction, RulePrediction } from "@/server/predict";
import { cn } from "@/lib/utils";

export function PredictionCards({ analogs, rules }: { analogs: PatternPrediction; rules: RulePrediction }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Analogs */}
      <div className="rounded-lg border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pattern-match · 7-day outlook</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Heuristic</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{analogs.basis}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Outcome label="Reached 2x" value={analogs.outcomes.twoX} tone="safe" />
          <Outcome label="Bled out" value={analogs.outcomes.bleed} tone="caution" />
          <Outcome label="Rugged" value={analogs.outcomes.rug} tone="danger" />
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Closest analogs</div>
          <ul className="space-y-1.5">
            {analogs.topAnalogs.map((a) => (
              <li key={a.symbol} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{a.symbol}</span>
                <span className="text-xs text-muted-foreground">{a.detail}</span>
                <span className="ml-auto text-xs">
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                    a.outcome === "2x" && "bg-safe/15 text-safe",
                    a.outcome === "bleed" && "bg-caution/15 text-caution",
                    a.outcome === "rug" && "bg-danger/15 text-danger",
                  )}>
                    {a.outcome === "2x" ? "2× ↑" : a.outcome === "rug" ? "rug" : "bleed"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rule-based */}
      <div className="rounded-lg border border-hairline bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rule-based opportunity</h3>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            rules.label === "Bull" && "bg-safe/15 text-safe",
            rules.label === "Neutral" && "bg-muted text-muted-foreground",
            rules.label === "Bear" && "bg-danger/15 text-danger",
          )}>
            {rules.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Composite score from explicit rules. Range −100 to +100.
        </p>

        <div className="my-4">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "absolute top-0 h-full",
                rules.score >= 0 ? "bg-safe" : "bg-danger",
              )}
              style={{
                left: rules.score >= 0 ? "50%" : `${50 + (rules.score / 2)}%`,
                width: `${Math.abs(rules.score) / 2}%`,
              }}
            />
            <div className="absolute left-1/2 top-0 h-full w-px bg-hairline" />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>−100</span>
            <span className="nums font-medium text-foreground">{rules.score > 0 ? "+" : ""}{rules.score}</span>
            <span>+100</span>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Active signals</div>
          <ul className="space-y-1.5">
            {rules.signals.map((s) => (
              <li key={s.key} className="flex items-start gap-2 text-sm">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", s.positive ? "bg-safe" : "bg-danger")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.label}</span>
                    <span className="nums text-xs text-muted-foreground">{s.positive ? "+" : "−"}{s.weight}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Outcome({ label, value, tone }: { label: string; value: number; tone: "safe" | "caution" | "danger" }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-3 text-center">
      <div className={cn(
        "nums text-2xl font-semibold",
        tone === "safe" && "text-safe",
        tone === "caution" && "text-caution",
        tone === "danger" && "text-danger",
      )}>
        {value}%
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
