FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
# npm ci (not npm install) here would require package-lock.json to exactly
# match this build environment's optional-dependency resolution. It doesn't:
# an optional multi-platform WASM binding transitively pulled in by a
# devDependency (@rolldown/binding-wasm32-wasi, itself irrelevant at runtime
# on any real target platform) resolves slightly differently across npm
# client versions/OSes, so the lockfile drifts between Windows, local Docker,
# and Fly's remote Depot builder even right after a fresh `npm install`.
# `npm install` tolerates that drift while still respecting package.json's
# version ranges.
RUN npm install
COPY src/ ./src/
RUN npm run build

FROM node:22-slim

# Tailscale (sidecar): conecta el contenedor a la red Headscale propia antes de arrancar el bot.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg \
    && curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list \
    && apt-get update && apt-get install -y tailscale \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# See the builder stage's comment above for why npm install instead of npm ci.
RUN npm install --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/start-with-tailscale.sh
CMD ["/app/scripts/start-with-tailscale.sh"]
