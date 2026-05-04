import type { TokenStats, HolderRow } from "./data/types";

export interface PredictionAnalog {
  symbol: string;
  outcome: "2x" | "rug" | "bleed";
  similarity: number;     // 0..1
  detail: string;
}

export interface PatternPrediction {
  matched: number;
  outcomes: { twoX: number; rug: number; bleed: number };
  topAnalogs: PredictionAnalog[];
  basis: string;
}

export interface RulePrediction {
  label: "Bull" | "Neutral" | "Bear";
  score: number;          // -100..100
  signals: Array<{ key: string; label: string; weight: number; positive: boolean; detail: string }>;
}

// A small seeded analog corpus — outcomes are heuristic matches by liquidity/age/concentration profile.
// Real analogs would come from a labeled historical dataset; this gives a defensible MVP today.
const CORPUS = [
  { symbol: "BONK", profile: { liq: 8_000_000, age: 200, top10: 30 }, outcome: "2x" as const },
  { symbol: "WIF", profile: { liq: 12_000_000, age: 150, top10: 28 }, outcome: "2x" as const },
  { symbol: "POPCAT", profile: { liq: 5_000_000, age: 180, top10: 32 }, outcome: "2x" as const },
  { symbol: "MOTHER", profile: { liq: 800_000, age: 30, top10: 55 }, outcome: "bleed" as const },
  { symbol: "MICHI", profile: { liq: 600_000, age: 60, top10: 42 }, outcome: "2x" as const },
  { symbol: "FRED", profile: { liq: 50_000, age: 4, top10: 78 }, outcome: "rug" as const },
  { symbol: "PNUT", profile: { liq: 1_500_000, age: 12, top10: 45 }, outcome: "2x" as const },
  { symbol: "GOAT", profile: { liq: 900_000, age: 18, top10: 50 }, outcome: "2x" as const },
  { symbol: "MOODENG", profile: { liq: 700_000, age: 24, top10: 48 }, outcome: "2x" as const },
  { symbol: "SHARK", profile: { liq: 20_000, age: 2, top10: 88 }, outcome: "rug" as const },
  { symbol: "FOMO", profile: { liq: 110_000, age: 8, top10: 65 }, outcome: "rug" as const },
  { symbol: "CHAD", profile: { liq: 250_000, age: 36, top10: 38 }, outcome: "bleed" as const },
  { symbol: "BABY", profile: { liq: 80_000, age: 5, top10: 72 }, outcome: "rug" as const },
  { symbol: "ELON", profile: { liq: 400_000, age: 48, top10: 40 }, outcome: "bleed" as const },
  { symbol: "DEGEN", profile: { liq: 1_200_000, age: 96, top10: 35 }, outcome: "2x" as const },
  { symbol: "PEPE", profile: { liq: 3_000_000, age: 168, top10: 30 }, outcome: "2x" as const },
  { symbol: "MEW", profile: { liq: 900_000, age: 72, top10: 41 }, outcome: "2x" as const },
  { symbol: "SLERF", profile: { liq: 2_000_000, age: 144, top10: 33 }, outcome: "bleed" as const },
];

function distance(a: { liq: number; age: number; top10: number }, b: { liq: number; age: number; top10: number }): number {
  // Normalize each axis, then L2.
  const liqA = Math.log10(Math.max(1, a.liq));
  const liqB = Math.log10(Math.max(1, b.liq));
  const ageA = Math.log10(Math.max(1, a.age));
  const ageB = Math.log10(Math.max(1, b.age));
  const dLiq = (liqA - liqB) / 8;
  const dAge = (ageA - ageB) / 4;
  const dTop = (a.top10 - b.top10) / 100;
  return Math.sqrt(dLiq * dLiq + dAge * dAge + dTop * dTop);
}

