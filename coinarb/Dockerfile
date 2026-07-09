FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
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
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/start-with-tailscale.sh
CMD ["/app/scripts/start-with-tailscale.sh"]
