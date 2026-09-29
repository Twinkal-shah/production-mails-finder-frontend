# syntax=docker/dockerfile:1

# ---------- deps ----------
FROM node:22-alpine AS deps
# sharp (used by next/image) needs glibc compat on alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# have to be passed here as build args -- setting them only at runtime is too late.
ARG NEXT_PUBLIC_API_ENV
ARG NEXT_PUBLIC_API_URL_PROD
ARG NEXT_PUBLIC_API_URL_STAGING
ARG NEXT_PUBLIC_API_URL_LOCAL
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_LOCAL_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CORE_API_BASE
ARG NEXT_PUBLIC_BACKEND_SIGNUP_PATH
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK

ENV NEXT_PUBLIC_API_ENV=$NEXT_PUBLIC_API_ENV \
    NEXT_PUBLIC_API_URL_PROD=$NEXT_PUBLIC_API_URL_PROD \
    NEXT_PUBLIC_API_URL_STAGING=$NEXT_PUBLIC_API_URL_STAGING \
    NEXT_PUBLIC_API_URL_LOCAL=$NEXT_PUBLIC_API_URL_LOCAL \
    NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
    NEXT_PUBLIC_LOCAL_URL=$NEXT_PUBLIC_LOCAL_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_CORE_API_BASE=$NEXT_PUBLIC_CORE_API_BASE \
    NEXT_PUBLIC_BACKEND_SIGNUP_PATH=$NEXT_PUBLIC_BACKEND_SIGNUP_PATH \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK=$NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build:prod

# ---------- runner ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: standalone` emits a self-contained server; static assets and /public
# are not included in it and must be copied alongside.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
