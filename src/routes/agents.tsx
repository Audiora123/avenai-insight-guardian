import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents API · Avenai" },
      { name: "description", content: "Pay-per-call x402 endpoint for AI agents to query Solana token risk in machine-readable JSON." },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-[260px_1fr_460px]">
        {/* Side nav */}
        <nav className="hidden flex-col gap-1 text-sm text-muted-foreground lg:flex">
          <div className="text-[10px] uppercase tracking-wider">Endpoints</div>
          <a href="#risk" className="rounded px-2 py-1 hover:bg-surface hover:text-foreground">POST /agents/risk</a>
          <div className="mt-4 text-[10px] uppercase tracking-wider">Auth</div>
          <a href="#x402" className="rounded px-2 py-1 hover:bg-surface hover:text-foreground">x402 payment flow</a>
        </nav>

        {/* Content */}
        <article className="space-y-10">
          <section>
            <h1 className="text-3xl font-semibold tracking-tight">Avenai Agents API</h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              The same risk engine that powers the Avenai UI, exposed as a machine-readable JSON
              endpoint for AI agents. Pay per call in USDC on Solana via the x402 protocol.
              No accounts, no API keys.
            </p>
          </section>

          <section id="risk">
            <h2 className="text-xl font-semibold tracking-tight">POST /api/public/agents/risk</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Returns the full risk report for a Solana token mint, including factor breakdown,
              top holder concentration, and dual prediction (analog match + rule-based).
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface">
              <div className="border-b border-hairline bg-surface-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Request</div>
              <pre className="overflow-x-auto p-4 font-mono text-xs">{`POST /api/public/agents/risk
Content-Type: application/json

{ "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" }`}</pre>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface">
              <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>First call</span>
                <span className="text-danger">402 Payment Required</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs">{`HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "scheme": "exact",
  "network": "solana-devnet",
  "asset": "USDC",
  "amount": "0.01",
  "payTo": "<avenai treasury address>",
  "nonce": "0x...",
  "expiry": 1735689600,
  "memo": "avenai:risk:<nonce>"
}`}</pre>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface">
              <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>Replay with payment proof</span>
                <span className="text-safe">200 OK</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs">{`POST /api/public/agents/risk
X-Payment-Tx: <devnet-usdc-transaction-signature>
Content-Type: application/json

{ "mint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" }

→ { "score": 18, "verdict": "safe", "factors": [...], "analogs": {...}, "rules": {...} }`}</pre>
            </div>
          </section>

          <section id="x402">
            <h2 className="text-xl font-semibold tracking-tight">x402 payment flow</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Call the endpoint without payment headers — receive HTTP 402 with payment instructions.</li>
              <li>Build a USDC transfer on Solana devnet matching the <span className="font-mono text-foreground">amount</span>, <span className="font-mono text-foreground">payTo</span>, and <span className="font-mono text-foreground">memo</span> fields.</li>
              <li>Send and confirm the transaction. Capture the signature.</li>
              <li>Re-call the endpoint with <span className="font-mono text-foreground">X-Payment-Tx</span> set to the signature. Avenai verifies recipient, amount, and memo on-chain, then returns 200 with the risk report.</li>
              <li>Each nonce is single-use. Re-using a paid signature returns 409 Conflict.</li>
            </ol>
          </section>
        </article>

        {/* Live console placeholder */}
        <aside className="rounded-lg border border-hairline bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Live console</div>
          <p className="mt-2 text-xs text-muted-foreground">
            On-chain x402 verification is shipping in the next deploy.
            Verification will use Solana devnet so calls cost only test USDC.
          </p>
          <div className="mt-3 rounded border border-dashed border-hairline p-3 font-mono text-[11px] text-muted-foreground">
            curl https://&lt;your-deploy&gt;/api/public/agents/risk \\
            <br />&nbsp;&nbsp;-H "Content-Type: application/json" \\
            <br />&nbsp;&nbsp;-d '{"{"} "mint": "..." {"}"}'
          </div>
        </aside>
      </div>
    </main>
  );
}
