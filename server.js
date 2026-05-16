const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT || 8765);

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

function sanitizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function handleApi(req, res, url) {
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
