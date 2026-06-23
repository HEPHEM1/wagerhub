/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // These Node.js built-ins are not available in the browser.
      // The @hashgraph/sdk is only used server-side (API routes).
      // All browser-side wallet logic now uses Reown/Wagmi (pure EVM).
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
      };
    }

    return config;
  },
};

export default nextConfig;
