import type { TokenStats, HolderRow, WalletApproval, WalletHolding } from "./types";

export interface RiskFactor {
  key: string;
  label: string;
  detail: string;
  weight: number;       // 0..1
  contribution: number; // 0..weight (added to score)
  severity: "safe" | "caution" | "danger";
}

export interface RiskReport {
  score: number;          // 0 = lowest risk, 100 = highest
  verdict: "safe" | "caution" | "danger";
  headline: string;
  factors: RiskFactor[];
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function scoreToken(stats: TokenStats | null, holders: HolderRow[]): RiskReport {
  const f: RiskFactor[] = [];
  if (!stats) {
    return {
      score: 100,
      verdict: "danger",
      headline: "No market data found for this token.",
      factors: [{ key: "no_data", label: "No market data", detail: "Token has no active liquidity pools indexed.", weight: 1, contribution: 1, severity: "danger" }],
    };
  }

  // 1. Liquidity
  const liq = stats.liquidityUsd ?? 0;
  let liqContrib = 0;
  let liqSev: RiskFactor["severity"] = "safe";
  let liqDetail = `$${Math.round(liq).toLocaleString()} of liquidity across pools`;
  if (liq < 5_000) { liqContrib = 0.25; liqSev = "danger"; liqDetail += " — extremely low, easy to drain"; }
  else if (liq < 50_000) { liqContrib = 0.18; liqSev = "danger"; liqDetail += " — low, vulnerable to single-trade drain"; }
  else if (liq < 250_000) { liqContrib = 0.10; liqSev = "caution"; liqDetail += " — modest"; }
  else if (liq < 1_000_000) { liqContrib = 0.04; liqSev = "caution"; }
  else { liqContrib = 0; liqSev = "safe"; liqDetail += " — healthy"; }
  f.push({ key: "liquidity", label: "Liquidity depth", detail: liqDetail, weight: 0.25, contribution: liqContrib, severity: liqSev });

  // 2. Liquidity-to-mcap ratio
  const mcap = stats.marketCapUsd ?? stats.fdvUsd ?? 0;
  const ratio = mcap > 0 ? liq / mcap : 0;
  let ratioContrib = 0;
  let ratioSev: RiskFactor["severity"] = "safe";
  if (ratio < 0.01) { ratioContrib = 0.15; ratioSev = "danger"; }
  else if (ratio < 0.05) { ratioContrib = 0.08; ratioSev = "caution"; }
  else { ratioContrib = 0; ratioSev = "safe"; }
  f.push({
    key: "liq_mcap",
    label: "Liquidity / market cap",
    detail: `${(ratio * 100).toFixed(2)}% — ${ratio < 0.01 ? "thin float, large slippage on exit" : ratio < 0.05 ? "below typical safe range" : "healthy ratio"}`,
    weight: 0.15,
    contribution: ratioContrib,
    severity: ratioSev,
  });

  // 3. Age
  const ageH = stats.ageHours ?? 0;
  let ageContrib = 0;
  let ageSev: RiskFactor["severity"] = "safe";
  let ageDetail = `Pair created ${ageH < 24 ? Math.round(ageH) + "h" : Math.round(ageH / 24) + "d"} ago`;
  if (ageH < 6) { ageContrib = 0.15; ageSev = "danger"; ageDetail += " — fresh launch, no history"; }
  else if (ageH < 48) { ageContrib = 0.08; ageSev = "caution"; ageDetail += " — early days"; }
  else if (ageH < 168) { ageContrib = 0.03; ageSev = "caution"; }
  else { ageContrib = 0; ageSev = "safe"; ageDetail += " — established"; }
  f.push({ key: "age", label: "Pair age", detail: ageDetail, weight: 0.15, contribution: ageContrib, severity: ageSev });

  // 4. Top-10 holder concentration
  const top10 = holders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  let concContrib = 0;
  let concSev: RiskFactor["severity"] = "safe";
  if (top10 > 70) { concContrib = 0.20; concSev = "danger"; }
  else if (top10 > 50) { concContrib = 0.13; concSev = "danger"; }
  else if (top10 > 35) { concContrib = 0.07; concSev = "caution"; }
  else { concContrib = 0; concSev = "safe"; }
  f.push({
    key: "top10",
    label: "Top-10 holder share",
    detail: `Top 10 wallets hold ${top10.toFixed(1)}% of supply${top10 > 50 ? " — single-actor risk" : ""}`,
    weight: 0.20,
    contribution: concContrib,
    severity: concSev,
  });

  // 5. Single-wallet dominance
  const top1 = holders[0]?.pct ?? 0;
  let topSev: RiskFactor["severity"] = "safe";
  let topContrib = 0;
  if (top1 > 25) { topContrib = 0.15; topSev = "danger"; }
  else if (top1 > 15) { topContrib = 0.08; topSev = "caution"; }
  f.push({
    key: "top1",
    label: "Largest holder",
    detail: holders[0] ? `Top wallet holds ${top1.toFixed(2)}%` : "No holder data available",
    weight: 0.15,
    contribution: topContrib,
    severity: topSev,
  });

  // 6. Volume sanity
  const vol = stats.volume24hUsd ?? 0;
  let volContrib = 0;
  let volSev: RiskFactor["severity"] = "safe";
  if (vol < 1_000) { volContrib = 0.10; volSev = "danger"; }
  else if (vol < 10_000) { volContrib = 0.05; volSev = "caution"; }
  f.push({
    key: "volume",
    label: "24h volume",
    detail: `$${Math.round(vol).toLocaleString()} traded in last 24h`,
    weight: 0.10,
    contribution: volContrib,
    severity: volSev,
  });

  const total = f.reduce((s, x) => s + x.contribution, 0);
  const score = clamp(Math.round(total * 100), 0, 100);
  const verdict: RiskReport["verdict"] = score >= 60 ? "danger" : score >= 30 ? "caution" : "safe";
  const dangerCount = f.filter((x) => x.severity === "danger").length;
  const headline =
    verdict === "danger"
      ? `High risk — ${dangerCount} critical factor${dangerCount === 1 ? "" : "s"} flagged`
      : verdict === "caution"
        ? "Proceed with caution — non-critical risks present"
        : "No major red flags detected";

  return { score, verdict, headline, factors: f };
}

export function scoreWallet(holdings: WalletHolding[], approvals: WalletApproval[]): RiskReport {
  const f: RiskFactor[] = [];
  const totalUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);

