# Movr API — production image for Amazon ECR / ECS
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

RUN pnpm run build

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init \
  && corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 \
  && chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { if (r.statusCode !== 200) process.exit(1) })"

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
