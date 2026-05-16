import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

await fs.copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
await fs.cp(path.join(root, "assets"), path.join(dist, "assets"), {
  recursive: true,
  force: true,
});

console.log("Cloudflare Pages build ready in dist/");
