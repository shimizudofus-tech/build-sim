const DB_KEY = "db";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

function publicBuild(build) {
  const { ownerKey, ...safe } = build;
  return safe;
}

async function readDb(env) {
  if (!env.BUILDER_KV) {
    throw new Error("Missing Cloudflare KV binding: BUILDER_KV");
  }
  const db = (await env.BUILDER_KV.get(DB_KEY, "json")) || {};
  return {
    visits: Number(db.visits) || 0,
    builds: Array.isArray(db.builds) ? db.builds : [],
  };
}

async function writeDb(env, db) {
  await env.BUILDER_KV.put(DB_KEY, JSON.stringify(db));
}

function randomId() {
  const suffix =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(36)}-${suffix}`;
}

async function readBody(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") return json({}, 204);

  try {
    if (path === "/api/visits" && method === "POST") {
      const db = await readDb(env);
      db.visits += 1;
      await writeDb(env, db);
      return json({ visits: db.visits });
    }

    if (path === "/api/community-builds" && method === "GET") {
      const db = await readDb(env);
      return json({ builds: db.builds.map(publicBuild) });
    }

    if (path === "/api/community-builds" && method === "POST") {
      const body = await readBody(request);
      const db = await readDb(env);
      const build = {
        id: randomId(),
        title: sanitizeText(body.title, 48) || "Anonymous build",
        author: sanitizeText(body.author, 32) || "Anonymous",
        ownerKey: sanitizeText(body.ownerKey, 120),
        character: sanitizeText(body.character, 24),
        mode: sanitizeText(body.mode, 24),
        targetValue: sanitizeNumber(body.targetValue),
        targetLabel: sanitizeText(body.targetLabel, 64),
        power: sanitizeNumber(body.power),
        votes: 0,
        createdAt: Date.now(),
        state: body.state || {},
      };
      db.builds.push(build);
      await writeDb(env, db);
      return json({ build: publicBuild(build) }, 201);
    }

    const voteMatch = path.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
    if (voteMatch && method === "POST") {
      const db = await readDb(env);
      const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
      if (!build) return json({ error: "Build not found" }, 404);
      build.votes = (Number(build.votes) || 0) + 1;
      await writeDb(env, db);
      return json({ build: publicBuild(build) });
    }

    const deleteMatch = path.match(/^\/api\/community-builds\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const body = await readBody(request);
      const db = await readDb(env);
      const id = decodeURIComponent(deleteMatch[1]);
      const build = db.builds.find((b) => b.id === id);
      if (!build) return json({ error: "Build not found" }, 404);
      if (!build.ownerKey || build.ownerKey !== sanitizeText(body.ownerKey, 120)) {
        return json({ error: "Only the author can delete this build" }, 403);
      }
      db.builds = db.builds.filter((b) => b.id !== id);
      await writeDb(env, db);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err.message || "Server error" }, 500);
  }
}
