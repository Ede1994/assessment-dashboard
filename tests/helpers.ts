import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const TEST_PORT = Number(process.env.TEST_PORT ?? 3010);
export const TEST_BASE = `http://127.0.0.1:${TEST_PORT}`;
export const TEST_DATABASE_URL = "file:./prisma/test.db";
export const TEST_SESSION_SECRET =
  "assessment-dashboard-test-secret-at-least-32chars";

type CookieJar = Map<string, string>;

export function createCookieJar(): CookieJar {
  return new Map();
}

function ingestSetCookie(jar: CookieJar, res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [];
  const fallback = res.headers.get("set-cookie");
  const list = raw.length > 0 ? raw : fallback ? [fallback] : [];
  for (const entry of list) {
    const [pair] = entry.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function apiFetch(
  jar: CookieJar,
  pathname: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${TEST_BASE}${pathname}`, { ...init, headers });
  ingestSetCookie(jar, res);
  return res;
}

export async function login(
  username: string,
  password: string,
  jar = createCookieJar(),
) {
  const res = await apiFetch(jar, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `Login response was not JSON (status ${res.status}): ${text.slice(0, 300)}`,
    );
  }
  return { res, data, jar };
}

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${TEST_BASE}/login`);
      if (res.status > 0 && res.status < 500) return;
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await delay(400);
  }
  throw new Error(
    `Server did not become ready on ${TEST_BASE} (last error: ${lastError})`,
  );
}

export async function startTestServer(): Promise<ChildProcess> {
  const child = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(TEST_PORT)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(TEST_PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: TEST_SESSION_SECRET,
      SESSION_COOKIE_SECURE: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout?.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    logs += String(chunk);
  });

  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      logs += `\n[server exited code=${code} signal=${signal}]\n`;
    }
  });

  try {
    await waitForServer();
  } catch (err) {
    child.kill("SIGKILL");
    throw new Error(`${String(err)}\n--- server logs ---\n${logs}`);
  }

  return child;
}

export async function stopTestServer(child: ChildProcess | undefined) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await delay(500);
  if (!child.killed) child.kill("SIGKILL");
}
