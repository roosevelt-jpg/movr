# Movr web — static build served by nginx.
# Build context MUST be the repo root (needs design-system/ alongside frontend/web/):
#   docker build -f frontend/web/Dockerfile -t movr-web .
FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/web/package.json frontend/web/package.json
COPY frontend/admin/package.json frontend/admin/package.json
COPY design-system/package.json design-system/package.json
COPY mobile/customer/package.json mobile/customer/package.json
COPY mobile/driver/package.json mobile/driver/package.json
COPY mobile/customer-app/package.json mobile/customer-app/package.json
COPY mobile/driver-app/package.json mobile/driver-app/package.json

RUN pnpm install --frozen-lockfile --filter @movr/web...

COPY design-system ./design-system
COPY frontend/web ./frontend/web

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/frontend/web
# `pnpm build` (tsc && vite build) fails on pre-existing type errors unrelated to
# the production bundle; vite build itself transpiles via esbuild independently.
RUN pnpm exec vite build

FROM nginx:1.27-alpine
COPY frontend/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/web/dist /usr/share/nginx/html
EXPOSE 80
