# Optional reference image for Debian/Ubuntu-based machines.
# Build:  docker build -t assessment-dashboard .
# Run:    docker run --rm -p 3000:3000 assessment-dashboard
#
# Prefer running natively with Node 22 + the README Linux setup when developing.

FROM node:22-bookworm-slim

WORKDIR /app

# Compilers only as a fallback if a prebuild cannot load (rare on bookworm).
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
# Demo secrets for image smoke builds only — override SESSION_SECRET in real deploys.
ENV DATABASE_URL="file:./prisma/dev.db" \
    SESSION_SECRET="assessment-dashboard-docker-secret-change-me-32chars"

RUN npx prisma generate \
  && npm run check:native \
  && npx prisma db push \
  && npm run db:seed \
  && npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
