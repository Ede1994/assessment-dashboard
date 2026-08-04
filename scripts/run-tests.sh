#!/usr/bin/env bash
# Prepare a seeded test DB, ensure a production build exists, run API tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="file:./prisma/test.db"
export SESSION_SECRET="assessment-dashboard-test-secret-at-least-32chars"
export SESSION_COOKIE_SECURE="false"
export NEXT_TELEMETRY_DISABLED=1

echo "==> Preparing test database"
rm -f prisma/test.db prisma/test.db-journal
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

if [[ ! -f .next/BUILD_ID ]]; then
  echo "==> Building Next.js app (no production build yet)"
  npm run build
fi

echo "==> Running API tests"
npx tsx --test tests/api.test.ts
