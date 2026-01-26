import type { NextConfig } from "next";

type WithPWA = (options: Record<string, unknown>) => (config: NextConfig) => NextConfig;

let withPWA: WithPWA = () => (config) => config;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("next-pwa");
  withPWA = mod?.default ?? mod;
} catch (error) {
  console.warn("[PWA] next-pwa not available, skipping PWA config", error);
}

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
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
});

export default withPWAConfig(nextConfig);
