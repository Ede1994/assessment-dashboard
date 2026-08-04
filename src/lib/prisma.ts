import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function resolveDatabasePath(databaseUrl = process.env.DATABASE_URL) {
  const dbUrl = databaseUrl ?? "file:./prisma/dev.db";
  const relative = dbUrl.replace(/^file:/, "").replace(/^\.\//, "");
  if (path.isAbsolute(relative)) {
    return relative;
  }
  // Keep path under prisma/ so Turbopack tracing stays scoped.
  const underPrisma = relative.startsWith("prisma/")
    ? relative
    : path.join("prisma", path.basename(relative));
  return path.join(/*turbopackIgnore: true*/ process.cwd(), underPrisma);
}

function createPrismaClient() {
  const url = resolveDatabasePath();
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
