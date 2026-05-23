import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

await fs.copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
await fs.copyFile(path.join(root, "overlay-popout.html"), path.join(dist, "overlay-popout.html"));
await fs.cp(path.join(root, "assets"), path.join(dist, "assets"), {
  recursive: true,
  force: true,
});
await fs.cp(path.join(root, "locales"), path.join(dist, "locales"), {
  recursive: true,
  force: true,
});

for (const file of ["robots.txt", "sitemap.xml"]) {
  try {
    await fs.copyFile(path.join(root, file), path.join(dist, file));
  } catch {}
}

await fs.writeFile(
  path.join(dist, "_headers"),
  ["/index.html", "  Cache-Control: no-cache, must-revalidate", ""].join("\n"),
  "utf8",
);

console.log("Cloudflare Pages build ready in dist/");
