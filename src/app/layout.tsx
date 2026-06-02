import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WAGERHUB | Desktop Command Center",
  description: "Modern, high-stakes Web3 arcade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning={true}
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <head>
        {/*
          ── WagerHub EVM Noise Suppressor ────────────────────────────────────
          This inline script runs synchronously BEFORE any browser extension
          (MetaMask, Coinbase Wallet, etc.) can fire its auto-connect logic.

          WagerHub is a native Hedera application. It uses HashPack via
          HashConnect — it does NOT use window.ethereum or any EVM RPC.

          MetaMask's inpage.js is injected by the Chrome extension and calls
          window.ethereum.request({ method: 'eth_accounts' }) automatically
          on every page load, producing:
            "Failed to connect to MetaMask / extension not found"
          in the console even though we never called it.

          Strategy:
          1. Replace window.ethereum.request with a no-op that rejects instantly,
             preventing the auto-connect from hanging or throwing unhandled errors.
          2. Intercept window.onerror to silently swallow errors whose source is
             chrome-extension:// (MetaMask inpage.js lives there).
          3. Intercept unhandledrejection to suppress EVM promise noise.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    // 1. Seal window.ethereum.request before MetaMask auto-connect fires
    if (typeof window !== 'undefined' && window.ethereum) {
      var _orig = window.ethereum.request.bind(window.ethereum);
      window.ethereum.request = function(args) {
        var method = args && args.method;
        // Block auto-connect probe methods — let manual calls through later
        if (method === 'eth_accounts' || method === 'eth_requestAccounts' || method === 'eth_chainId') {
          return Promise.reject(new Error('EVM auto-connect suppressed. WagerHub uses Hedera/HashPack.'));
        }
        return _orig(args);
      };
    }
  } catch(e) {}

  try {
    // 2. Swallow errors thrown by chrome-extension:// scripts (MetaMask inpage.js)
    var _origError = window.onerror;
    window.onerror = function(msg, src, line, col, err) {
      if (src && src.indexOf('chrome-extension://') === 0) return true; // suppress
      if (_origError) return _origError(msg, src, line, col, err);
    };
  } catch(e) {}

  try {
    // 3. Suppress unhandled EVM promise rejections globally
    window.addEventListener('unhandledrejection', function(event) {
      var msg = (event.reason && event.reason.message) ? event.reason.message : String(event.reason || '');
      if (
        msg.indexOf('MetaMask') !== -1 ||
        msg.indexOf('extension not found') !== -1 ||
        msg.indexOf('ethereum') !== -1 ||
        msg.indexOf('No injected provider') !== -1 ||
        msg.indexOf('EVM auto-connect suppressed') !== -1
      ) {
        event.preventDefault();
      }
    }, true);
  } catch(e) {}
})();
            `.trim(),
          }}
        />
      </head>
      <body suppressHydrationWarning={true} className="h-[100dvh] w-full bg-slate-950 flex flex-col overflow-hidden relative">
        {/* Background Glowing Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-wager-cyan/20 blur-[120px] rounded-full animate-pulse pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-wager-lime/20 blur-[120px] rounded-full animate-pulse pointer-events-none z-0" />

        {/*
          ClientProviders is a "use client" component that internally uses
          dynamic(ssr:false) to load WalletProvider only in the browser,
          preventing WalletConnect from touching localStorage during SSR.
        */}
        <ClientProviders>
          <div className="flex flex-col flex-1 w-full overflow-hidden relative">
            {children}
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}