  // 1. Dangerous approvals
  const dangerApprovals = approvals.filter((a) => a.riskLevel === "danger").length;
  const cautionApprovals = approvals.filter((a) => a.riskLevel === "caution").length;
  let appContrib = 0;
  let appSev: RiskFactor["severity"] = "safe";
  if (dangerApprovals > 0) { appContrib = 0.35; appSev = "danger"; }
  else if (cautionApprovals > 2) { appContrib = 0.15; appSev = "caution"; }
  else if (cautionApprovals > 0) { appContrib = 0.06; appSev = "caution"; }
  f.push({
    key: "approvals",
    label: "Token approvals",
    detail:
      dangerApprovals > 0
        ? `${dangerApprovals} approval${dangerApprovals === 1 ? "" : "s"} to unverified programs — revoke immediately`
        : cautionApprovals > 0
          ? `${cautionApprovals} unlimited approval${cautionApprovals === 1 ? "" : "s"} to known programs`
          : "No risky open approvals",
    weight: 0.35,
    contribution: appContrib,
    severity: appSev,
  });

  // 2. Concentration
  const top = holdings[0];
  const topShare = totalUsd > 0 && top?.valueUsd ? top.valueUsd / totalUsd : 0;
  let concContrib = 0;
  let concSev: RiskFactor["severity"] = "safe";
  if (topShare > 0.85) { concContrib = 0.20; concSev = "danger"; }
  else if (topShare > 0.65) { concContrib = 0.10; concSev = "caution"; }
  f.push({
    key: "concentration",
    label: "Portfolio concentration",
    detail: top
      ? `${(topShare * 100).toFixed(1)}% of value in ${top.symbol}`
      : "Empty wallet",
    weight: 0.20,
    contribution: concContrib,
    severity: concSev,
  });

  // 3. Stablecoin ratio
  const stables = ["USDC", "USDT", "USDH", "PYUSD"];
  const stableUsd = holdings
    .filter((h) => stables.includes(h.symbol.toUpperCase()))
    .reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const stableRatio = totalUsd > 0 ? stableUsd / totalUsd : 0;
  f.push({
    key: "stables",
    label: "Stablecoin reserve",
    detail: `${(stableRatio * 100).toFixed(1)}% of portfolio in stablecoins`,
    weight: 0.10,
    contribution: 0,
    severity: "safe",
  });

  // 4. Long-tail / dust positions
  const tinyPositions = holdings.filter((h) => (h.valueUsd ?? 0) > 0 && (h.valueUsd ?? 0) < 1).length;
  let tinyContrib = 0;
  let tinySev: RiskFactor["severity"] = "safe";
  if (tinyPositions > 30) { tinyContrib = 0.10; tinySev = "caution"; }
  else if (tinyPositions > 10) { tinyContrib = 0.04; tinySev = "caution"; }
  f.push({
    key: "dust",
    label: "Dust / spam tokens",
    detail: `${tinyPositions} positions worth less than $1 — likely airdrop spam`,
    weight: 0.10,
    contribution: tinyContrib,
    severity: tinySev,
  });

  const total = f.reduce((s, x) => s + x.contribution, 0);
  const score = clamp(Math.round(total * 100), 0, 100);
  const verdict: RiskReport["verdict"] = score >= 50 ? "danger" : score >= 25 ? "caution" : "safe";
  const headline =
    verdict === "danger"
      ? "Wallet has critical hygiene issues — action recommended"
      : verdict === "caution"
        ? "Wallet hygiene is acceptable — small improvements possible"
        : "Wallet hygiene looks clean";

  return { score, verdict, headline, factors: f };
}
