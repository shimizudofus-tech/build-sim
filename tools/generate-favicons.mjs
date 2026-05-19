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

/** Tighter = more face on source crop before 512 resize */
const ZOOM = 1.38;

/**
 * Planche paysage : centre du gros disque (chat) — décalé bas-droite de la zone utile.
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
  // Centre visuel du gros favicon (légèrement bas-droite sur la planche type 1024×682)
  const cx = w * 0.255;
  const cy = h * 0.355;
  let side = Math.floor(Math.min(w * 0.37, h * 0.5));
  side = Math.max(120, Math.min(side, w, h));
  let left = Math.floor(cx - side / 2);
  let top = Math.floor(cy - side / 2);
  left = Math.max(0, Math.min(left, w - side));
  top = Math.max(0, Math.min(top, h - side));
  return { left, top, width: side, height: side };
}

/**
 * Recadre les bords quasi unis (violet), puis agrandit le sujet pour qu'il remplisse
 * presque tout le 512×512 (avant ça on ne faisait que réduire : min(scale,1) → tache minuscule en 16×16).
 */
async function centerSubjectOn512(pngBuf) {
  let trimmed;
  try {
    trimmed = await sharp(pngBuf).trim({ threshold: 24 }).png().toBuffer();
  } catch {
    return pngBuf;
  }
  const m = await sharp(trimmed).metadata();
  const tw = m.width || 0;
  const th = m.height || 0;
  if (!tw || !th) return pngBuf;

  const target = Math.floor(512 * 0.92);
  const raw = Math.min(target / tw, target / th);
  const scale = Math.min(8, raw);
  const nw = Math.max(1, Math.round(tw * scale));
  const nh = Math.max(1, Math.round(th * scale));
  const scaled = await sharp(trimmed)
    .resize(nw, nh, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const sm = await sharp(scaled).metadata();
  const fw = sm.width || nw;
  const fh = sm.height || nh;
  if (fw > 512 || fh > 512) return pngBuf;
  const left = Math.floor((512 - fw) / 2);
  const top = Math.floor((512 - fh) / 2);
  return sharp({
    create: { width: 512, height: 512, channels: 3, background: PURPLE },
  })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();
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

  let master512 = await pipeline
    .resize(512, 512, { fit: "cover" })
    .flatten({ background: PURPLE })
    .png()
    .toBuffer();

  master512 = await centerSubjectOn512(master512);

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

  const stamp = Date.now().toString();
  const indexPath = path.join(root, "index.html");
  let indexHtml = await fs.promises.readFile(indexPath, "utf8");
  indexHtml = indexHtml.replace(
    /(\.\/assets\/favicon\/(?:favicon\.ico|favicon-16x16\.png|favicon-32x32\.png|apple-touch-icon\.png))(?:\?[^"'\s]*)?/g,
    `$1?v=${stamp}`,
  );
  await fs.promises.writeFile(indexPath, indexHtml);

  const distRoot = path.join(root, "dist");
  const distFav = path.join(distRoot, "assets", "favicon");
  if (fs.existsSync(distRoot)) {
    await fs.promises.mkdir(distFav, { recursive: true });
    for (const f of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png"]) {
      await fs.promises.copyFile(path.join(outDir, f), path.join(distFav, f));
    }
    const distIndex = path.join(distRoot, "index.html");
    await fs.promises.writeFile(distIndex, indexHtml);
  }

  console.log("Wrote favicons to assets/favicon/ (and dist/ if present); index link ?v=", stamp);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
