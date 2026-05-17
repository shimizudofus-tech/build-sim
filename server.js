const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT || 8765);
const GETGEMS_COLLECTION_ADDRESS = "EQCT_uQvCCD4AZNtSLY0VwwPrDvw48bOiixCaWJ7czA0sgFk";
const GETGEMS_PUBLIC_API_BASE = "https://api.getgems.io/public-api";
const GETGEMS_TIMEOUT_MS = 6500;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ visits: 0, builds: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      visits: Number(parsed.visits) || 0,
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
    };
  } catch {
    return { visits: 0, builds: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function publicBuild(build) {
  const { ownerKey, ...safe } = build;
  return safe;
}

async function fetchJsonWithTimeout(url, timeoutMs = GETGEMS_TIMEOUT_MS, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function getGetgemsCollectionMarket(address = GETGEMS_COLLECTION_ADDRESS) {
  const collectionAddress = address === GETGEMS_COLLECTION_ADDRESS ? address : GETGEMS_COLLECTION_ADDRESS;
  const payload = {
    collection: {
      address: collectionAddress,
      url: `https://getgems.io/collection/${collectionAddress}`,
      imageUrl: null,
      floorTon: null,
      supply: null,
      owners: null,
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    const basic = await fetchJsonWithTimeout(
      `${GETGEMS_PUBLIC_API_BASE}/v1/collection/basic-info/${encodeURIComponent(collectionAddress)}`
    );
    const info = basic?.response || {};
    payload.collection.name = info.name || info.slug || "Getgems collection";
    payload.collection.imageUrl = info.image_url || info.banner_image_url || null;
    payload.collection.floorTon = asNumber(info.floor);
    payload.collection.supply = asNumber(info.total_supply);
    payload.collection.owners = asNumber(info.unique_owners);
    payload.collection.url = info.getgems_url || payload.collection.url;
  } catch (err) {
    payload.collection.unavailableReason = err.message || "Getgems unavailable";
  }

  return payload;
}

function sanitizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
}

function sanitizePowerText(value) {
  return String(value ?? "").trim().slice(0, 48);
}

function sanitizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    return url.href.slice(0, 240);
  } catch {
    return "";
  }
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/market/getgems-collection" && req.method === "GET") {
    return sendJson(res, 200, await getGetgemsCollectionMarket(url.searchParams.get("address")));
  }

  if (url.pathname === "/api/visits" && req.method === "POST") {
    const db = readDb();
    db.visits += 1;
    writeDb(db);
    return sendJson(res, 200, { visits: db.visits });
  }

  if (url.pathname === "/api/community-builds" && req.method === "GET") {
    const db = readDb();
    return sendJson(res, 200, { builds: db.builds.map(publicBuild) });
  }

  if (url.pathname === "/api/community-builds" && req.method === "POST") {
    const body = await readBody(req);
    const db = readDb();
    const build = {
      id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
      title: sanitizeText(body.title, 48) || "Anonymous build",
      author: sanitizeText(body.author, 32) || "Anonymous",
      ownerKey: sanitizeText(body.ownerKey, 120),
      character: sanitizeText(body.character, 24),
      mode: sanitizeText(body.mode, 24),
      targetValue: sanitizeNumber(body.targetValue),
      targetLabel: sanitizeText(body.targetLabel, 64),
      power: sanitizePowerText(body.power),
      videoUrl: sanitizeUrl(body.videoUrl),
      votes: 0,
      createdAt: Date.now(),
      state: body.state || {},
    };
    db.builds.push(build);
    writeDb(db);
    return sendJson(res, 201, { build: publicBuild(build) });
  }

  const voteMatch = url.pathname.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
  if (voteMatch && req.method === "POST") {
    const db = readDb();
    const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
    if (!build) return sendJson(res, 404, { error: "Build not found" });
    build.votes = (Number(build.votes) || 0) + 1;
    writeDb(db);
    return sendJson(res, 200, { build: publicBuild(build) });
  }

  const deleteMatch = url.pathname.match(/^\/api\/community-builds\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const body = await readBody(req);
    const db = readDb();
    const id = decodeURIComponent(deleteMatch[1]);
    const build = db.builds.find((b) => b.id === id);
    if (!build) return sendJson(res, 404, { error: "Build not found" });
    if (!build.ownerKey || build.ownerKey !== sanitizeText(body.ownerKey, 120)) {
      return sendJson(res, 403, { error: "Only the author can delete this build" });
    }
    db.builds = db.builds.filter((b) => b.id !== id);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    return sendJson(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(PORT, () => {
  ensureDb();
  console.log(`BUILDER server: http://localhost:${PORT}/`);
});
