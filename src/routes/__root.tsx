import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SolanaProviders } from "@/components/providers/SolanaProviders";
import { Header } from "@/components/shell/Header";
import { Ticker } from "@/components/shell/Ticker";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That address or page doesn't exist on Avenai.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90">
            Back to discover
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Avenai — Solana wallet & token intelligence" },
      { name: "description", content: "Pre-swap risk, wallet X-ray, and live whale signals for Solana. Powered by GoldRush." },
      { property: "og:title", content: "Avenai — Solana wallet & token intelligence" },
      { property: "og:description", content: "Pre-swap risk, wallet X-ray, and live whale signals for Solana. Powered by GoldRush." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Avenai — Solana wallet & token intelligence" },
      { name: "twitter:description", content: "Pre-swap risk, wallet X-ray, and live whale signals for Solana. Powered by GoldRush." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ac2aee11-a9bf-4c0c-9954-aec4802b16fc/id-preview-8b2677ec--3cbd9344-e40e-42ae-bf30-2139290683fa.lovable.app-1778080498575.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ac2aee11-a9bf-4c0c-9954-aec4802b16fc/id-preview-8b2677ec--3cbd9344-e40e-42ae-bf30-2139290683fa.lovable.app-1778080498575.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <SolanaProviders>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <Ticker />
        <Outlet />
      </div>
    </SolanaProviders>
  );
}
