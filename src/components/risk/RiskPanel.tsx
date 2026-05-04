import * as React from "react";
import type { RiskReport, RiskFactor } from "@/server/risk";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const verdictStyle: Record<RiskReport["verdict"], { ring: string; text: string; bg: string; label: string }> = {
  safe: { ring: "border-safe/40", text: "text-safe", bg: "bg-safe/10", label: "Looks safe" },
  caution: { ring: "border-caution/40", text: "text-caution", bg: "bg-caution/10", label: "Caution" },
  danger: { ring: "border-danger/40", text: "text-danger", bg: "bg-danger/10", label: "High risk" },
};

const sevDot: Record<RiskFactor["severity"], string> = {
  safe: "bg-safe",
  caution: "bg-caution",
  danger: "bg-danger",
};

export function RiskPanel({ title, report }: { title: string; report: RiskReport }) {
  const v = verdictStyle[report.verdict];
  const [open, setOpen] = React.useState(true);

  return (
    <div className={cn("rounded-lg border bg-surface", v.ring)}>
      <div className={cn("flex items-start gap-4 p-4", v.bg)}>
        <RiskDial score={report.score} verdict={report.verdict} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", v.text)}>
              {v.label}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-medium">{report.headline}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Score reflects {report.factors.length} weighted on-chain factors. Lower is safer.
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-t border-hairline px-4 py-2.5 text-left text-xs text-muted-foreground hover:bg-surface-2"
      >
        <span>{open ? "Hide" : "Show"} factor breakdown</span>
        <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="divide-y divide-hairline">
          {report.factors.map((f) => (
            <li key={f.key} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", sevDot[f.severity])} />
                <span className="flex-1 text-sm font-medium">{f.label}</span>
                <span className="nums text-xs text-muted-foreground">
                  +{Math.round(f.contribution * 100)} / {Math.round(f.weight * 100)}
                </span>
              </div>
              <p className="mt-1 pl-4 text-xs text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskDial({ score, verdict }: { score: number; verdict: RiskReport["verdict"] }) {
  const v = verdictStyle[verdict];
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="currentColor" strokeWidth="6" className="text-hairline" fill="none" />
        <circle
          cx="32" cy="32" r={r}
          stroke="currentColor" strokeWidth="6" fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          className={v.text}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("nums text-base font-semibold", v.text)}>{score}</span>
      </div>
    </div>
  );
}
