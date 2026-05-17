const DB_KEY = "db";
const GETGEMS_COLLECTION_ADDRESS = "EQCT_uQvCCD4AZNtSLY0VwwPrDvw48bOiixCaWJ7czA0sgFk";
const GETGEMS_PUBLIC_API_BASE = "https://api.getgems.io/public-api";
const GETGEMS_TIMEOUT_MS = 6500;

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

function getProcessEnvValue(name) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function getEnvValue(env, name) {
  return env?.[name] ?? getProcessEnvValue(name);
}

function getGetgemsAuthHeaders(env) {
  const apiKey = getEnvValue(env, "GETGEMS_API_KEY");
  if (!apiKey) return null;
  return { authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}` };
}

function attributeValueFloorTon(value) {
  return asNumber(value?.minPrice) ?? (asNumber(value?.minPriceNano) != null ? asNumber(value.minPriceNano) / 1e9 : null);
}

function mythicFloorFromAttributes(attributes) {
  let floorTon = null;
  for (const attribute of Array.isArray(attributes) ? attributes : []) {
    for (const value of Array.isArray(attribute?.values) ? attribute.values : []) {
      if (!/mythic/i.test(String(value?.value || ""))) continue;
      const candidate = attributeValueFloorTon(value);
      if (candidate == null) continue;
      floorTon = floorTon == null ? candidate : Math.min(floorTon, candidate);
    }
  }
  return floorTon;
}

async function getMythicFloor(collectionAddress, env) {
  const configuredFloor = asNumber(getEnvValue(env, "GETGEMS_MYTHIC_FP_TON"));
  if (configuredFloor != null) return { floorTon: configuredFloor, source: "configured" };

  const authHeaders = getGetgemsAuthHeaders(env);
  if (!authHeaders) {
    return { floorTon: null, unavailableReason: "Getgems attributes API requires authorization" };
  }

  try {
    const attributes = await fetchJsonWithTimeout(
      `${GETGEMS_PUBLIC_API_BASE}/v1/collection/attributes/${encodeURIComponent(collectionAddress)}`,
      GETGEMS_TIMEOUT_MS,
      authHeaders
    );
    const floorTon = mythicFloorFromAttributes(attributes?.response?.attributes);
    return floorTon == null
      ? { floorTon: null, unavailableReason: "Mythic attribute floor not found" }
      : { floorTon, source: "attributes" };
  } catch (err) {
    return { floorTon: null, unavailableReason: err.message || "Getgems attributes unavailable" };
  }
}

async function getGetgemsCollectionMarket(address = GETGEMS_COLLECTION_ADDRESS, env = {}) {
  const collectionAddress = address === GETGEMS_COLLECTION_ADDRESS ? address : GETGEMS_COLLECTION_ADDRESS;
  const payload = {
    collection: {
      address: collectionAddress,
      url: `https://getgems.io/collection/${collectionAddress}`,
      imageUrl: null,
      floorTon: null,
    },
    mythicFloor: { floorTon: null, unavailableReason: "Loading" },
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
    payload.collection.url = info.getgems_url || payload.collection.url;
  } catch (err) {
    payload.collection.unavailableReason = err.message || "Getgems unavailable";
  }

  payload.mythicFloor = await getMythicFloor(collectionAddress, env);

  return payload;
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
    if (path === "/api/market/getgems-collection" && method === "GET") {
      return json(await getGetgemsCollectionMarket(url.searchParams.get("address"), env));
    }

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
        power: sanitizePowerText(body.power),
        videoUrl: sanitizeUrl(body.videoUrl),
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
