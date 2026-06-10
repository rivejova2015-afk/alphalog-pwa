import type { NextConfig } from "next";
import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

// Wrap the config in `withBundleAnalyzer` when ANALYZE=true is set. Run with:
//   ANALYZE=true npm run build
// Outputs reports at .next/analyze/{client.html,server.html}.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// Public Supabase project identifiers. Both values are anon-tier (the URL is
// public by definition, the anon key is a JWT with role="anon" designed to be
// embedded in browser bundles). Hardcoding them here is a *fallback* — if
// process.env.NEXT_PUBLIC_SUPABASE_* are set (eg. from GitHub Actions secrets
// during a Fly deploy, or from .env.local in dev), those win. This guarantees
// that a build without the secrets configured still produces a working bundle
// instead of `undefined` literals that crash @supabase/ssr at runtime.
//
// Rotating these requires editing this file (anon keys rotate via Supabase
// Dashboard → Settings → API → "Generate new JWT secret"). The service-role
// key is NEVER hardcoded — it bypasses RLS.
const SUPABASE_URL_FALLBACK = "https://jgkvnnlodwdtjsmmzwry.supabase.co";
const SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impna3ZubmxvZHdkdGpzbW16d3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDY3OTAsImV4cCI6MjA4NDE4Mjc5MH0.Tsovh-fnb8T8Sm5mwdhjlsevhDpIW9JUd5dkWAtM7JI";
// hCaptcha site key — public by design (rendered into the auth page HTML so
// the widget can mount). Required because Supabase has captcha protection
// enabled on signInWithPassword / signup / resetPasswordForEmail; without a
// token the server rejects with "captcha protection: request disallowed".
// The matching secret lives Supabase server-side and must never be hardcoded.
const HCAPTCHA_SITE_KEY_FALLBACK = "ad3ac77c-d9dc-4842-9938-6fece5586dce";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},

  // Inject anon-tier Supabase identifiers at build time. Empty `process.env`
  // values (which is what `${{ secrets.X }}` resolves to when X doesn't exist
  // in GitHub Actions) fall through to the hardcoded fallback so the bundle
  // never ships with `undefined` strings.
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK,
    NEXT_PUBLIC_HCAPTCHA_SITE_KEY:
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || HCAPTCHA_SITE_KEY_FALLBACK,
  },

  // Standalone output enables minimal Docker images (self-contained server.js + only
  // the production deps actually used). Required for the Fly.io migration; harmless
  // on Vercel since Vercel uses its own build adapter.
  output: 'standalone',

  // Limit parallel workers during `next build` to keep memory under ~4GB. Without
  // this Next.js spawns one worker per CPU (Fly's Depot builder reports 16+ CPUs),
  // each loading the full bundle, and OOMs the builder container. 2 workers is
  // slower (~2x) but reliable.
  experimental: {
    cpus: 2,
  },
  
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
            value: 'DENY',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'",
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

      // Legacy intelligence paths from the 2.1 refactor → hub. Do NOT add a
      // wildcard /intelligence/tabs/:path* here — that would also clobber
      // capital-levels / constraint-monitor / mindops / knowledge-factory
      // which all live under /intelligence/tabs/* and are real pages.
      { source: '/intelligence/capital-levels', destination: '/intelligence/tabs/capital-levels', permanent: true },
      { source: '/intelligence/constraint-solver', destination: '/intelligence/tabs/constraint-monitor', permanent: true },
      { source: '/intelligence/tabs/constraint-solver', destination: '/intelligence/tabs/constraint-monitor', permanent: true },
      { source: '/intelligence/mindops', destination: '/intelligence/tabs/mindops', permanent: true },
      { source: '/intelligence/knowledge-factory', destination: '/intelligence/tabs/knowledge-factory', permanent: true },
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

// Sentry build wrapper. Without SENTRY_AUTH_TOKEN it still works — the
// webpack plugin warns and skips source-map upload but the build succeeds.
// `silent: true` suppresses noise in local dev.
export default withSentryConfig(withBundleAnalyzer(withPWAConfig(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  widenClientFileUpload: true,
  // Browser events go through this app-domain proxy so ad-blockers (uBlock,
  // Brave Shields) don't drop them. Sentry auto-generates the proxy route
  // at build time. Requires NEXT_PUBLIC_SENTRY_DSN to be set (Fly secret).
  tunnelRoute: "/monitoring",
});
