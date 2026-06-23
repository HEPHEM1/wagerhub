/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is enabled by default in Next.js 16.
  // We no longer need custom webpack polyfills because @hashgraph/sdk 
  // has been entirely removed from the browser-side code.
};

export default nextConfig;
