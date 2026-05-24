# syntax=docker/dockerfile:1.7

# AlphaLog PWA — Fly.io image
# Multi-stage build that produces a minimal runtime image based on Next.js
# standalone output. Build runs against Node 24 LTS (matches Vercel's runtime).

ARG NODE_VERSION=24-slim

# ---------- deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV CI=true

# Install build toolchain needed by node-gyp deps that some transitive packages
# may compile (web-push, @react-pdf renderer fonts).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- builder ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Next.js + Sentry + PWA need a few NEXT_PUBLIC_* at build time so the values
# get inlined into the client bundle. They're passed as --build-arg from
# `fly deploy` (see MIGRATION-RUNBOOK.md). Default to empty so a local
# `docker build .` still works.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL=https://alphalog.io
ARG NEXT_PUBLIC_CANONICAL_HOST=alphalog.io
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_SECURE_MAIL_DOMAIN=alphalog.io
ARG NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES=10485760
ARG NEXT_PUBLIC_ENABLE_SYSTEM_LOGS=false
ARG NEXT_PUBLIC_ENABLE_AAB=true
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_HCAPTCHA_SITE_KEY
ARG SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CANONICAL_HOST=$NEXT_PUBLIC_CANONICAL_HOST \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_SECURE_MAIL_DOMAIN=$NEXT_PUBLIC_SECURE_MAIL_DOMAIN \
    NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES=$NEXT_PUBLIC_SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES \
    NEXT_PUBLIC_ENABLE_SYSTEM_LOGS=$NEXT_PUBLIC_ENABLE_SYSTEM_LOGS \
    NEXT_PUBLIC_ENABLE_AAB=$NEXT_PUBLIC_ENABLE_AAB \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_HCAPTCHA_SITE_KEY=$NEXT_PUBLIC_HCAPTCHA_SITE_KEY \
    SENTRY_DSN=$SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- runner ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user matching Next.js standalone conventions.
RUN groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy public assets and PWA artifacts (sw.js, workbox-*.js, icons/).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone server bundle includes its own minimal node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Health probe used by Fly's [http_service.checks].
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
