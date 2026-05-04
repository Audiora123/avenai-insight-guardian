// Shared formatters used everywhere in Avenai.

export function formatUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (opts.compact || abs >= 10_000) {
    return "$" + compact(n);
  }
  if (abs >= 1) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (abs >= 0.01) return "$" + n.toFixed(4);
  return "$" + n.toPrecision(3);
}

export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function shortAddr(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  return d + "d";
}

// Solana base58 address detection — quick and good-enough for routing decisions.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isSolanaAddress(s: string): boolean {
  return BASE58.test(s.trim());
}
