# syntax=docker/dockerfile:1

# ==========================================
# 1. Base Image
# ==========================================
FROM node:20-alpine AS base

# Install libc6-compat for Alpine compatibility with Next.js/Turbopack/SWC native binaries
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ==========================================
# 2. Dependencies Stage
# ==========================================
FROM base AS deps

# Copy package descriptors
COPY package.json package-lock.json ./

# Install dependencies (use legacy-peer-deps for React 19 compatibility)
RUN npm ci --legacy-peer-deps

# ==========================================
# 3. Builder Stage
# ==========================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application securely using BuildKit secrets.
# The secret is mounted only for the duration of this RUN, so the .env itself is
# never committed to a layer.
#
# The `rm` is load-bearing, not tidy-up. `output: standalone` copies .env and
# .env.production out of the project root into .next/standalone/, and the runner
# stage below copies that whole tree into the final image. Without this the
# secret-mounted .env is reproduced verbatim at /app/.env in the shipped image,
# which defeats the point of using a build secret at all. Deleting it inside the
# same RUN means it never reaches a layer in the first place -- removing it in a
# later step would leave it recoverable from the earlier layer.
#
# Runtime values come from `env_file` in docker-compose.yml, which injects them
# as real environment variables, so no .env file is needed in the image.
RUN --mount=type=secret,id=env,target=/app/.env \
    npm run build && \
    rm -f .next/standalone/.env .next/standalone/.env.*

# ==========================================
# 4. Production Runner Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create unprivileged system user & group for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and public directory
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Docker healthcheck targeting the dedicated /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
