## Base layer: install shared dependencies once (leverages Docker layer caching)
FROM node:24-alpine AS base
RUN apk add --no-cache python3 make g++ wget \
    && npm install -g pnpm
WORKDIR /app

# Copy only dependency manifests to maximize cache hits
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace dependencies (dev + prod)
RUN pnpm install --frozen-lockfile

## Workspace stage: add the full source tree (filtered by .dockerignore)
FROM base AS workspace
COPY . .

## Build shared package once and reuse its artifacts everywhere else
FROM workspace AS shared-builder
RUN pnpm --filter @bluelight-hub/shared build

## Frontend build (inherits compiled shared package)
FROM shared-builder AS frontend-builder
ENV NODE_ENV=production
ENV SKIP_TESTS=true
RUN pnpm --filter @bluelight-hub/frontend build

## Backend build (also reuses shared build artifacts)
FROM shared-builder AS backend-builder
RUN pnpm --filter @bluelight-hub/backend build

## Production image: minimal runtime with pre-built artifacts only
FROM node:24-alpine AS production
RUN apk add --no-cache python3 make g++ wget \
    && npm install -g pnpm
WORKDIR /app

# Copy workspace metadata needed for pnpm to resolve workspaces
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Reuse node_modules (mit generiertem Prisma Client) aus dem Backend-Builder
COPY --from=backend-builder /app/node_modules ./node_modules

# Dev-Abhängigkeiten entfernen, Prisma-Client bleibt erhalten
RUN CI=true pnpm prune --prod

# Copy build outputs and runtime assets
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=shared-builder /app/packages/shared/client ./packages/shared/client
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=backend-builder /app/packages/backend/.config ./packages/backend/.config
COPY --from=frontend-builder /app/packages/frontend/dist ./public

ENV NODE_ENV=production
WORKDIR /app/packages/backend

# Prepare uploads directory and ensure node user owns runtime paths
RUN mkdir -p /app/uploads/lagekarte \
    && chown -R node:node /app/uploads

USER node
EXPOSE 3090

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3090/api/health || exit 1

# Start NestJS backend (dist/src/main wird von nest build erzeugt)
CMD ["node", "dist/src/main"]
