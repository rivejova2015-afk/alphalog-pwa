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
      // === AlphaLog 2.1 redirects ===

      // Trading → Intelligence (all old /trading/* paths)
      { source: '/trading', destination: '/intelligence', permanent: true },
      { source: '/trading/tabs/tradehub', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/tradehub', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/tabs/bot-control', destination: '/intelligence/agents', permanent: true },
      { source: '/trading/bot-control', destination: '/intelligence/agents', permanent: true },
      { source: '/trading/accounts', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/trades', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/evidence', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/playbook', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/reports', destination: '/intelligence/algorithms', permanent: true },
      { source: '/trading/tabs/terminal', destination: '/intelligence', permanent: true },
      { source: '/trading/tabs/tradermap', destination: '/map-hot/goals', permanent: true },
      { source: '/trading/tabs/journal-pt', destination: '/business/journal', permanent: true },
      { source: '/trading/:path*', destination: '/intelligence', permanent: true },

      // algo-trading → algorithms (2.0 route renamed in 2.1)
      { source: '/intelligence/algo-trading', destination: '/intelligence/algorithms', permanent: true },
      { source: '/intelligence/algo-trading/:path*', destination: '/intelligence/algorithms', permanent: true },

      // Old intelligence tabs → deleted (send to intelligence hub)
      { source: '/intelligence/tabs/:path*', destination: '/intelligence', permanent: true },
      { source: '/intelligence/capital-levels', destination: '/intelligence', permanent: true },
      { source: '/intelligence/constraint-solver', destination: '/intelligence', permanent: true },
      { source: '/intelligence/mindops', destination: '/intelligence', permanent: true },
      { source: '/intelligence/knowledge-factory', destination: '/intelligence', permanent: true },
      { source: '/intelligence/overview', destination: '/intelligence', permanent: true },

      // Dashboard duplicates → Intelligence / Map Hot
      { source: '/dashboard/polyarb', destination: '/intelligence/agents', permanent: true },
      { source: '/dashboard/bot-control', destination: '/intelligence/agents', permanent: true },
      { source: '/dashboard/bot-control/:path*', destination: '/intelligence/agents', permanent: true },
      { source: '/dashboard/tradehub', destination: '/intelligence/algorithms', permanent: true },
      { source: '/dashboard/tradehub/:path*', destination: '/intelligence/algorithms', permanent: true },
      { source: '/dashboard/tradermap', destination: '/map-hot/goals', permanent: true },
      { source: '/dashboard/tradermap/:path*', destination: '/map-hot/goals', permanent: true },
      { source: '/dashboard/treasury', destination: '/business/operations', permanent: true },

      // Map → Map Hot (2.0 routes → 2.1 routes)
      { source: '/map', destination: '/map-hot', permanent: true },
      { source: '/map/goals', destination: '/map-hot/goals', permanent: true },
      { source: '/map/progress', destination: '/map-hot/progress', permanent: true },
      { source: '/map/planning', destination: '/map-hot/planning', permanent: true },

      // Business: remove treasury, fix old tabs
      { source: '/business/tabs/treasury', destination: '/business/operations', permanent: true },
      { source: '/business/tabs/business', destination: '/business/operations', permanent: true },
      { source: '/business/treasury', destination: '/business/operations', permanent: true },
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
