import type { NextConfig } from "next";
import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},
  
  // Image optimization configuration with remote patterns (Next.js 16+)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'alphalog.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.alphalog.io',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
    ],
  },

  // Security headers for domain
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // === AlphaLog 2.0 redirects ===
      // Trading → Intelligence Suite (algo-trading)
      { source: '/trading/tabs/tradehub', destination: '/intelligence/algo-trading', permanent: true },
      { source: '/trading/tradehub', destination: '/intelligence/algo-trading', permanent: true },
      { source: '/trading/tabs/bot-control', destination: '/intelligence/agents', permanent: true },
      { source: '/trading/bot-control', destination: '/intelligence/agents', permanent: true },
      { source: '/trading/trades', destination: '/intelligence/algo-trading/trades', permanent: true },
      { source: '/trading/evidence', destination: '/intelligence/algo-trading/evidence', permanent: true },
      { source: '/trading/playbook', destination: '/intelligence/algo-trading/playbook', permanent: true },
      { source: '/trading/reports', destination: '/intelligence/algo-trading/reports', permanent: true },
      // Intelligence tabs → flattened
      { source: '/intelligence/tabs/capital-levels', destination: '/intelligence/capital-levels', permanent: true },
      { source: '/intelligence/tabs/constraint-solver', destination: '/intelligence/constraint-solver', permanent: true },
      { source: '/intelligence/tabs/mindops', destination: '/intelligence/mindops', permanent: true },
      { source: '/intelligence/tabs/knowledge-factory', destination: '/intelligence/knowledge-factory', permanent: true },
      // Dashboard duplicates → Intelligence
      { source: '/dashboard/polyarb', destination: '/intelligence/agents/polyarb', permanent: true },
      { source: '/dashboard/bot-control', destination: '/intelligence/agents', permanent: true },
      // TraderMap → Map Hot
      { source: '/dashboard/tradermap', destination: '/map/goals', permanent: true },
      { source: '/dashboard/tradermap/progress-map', destination: '/map/progress', permanent: true },
      { source: '/trading/tabs/tradermap', destination: '/map/goals', permanent: true },
      { source: '/trading/tradermap', destination: '/map/goals', permanent: true },
      // Trading Hub (keep terminal + journal for now)
      { source: '/trading/terminal', destination: '/trading/tabs/terminal', permanent: true },
      { source: '/trading/journal-pt', destination: '/trading/tabs/journal-pt', permanent: true },
      // Business Hub (tabs → flattened)
      { source: '/business/tabs/treasury', destination: '/business/treasury', permanent: true },
      { source: '/business/tabs/business', destination: '/business/operations', permanent: true },
      { source: '/business/business', destination: '/business/operations', permanent: true },
    ];
  },
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching,
  fallbacks: {
    document: "/offline",
  },
});

export default withPWAConfig(nextConfig);
