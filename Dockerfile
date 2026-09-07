# syntax=docker/dockerfile:1

# Base image with pnpm enabled (pnpm v10 — v11 has stricter build-script gating)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables at build time
# (NEXT_PUBLIC_* values are baked into the client bundle)
# NEXT_PUBLIC_API_URL defaults to a sentinel token instead of a real URL:
# it still gets inlined into the client bundle at build time, but
# docker-entrypoint.sh rewrites that token to the real runtime value on
# container start. Lets one built image be redeployed against a different
# api domain (self-hosted / airgapped installs) without a rebuild. Pass a
# real URL as a build-arg instead for the classic bake-only behavior.
ARG NEXT_PUBLIC_API_URL=__RUNTIME_NEXT_PUBLIC_API_URL__
ARG NEXT_PUBLIC_APP_VERSION=dev

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application (standalone output bundles only what is needed)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3004

ENV PORT=3004
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
