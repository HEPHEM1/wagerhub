"use client";

/**
 * ClientProviders.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side only providers wrapper. This component is a Client Component
 * ("use client") and is therefore allowed to use next/dynamic with ssr:false.
 *
 * WalletConnect SDK reads localStorage at module-evaluation time, which breaks
 * Next.js SSR. By dynamically importing WalletProvider here with ssr:false,
 * we guarantee the SDK only runs in the browser.
 */

import dynamic from "next/dynamic";
import React from "react";

const WalletProviderDynamic = dynamic(
  () =>
    import("@/context/WalletContext").then((mod) => ({
      default: mod.WalletProvider,
    })),
  {
    ssr: false,
    // While the provider is loading, render children unstyled (no flash)
    loading: () => <>{}</>,
  }
);

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WalletProviderDynamic>{children}</WalletProviderDynamic>;
}
