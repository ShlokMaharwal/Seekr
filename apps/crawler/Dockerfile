# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS base
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
COPY apps/crawler/package.json ./apps/crawler/

# Install all deps (with BuildKit npm cache)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# Copy source
COPY packages/core ./packages/core
COPY apps/crawler ./apps/crawler

# Build @seekr/core first (crawler depends on it)
RUN rm -rf packages/core/dist packages/core/tsconfig.tsbuildinfo \
    && ./node_modules/.bin/tsc -p packages/core/tsconfig.json \
    && test -f packages/core/dist/index.js \
    && test -f packages/core/dist/index.d.ts

# Verify workspace symlink points to built core
RUN ls -la node_modules/@seekr/core

# Build apps/crawler
RUN ./node_modules/.bin/tsc -p apps/crawler/tsconfig.json

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

COPY --from=base /app/packages/core/package.json ./packages/core/package.json
COPY --from=base /app/packages/core/dist ./packages/core/dist

COPY --from=base /app/apps/crawler/package.json ./apps/crawler/package.json
COPY --from=base /app/apps/crawler/dist ./apps/crawler/dist

CMD ["node", "apps/crawler/dist/main.js"]
