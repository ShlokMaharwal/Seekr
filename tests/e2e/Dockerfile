FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/crawler/package.json apps/crawler/
RUN npm ci --ignore-scripts
COPY packages/core packages/core
COPY apps/api apps/api
COPY apps/crawler apps/crawler
COPY tests/e2e tests/e2e
COPY bench bench
RUN npm run build
CMD ["node", "tests/e2e/run.mjs"]
