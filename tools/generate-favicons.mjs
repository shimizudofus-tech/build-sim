/**
 * Builds Spekter Agency favicons from assets/favicon/source.png
 * Run: node tools/generate-favicons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "assets", "favicon", "source.png");
const outDir = path.join(root, "assets", "favicon");

const PURPLE = { r: 124, g: 79, b: 196 }; // ~ #7c4fc4
const BORDER = "#f0e8ff";

/** Tighter = more face; 1.08–1.18 typical */
const ZOOM = 1.12;

/**
 * Planche paysage (favicons + apple) : centre du gros cercle haut-gauche.
 * Image seule ~carrée : crop central.
 */
function initialSquareCrop(w, h) {
  const ratio = w / h;
  if (ratio < 1.25) {
    const side = Math.floor(Math.min(w, h) * 0.92);
    const left = Math.floor((w - side) / 2);
    const top = Math.floor((h - side) / 2);
    return { left, top, width: side, height: side };
  }
  const cx = w * 0.195;
  const cy = h * 0.29;
  let side = Math.floor(Math.min(w * 0.33, h * 0.46));
  side = Math.max(120, Math.min(side, w, h));
  let left = Math.floor(cx - side / 2);
  let top = Math.floor(cy - side / 2);
  left = Math.max(0, Math.min(left, w - side));
  top = Math.max(0, Math.min(top, h - side));
  return { left, top, width: side, height: side };
}

async function squareWithBorder(buf, size, borderPx) {
  const inner = size - 2 * borderPx;
  return sharp(buf)
    .resize(inner, inner, { fit: "cover" })
    .extend({
      top: borderPx,
      bottom: borderPx,
      left: borderPx,
      right: borderPx,
      background: BORDER,
    })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(src)) {
    console.error("Missing", src);
    process.exit(1);
  }

  const meta = await sharp(src).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) throw new Error("Could not read source dimensions");

  const crop = initialSquareCrop(w, h);
  const side = crop.width;

  let pipeline = sharp(src).extract(crop);

  // Zoom in on center (~20%)
  const inner = Math.max(32, Math.floor(side / ZOOM));
  const ox = Math.floor((side - inner) / 2);
  const oy = Math.floor((side - inner) / 2);
  pipeline = pipeline.extract({ left: ox, top: oy, width: inner, height: inner });

  const master512 = await pipeline
    .resize(512, 512, { fit: "cover" })
    .flatten({ background: PURPLE })
    .png()
    .toBuffer();

  const border180 = 6;
  const border32 = 2;
  const border16 = 1;

  const apple180 = await squareWithBorder(master512, 180, border180);
  const png32 = await squareWithBorder(master512, 32, border32);
  const png16 = await squareWithBorder(master512, 16, border16);

  fs.mkdirSync(outDir, { recursive: true });
  await fs.promises.writeFile(path.join(outDir, "apple-touch-icon.png"), apple180);
  await fs.promises.writeFile(path.join(outDir, "favicon-32x32.png"), png32);
  await fs.promises.writeFile(path.join(outDir, "favicon-16x16.png"), png16);

  const icoBuf = await pngToIco([png16, png32]);
  await fs.promises.writeFile(path.join(outDir, "favicon.ico"), icoBuf);

  console.log("Wrote favicons to assets/favicon/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
