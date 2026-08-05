import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(
  root,
  "node_modules",
  "@fortawesome",
  "fontawesome-free",
  "webfonts",
);
const destDir = path.join(root, "public", "webfonts");

const files = [
  "fa-solid-900.woff2",
  "fa-regular-400.woff2",
  "fa-brands-400.woff2",
];

if (!fs.existsSync(srcDir)) {
  console.warn(
    "[copy-webfonts] Font Awesome package not found; skip webfont copy.",
  );
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const file of files) {
  const from = path.join(srcDir, file);
  const to = path.join(destDir, file);
  if (!fs.existsSync(from)) {
    console.warn(`[copy-webfonts] Missing ${file}; skip.`);
    continue;
  }
  fs.copyFileSync(from, to);
}

console.log(`[copy-webfonts] Copied Font Awesome webfonts → public/webfonts`);
