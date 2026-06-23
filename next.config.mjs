/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standard webpack to avoid Turbopack failing on Wagmi dynamic imports
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false
    };
    config.externals.push(
      'pino-pretty', 
      'lokijs', 
      'encoding', 
      'accounts', 
      '@metamask/connect-evm', 
      'porto', 
      'porto/internal'
    );
    return config;
  }
};

export default nextConfig;
