import crypto from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";

const DB_KEY = "db";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
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

function publicBuild(build) {
  const { ownerKey, ...safe } = build;
  return safe;
}

function apiPath(event) {
  const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path || "/";
  if (rawPath.startsWith("/api/")) return rawPath;
  return rawPath.replace(/^\/\.netlify\/functions\/api/, "/api");
}

async function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

async function readDb(store) {
  const db = (await store.get(DB_KEY, { type: "json" })) || {};
  return {
    visits: Number(db.visits) || 0,
    builds: Array.isArray(db.builds) ? db.builds : [],
  };
}

async function writeDb(store, db) {
  await store.setJSON(DB_KEY, db);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(204, {});

  connectLambda(event);
  const store = getStore("builder-global-data");
  const path = apiPath(event);

  try {
    if (path === "/api/visits" && event.httpMethod === "POST") {
      const db = await readDb(store);
      db.visits += 1;
      await writeDb(store, db);
      return json(200, { visits: db.visits });
    }

    if (path === "/api/community-builds" && event.httpMethod === "GET") {
      const db = await readDb(store);
      return json(200, { builds: db.builds.map(publicBuild) });
    }

    if (path === "/api/community-builds" && event.httpMethod === "POST") {
      const body = await readBody(event);
      const db = await readDb(store);
      const build = {
        id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
        title: sanitizeText(body.title, 48) || "Anonymous build",
        author: sanitizeText(body.author, 32) || "Anonymous",
        ownerKey: sanitizeText(body.ownerKey, 120),
        character: sanitizeText(body.character, 24),
        mode: sanitizeText(body.mode, 24),
        targetValue: sanitizeNumber(body.targetValue),
        targetLabel: sanitizeText(body.targetLabel, 64),
        power: sanitizeNumber(body.power),
        videoUrl: sanitizeUrl(body.videoUrl),
        votes: 0,
        createdAt: Date.now(),
        state: body.state || {},
      };
      db.builds.push(build);
      await writeDb(store, db);
      return json(201, { build: publicBuild(build) });
    }

    const voteMatch = path.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
    if (voteMatch && event.httpMethod === "POST") {
      const db = await readDb(store);
      const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
      if (!build) return json(404, { error: "Build not found" });
      build.votes = (Number(build.votes) || 0) + 1;
      await writeDb(store, db);
      return json(200, { build: publicBuild(build) });
    }

    const deleteMatch = path.match(/^\/api\/community-builds\/([^/]+)$/);
    if (deleteMatch && event.httpMethod === "DELETE") {
      const body = await readBody(event);
      const db = await readDb(store);
      const id = decodeURIComponent(deleteMatch[1]);
      const build = db.builds.find((b) => b.id === id);
      if (!build) return json(404, { error: "Build not found" });
      if (!build.ownerKey || build.ownerKey !== sanitizeText(body.ownerKey, 120)) {
        return json(403, { error: "Only the author can delete this build" });
      }
      db.builds = db.builds.filter((b) => b.id !== id);
      await writeDb(store, db);
      return json(200, { ok: true });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    return json(500, { error: err.message || "Server error" });
  }
}
