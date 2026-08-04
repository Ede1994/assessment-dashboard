#!/usr/bin/env node
/**
 * Verifies the native SQLite driver loads. On failure, prints
 * Debian/Ubuntu recovery steps (missing build tools / wrong Node).
 */
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

try {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.prepare("select 1 as ok").get();
  db.close();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`
[assessment-dashboard] Failed to load better-sqlite3 (native SQLite driver).

${message}

Fix on Debian/Ubuntu:

  1. Use Node.js 20 or 22 LTS (see .nvmrc):
       node -v
  2. Install compilers (only needed if prebuilds cannot load):
       sudo apt-get update
       sudo apt-get install -y build-essential python3
  3. Reinstall / rebuild:
       rm -rf node_modules
       npm install
       npm rebuild better-sqlite3

Then re-run: npm run db:push && npm run db:seed && npm run dev
`);
  process.exit(1);
}
