import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // ── Polyfill fallbacks for Hedera SDK (Node.js modules not in browser) ──
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      dns: false,
      crypto: false,
    };

    // ── Null out WalletConnect's EVM/MetaMask injected provider scanner ─────
    // WalletConnect bundles an EIP-1193 injected provider detector that
    // auto-connects to MetaMask on page load. WagerHub is Hedera-only and
    // has no use for EVM providers. Aliasing these to false drops them from
    // the bundle entirely, preventing the 'MetaMask extension not found'
    // error from ever firing.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@walletconnect/ethereum-provider": false,
      "@web3modal/ethereum": false,
    };

    return config;
  },
};

export default nextConfig;

