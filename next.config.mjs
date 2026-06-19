/** @type {import('next').NextConfig} */
const nextConfig = {
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
    config.resolve.alias = {
      ...config.resolve.alias,
      "@walletconnect/ethereum-provider": false,
      "@web3modal/ethereum": false,
    };

    return config;
  },
};

export default nextConfig;
