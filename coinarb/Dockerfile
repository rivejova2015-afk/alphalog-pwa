FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY scripts/ ./scripts/
CMD ["node", "dist/core/index.js"]
