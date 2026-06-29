/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Use standard webpack to avoid Turbopack failing on Wagmi dynamic imports
  webpack: (config, { dev, isServer }) => {
    // 1. Ensure resolve.fallback handles node modules cleanly
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      os: false,
      path: false,
      zlib: false
    };

    // 2. Check if heavy wallet-connect or cryptography dependencies can be marked to skip processing
    config.externals.push(
      'pino-pretty', 
      'lokijs', 
      'encoding', 
      'accounts', 
      '@metamask/connect-evm', 
      'porto', 
      'porto/internal',
      // Externalize massive hashgraph protobufs on server side to speed up compilation
      ...(isServer ? ['@hashgraph/sdk'] : [])
    );

    // 3. Add target cache configurations for ultra-fast local dev
    if (dev) {
      config.cache = {
        type: 'filesystem',
        // Disable cache compression to trade disk space for massive speed gains
        compression: 'none',
        allowCollectingMemory: true,
      };

      // Tell Webpack's watcher to completely ignore Hardhat build folders
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/artifacts/**', '**/cache/**', '**/.hardhat/**', '**/node_modules/**']
      };
      
      // Turn off slow Webpack AST optimizations during local development
      if (config.optimization) {
        config.optimization.removeAvailableModules = false;
        config.optimization.removeEmptyChunks = false;
        config.optimization.splitChunks = false;
      }
    }

    return config;
  }
};

export default nextConfig;
