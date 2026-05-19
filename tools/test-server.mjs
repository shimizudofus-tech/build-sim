/**
 * Lance server.js en mode test (DB séparée, login test, panneau /test/).
 * Usage: npm run test:server
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envTestPath = path.join(root, ".env.test");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

delete process.env.PORT;
loadEnvFile(envTestPath);

const port = process.env.PORT || "8770";
const dbFile = path.join(root, "data", "db.test.json");

process.env.BUILDER_TEST_MODE = "1";
process.env.BUILDER_DB_FILE = dbFile;
process.env.PORT = port;
process.env.PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || `http://localhost:${port}`;
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-only-test-secret-min-32-characters-long";

if (!fs.existsSync(path.dirname(dbFile))) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}

console.log("");
console.log("=== BUILDER — serveur de test ===");
console.log(`Site:        http://localhost:${port}/`);
console.log(`Panneau XP:  http://localhost:${port}/test/`);
console.log(`Base:        ${path.relative(root, dbFile)}`);
console.log(`Config:      ${fs.existsSync(envTestPath) ? ".env.test" : "(défaut — copie .env.test.example)"}`);
console.log("Ctrl+C pour arrêter.");
console.log("");

const child = spawn(process.execPath, [path.join(root, "server.js")], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
