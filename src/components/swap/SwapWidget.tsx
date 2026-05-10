import * as React from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { ArrowDownUp, Loader2, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { compact } from "@/lib/format";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface QuoteResp {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: Array<{ swapInfo: { label: string } }>;
  otherAmountThreshold?: string;
  slippageBps?: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "quoting" }
  | { kind: "quoted"; q: QuoteResp }
  | { kind: "swapping"; q: QuoteResp }
  | { kind: "sent"; sig: string }
  | { kind: "error"; msg: string };

interface Props {
  /** Output token mint (the token being analyzed). */
  outputMint: string;
  /** Output token symbol for display. */
  outputSymbol: string;
  outputDecimals?: number;
  /** Default USD size, used to seed SOL amount. */
  initialUsd?: number;
  /** Live SOL/USD spot price (used to convert USD → SOL). */
  solPriceUsd?: number | null;
}

export function SwapWidget({ outputMint, outputSymbol, outputDecimals = 6, initialUsd = 50, solPriceUsd }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [inputMint, setInputMint] = React.useState<string>(SOL_MINT);
  const inputDecimals = inputMint === SOL_MINT ? 9 : 6;
  const inputSymbol = inputMint === SOL_MINT ? "SOL" : "USDC";

  const seed = inputMint === SOL_MINT && solPriceUsd ? initialUsd / solPriceUsd : initialUsd;
  const [amount, setAmount] = React.useState<string>(seed.toFixed(inputMint === SOL_MINT ? 4 : 2));
  const [slippageBps, setSlippageBps] = React.useState<number>(100); // 1%
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  // Auto-quote with debounce
  React.useEffect(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setStatus({ kind: "idle" }); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        setStatus({ kind: "quoting" });
        const raw = BigInt(Math.floor(n * Math.pow(10, inputDecimals))).toString();
        const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${raw}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
        const r = await fetch(url);
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`Quote failed (${r.status})${txt ? `: ${txt.slice(0, 120)}` : ""}`);
        }
        const q = (await r.json()) as QuoteResp;
        if (!alive) return;
        setStatus({ kind: "quoted", q });
      } catch (e) {
        if (alive) setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Quote failed" });
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [amount, inputMint, outputMint, slippageBps, inputDecimals]);

  async function handleSwap() {
    if (status.kind !== "quoted") return;
    if (!wallet.publicKey || !wallet.signTransaction) return;
    const q = status.q;
    try {
      setStatus({ kind: "swapping", q });
      const swapResp = await fetch("https://lite-api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: q,
          userPublicKey: wallet.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapResp.ok) throw new Error(`Swap build failed (${swapResp.status})`);
      const { swapTransaction } = (await swapResp.json()) as { swapTransaction: string };
      const bin = atob(swapTransaction);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const tx = VersionedTransaction.deserialize(bytes);
      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      setStatus({ kind: "sent", sig });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Swap failed" });
    }
  }

  const out = status.kind === "quoted" || status.kind === "swapping" ? status.q : null;
  const outAmt = out ? Number(out.outAmount) / Math.pow(10, outputDecimals) : 0;
  const impact = out ? Number(out.priceImpactPct) * 100 : 0;
  const route = out?.routePlan?.map((r) => r.swapInfo.label).slice(0, 3).join(" → ") || "—";

  return (
    <section className="rounded-lg border border-hairline bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Swap on Avenai</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Best route aggregator</span>
      </div>

      {/* Pay */}
      <div className="rounded-md border border-hairline bg-surface-2 p-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>You pay</span>
          <select
            value={inputMint}
            onChange={(e) => setInputMint(e.target.value)}
            className="rounded bg-transparent text-foreground outline-none"
          >
            <option value={SOL_MINT}>SOL</option>
            <option value={USDC_MINT}>USDC</option>
          </select>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="nums w-full bg-transparent text-2xl font-semibold outline-none"
          />
          <span className="text-sm text-muted-foreground">{inputSymbol}</span>
        </div>
        {inputMint === SOL_MINT && solPriceUsd && Number(amount) > 0 && (
          <div className="mt-1 text-[11px] text-muted-foreground">≈ ${(Number(amount) * solPriceUsd).toFixed(2)}</div>
        )}
      </div>

      <div className="my-2 flex justify-center">
        <div className="rounded-full border border-hairline bg-surface-2 p-1.5">
          <ArrowDownUp className="size-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Receive */}
      <div className="rounded-md border border-hairline bg-surface-2 p-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>You receive</span>
          <span className="font-mono">{outputSymbol}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="nums flex-1 truncate text-2xl font-semibold">
            {status.kind === "quoting" ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : compact(outAmt)}
          </div>
          <span className="text-sm text-muted-foreground">{outputSymbol}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div>Impact: <span className={cn("nums", impact > 2 ? "text-danger" : impact > 0.5 ? "text-caution" : "text-safe")}>{impact.toFixed(2)}%</span></div>
          <div className="truncate">Route: <span className="text-foreground">{route}</span></div>
        </div>
      </div>

      {/* Slippage */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Slippage</span>
        {[50, 100, 300].map((bps) => (
          <button
            key={bps}
            onClick={() => setSlippageBps(bps)}
            className={cn(
              "rounded-md border px-2 py-0.5",
              slippageBps === bps ? "border-foreground text-foreground" : "border-hairline hover:bg-surface-2",
            )}
          >
            {(bps / 100).toFixed(bps < 100 ? 2 : 0)}%
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4">
        {!wallet.connected ? (
          <div className="[&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!justify-center [&_.wallet-adapter-button]:!bg-foreground [&_.wallet-adapter-button]:!text-background [&_.wallet-adapter-button]:!h-10 [&_.wallet-adapter-button]:!rounded-md [&_.wallet-adapter-button]:!font-medium">
            <WalletMultiButton />
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={status.kind !== "quoted"}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {status.kind === "swapping" ? <Loader2 className="size-4 animate-spin" /> : null}
            {status.kind === "swapping" ? "Confirm in wallet…" : `Swap ${inputSymbol} → ${outputSymbol}`}
          </button>
        )}
      </div>

      {/* Status */}
      {status.kind === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-2 text-[11px] text-danger">
          <AlertCircle className="size-3.5 shrink-0" /> {status.msg}
        </div>
      )}
      {status.kind === "sent" && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-safe/30 bg-safe/10 p-2 text-[11px] text-safe">
          <CheckCircle2 className="size-3.5 shrink-0" />
          Swap submitted.
          <a
            href={`https://solscan.io/tx/${status.sig}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            View on Solscan <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </section>
  );
}
