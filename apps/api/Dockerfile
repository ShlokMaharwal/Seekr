# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS base

WORKDIR /app

# Copy root and workspace manifests
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/crawler/package.json ./apps/crawler/package.json

# Install workspace dependencies (with BuildKit npm cache)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# Copy source code
COPY packages/core ./packages/core
COPY apps/api ./apps/api

# Build shared core package from a clean state
RUN rm -rf packages/core/dist packages/core/tsconfig.tsbuildinfo \
    && find packages/core/src -type f \
       \( -name '*.js' -o -name '*.js.map' -o -name '*.d.ts' -o -name '*.d.ts.map' \) \
       -delete \
    && ./node_modules/.bin/tsc -p packages/core/tsconfig.json \
    && test -f packages/core/dist/index.js \
    && test -f packages/core/dist/index.d.ts

# Verify the workspace package link
RUN ls -la node_modules/@seekr/core

# Build API
RUN ./node_modules/.bin/tsc -p apps/api/tsconfig.json

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

COPY --from=base /app/packages/core/package.json ./packages/core/package.json
COPY --from=base /app/packages/core/dist ./packages/core/dist

COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/apps/api/dist ./apps/api/dist

RUN mkdir -p /data

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