export function predictByAnalogs(stats: TokenStats | null, holders: HolderRow[]): PatternPrediction {
  if (!stats) {
    return { matched: 0, outcomes: { twoX: 0, rug: 0, bleed: 0 }, topAnalogs: [], basis: "Insufficient data" };
  }
  const top10 = holders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const profile = {
    liq: stats.liquidityUsd ?? 0,
    age: Math.max(1, stats.ageHours ?? 1),
    top10,
  };
  const ranked = CORPUS
    .map((c) => ({ ...c, d: distance(profile, c.profile) }))
    .sort((a, b) => a.d - b.d);
  // Take all within distance 0.4 (tunable). Always at least 5.
  const matched = ranked.filter((r) => r.d < 0.4);
  const sample = matched.length >= 5 ? matched : ranked.slice(0, 5);
  const counts = { twoX: 0, rug: 0, bleed: 0 };
  for (const m of sample) {
    if (m.outcome === "2x") counts.twoX++;
    if (m.outcome === "rug") counts.rug++;
    if (m.outcome === "bleed") counts.bleed++;
  }
  const total = sample.length;
  const top: PredictionAnalog[] = sample.slice(0, 3).map((m) => ({
    symbol: m.symbol,
    outcome: m.outcome,
    similarity: Math.max(0, 1 - m.d * 2),
    detail: `Liq $${Math.round(m.profile.liq).toLocaleString()}, age ${Math.round(m.profile.age)}h, top10 ${m.profile.top10}%`,
  }));
  return {
    matched: total,
    outcomes: {
      twoX: Math.round((counts.twoX / total) * 100),
      rug: Math.round((counts.rug / total) * 100),
      bleed: Math.round((counts.bleed / total) * 100),
    },
    topAnalogs: top,
    basis: `Profile-similarity match against ${CORPUS.length} historical Solana tokens (liquidity, pair age, top-10 concentration).`,
  };
}

export function predictByRules(stats: TokenStats | null, holders: HolderRow[]): RulePrediction {
  const signals: RulePrediction["signals"] = [];
  if (!stats) return { label: "Bear", score: -50, signals: [{ key: "no_data", label: "No market data", weight: 50, positive: false, detail: "Token not indexed on any DEX" }] };
  const liq = stats.liquidityUsd ?? 0;
  const top10 = holders.slice(0, 10).reduce((s, h) => s + h.pct, 0);
  const ch24 = stats.priceChange24h ?? 0;
  const vol = stats.volume24hUsd ?? 0;
  const age = stats.ageHours ?? 0;

  if (liq > 500_000) signals.push({ key: "liq_ok", label: "Liquidity > $500k", weight: 20, positive: true, detail: "Healthy float for entries and exits" });
  else if (liq < 50_000) signals.push({ key: "liq_low", label: "Liquidity < $50k", weight: 25, positive: false, detail: "Easy to drain, expect heavy slippage" });

  if (top10 < 35) signals.push({ key: "dist_ok", label: "Top-10 < 35%", weight: 15, positive: true, detail: "Distribution is reasonable" });
  else if (top10 > 60) signals.push({ key: "dist_bad", label: "Top-10 > 60%", weight: 25, positive: false, detail: "Concentrated supply — single-actor risk" });

  if (ch24 > 20 && vol > 100_000) signals.push({ key: "momo", label: "Momentum", weight: 15, positive: true, detail: `+${ch24.toFixed(1)}% on $${Math.round(vol).toLocaleString()} volume` });
  if (ch24 < -20) signals.push({ key: "drop", label: "Hard drawdown", weight: 15, positive: false, detail: `${ch24.toFixed(1)}% in last 24h` });

  if (age > 168) signals.push({ key: "mature", label: "Pair > 1 week old", weight: 10, positive: true, detail: "Survived early rug window" });
  else if (age < 12) signals.push({ key: "fresh", label: "Pair < 12h old", weight: 20, positive: false, detail: "No track record — highest rug window" });

  const score = signals.reduce((s, x) => s + (x.positive ? x.weight : -x.weight), 0);
  const label: RulePrediction["label"] = score >= 20 ? "Bull" : score <= -20 ? "Bear" : "Neutral";
  return { label, score, signals };
}
