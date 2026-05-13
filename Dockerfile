# syntax=docker/dockerfile:1.7

# Base image — Node 22 LTS on Alpine for small footprint
FROM node:22-alpine AS base

# -----------------------------------------------------------------------------
# Stage 1: deps + build
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Install dependencies (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (DATABASE_URL only needs to exist as a var, not be reachable)
ENV DATABASE_URL="postgresql://placeholder@placeholder/placeholder"
RUN npx prisma generate

# Build Next.js — produces .next/standalone/
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: runtime (minimal production image)
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public static assets
COPY --from=builder /app/public ./public

# Next.js standalone bundle (includes server.js and pruned node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema + config so we can run `prisma migrate deploy` from this container.
# (The prisma CLI, @prisma/*, dotenv and tsx are pulled into the standalone bundle
# via `outputFileTracingIncludes` in next.config.ts.)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
