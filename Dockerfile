# Debian Bookworm image with Node 22, npm, sqlite3 CLI, and build tools.
# Build:   docker build -t assessment-dashboard .
# Run:     docker run --rm -p 3000:3000 assessment-dashboard
# Compose: docker compose up --build

FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    sqlite3 \
    build-essential \
    python3 \
  && rm -rf /var/lib/apt/lists/* \
  && node -v \
  && npm -v \
  && sqlite3 --version

WORKDIR /app

# --- dependencies ---
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
# Schema is not present yet; generate later in the builder stage.
RUN npm ci --ignore-scripts

# --- build + seed ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="file:./prisma/dev.db" \
    SESSION_SECRET="assessment-dashboard-docker-secret-change-me-32chars" \
    NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate \
  && npm run check:native \
  && npx prisma db push \
  && npm run db:seed \
  && npm run build \
  && npm prune --omit=dev

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:./prisma/dev.db" \
    SESSION_SECRET="assessment-dashboard-docker-secret-change-me-32chars" \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
