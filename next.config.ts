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
      // Trading Hub
      { source: '/trading/tradehub', destination: '/trading/tabs/tradehub', permanent: true },
      { source: '/trading/terminal', destination: '/trading/tabs/terminal', permanent: true },
      { source: '/trading/bot-control', destination: '/trading/tabs/bot-control', permanent: true },
      { source: '/trading/journal-pt', destination: '/trading/tabs/journal-pt', permanent: true },
      { source: '/trading/tradermap', destination: '/trading/tabs/tradermap', permanent: true },
      // Business Hub
      { source: '/business/treasury', destination: '/business/tabs/treasury', permanent: true },
      { source: '/business/business', destination: '/business/tabs/business', permanent: true },
      // Intelligence Suite
      { source: '/intelligence/capital-levels', destination: '/intelligence/tabs/capital-levels', permanent: true },
      { source: '/intelligence/constraint-solver', destination: '/intelligence/tabs/constraint-solver', permanent: true },
      { source: '/intelligence/mindops', destination: '/intelligence/tabs/mindops', permanent: true },
      { source: '/intelligence/knowledge-factory', destination: '/intelligence/tabs/knowledge-factory', permanent: true },
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
