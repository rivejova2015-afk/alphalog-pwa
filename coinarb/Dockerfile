FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY scripts/ ./scripts/
CMD ["node", "dist/strategies/fifty-x/index.js"]
