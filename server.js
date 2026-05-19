const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const TEST_MODE = process.env.BUILDER_TEST_MODE === "1";
const DB_FILE = process.env.BUILDER_DB_FILE
  ? path.resolve(process.env.BUILDER_DB_FILE)
  : path.join(DATA_DIR, TEST_MODE ? "db.test.json" : "db.json");
const PORT = Number(process.env.PORT || 8765);
const TEST_USER_ID = "test:local";
const SESSION_COOKIE = "builder_session";
const OAUTH_STATE_COOKIE = "builder_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AVATAR_MAX_BYTES = 1024 * 1024;
const GETGEMS_COLLECTION_ADDRESS = "EQCT_uQvCCD4AZNtSLY0VwwPrDvw48bOiixCaWJ7czA0sgFk";
const GETGEMS_PUBLIC_API_BASE = "https://api.getgems.io/public-api";
const GETGEMS_TIMEOUT_MS = 6500;
const COMMUNITY_STRATEGY_NOTES_MAX = 360;
const COMMUNITY_DIFFICULTIES = new Set(["", "very_easy", "easy", "medium", "hard", "very_hard"]);
const CHAT_MESSAGE_MAX = 240;
const CHAT_RETENTION_LIMIT = 200;
const {
  ensureUserProgress,
  publicPlayerProgress,
  grantXp,
  spendEnergy,
  normalizeStoredProgress,
} = require("./lib/player-progress.cjs");
const {
  ensureLinkedIds,
  resolveAuthUser,
  linkProviderAccount,
  publicUserLinks,
} = require("./lib/auth-accounts.cjs");

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
    fs.writeFileSync(DB_FILE, JSON.stringify({ visits: 0, builds: [], users: {} }, null, 2));
  }
}

function normalizeUsers(users) {
  if (Array.isArray(users)) return Object.fromEntries(users.filter((u) => u?.id).map((u) => [u.id, u]));
  return users && typeof users === "object" ? users : {};
}

function readDb() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      visits: Number(parsed.visits) || 0,
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
      users: normalizeUsers(parsed.users),
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages.slice(-CHAT_RETENTION_LIMIT) : [],
    };
  } catch {
    return { visits: 0, builds: [], users: {}, chatMessages: [] };
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function defaultTestProgress() {
  return normalizeStoredProgress({
    totalXp: 0,
    energy: 30,
    energyCap: 30,
    energyUpdatedAt: Date.now(),
  });
}

function seedTestDatabase() {
  if (!TEST_MODE) return;
  const db = readDb();
  const existing = db.users[TEST_USER_ID];
  const user = upsertUser(db, {
    id: TEST_USER_ID,
    provider: "test",
    displayName: existing?.displayName || "Test Player",
    avatarUrl: existing?.avatarUrl || "",
  });
  if (!existing?.progress) {
    user.progress = defaultTestProgress();
    db.users[TEST_USER_ID] = user;
    writeDb(db);
  }
}

function sendJson(res, status, body, headers = {}) {
  if (res.headersSent) return true;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_500_000) {
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
  const { ownerKey, voteKeys, voterKeys, voters, ...safe } = build;
  return safe;
}

function publicChatMessage(message) {
  return {
    id: message.id,
    text: message.text,
    userId: message.userId,
    displayName: message.displayName,
    avatarUrl: message.avatarUrl || "",
    createdAt: Number(message.createdAt) || Date.now(),
  };
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function hmac(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq === -1 ? [part, ""] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  );
}

function secureCookie(req) {
  const proto = req.headers["x-forwarded-proto"] || "";
  return proto === "https" || String(process.env.PUBLIC_SITE_URL || "").startsWith("https://");
}

function cookieHeader(name, value, req, maxAge = SESSION_MAX_AGE_SECONDS, httpOnly = true) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    httpOnly ? "HttpOnly" : "",
    secureCookie(req) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookieHeader(name, req) {
  return cookieHeader(name, "", req, 0);
}

function signEnvelope(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded, secret)}`;
}

function verifyEnvelope(value, secret) {
  if (!value || !secret) return null;
  const [encoded, sig] = String(value).split(".");
  if (!encoded || !sig) return null;
  const expected = hmac(encoded, secret);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    provider: user.provider,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || "",
    customAvatarUrl: user.customAvatarUrl || "",
    links: publicUserLinks(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function telegramBotUsername() {
  return String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
}

function providerStatus() {
  const botUsername = telegramBotUsername();
  return {
    discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && botUsername),
    telegramBotUsername: botUsername,
  };
}

function siteOrigin(req) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}

function sessionUser(req, db) {
  const secret = process.env.SESSION_SECRET;
  const session = verifyEnvelope(parseCookies(req)[SESSION_COOKIE], secret);
  return session?.uid ? db.users[session.uid] || null : null;
}

function requireUser(req, db, res) {
  const user = sessionUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: "Sign in required." });
    return null;
  }
  return user;
}

function upsertUser(db, profile) {
  const existing = db.users[profile.id] || {};
  const now = Date.now();
  const user = {
    ...existing,
    ...profile,
    customAvatarUrl: existing.customAvatarUrl || profile.customAvatarUrl || "",
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  ensureUserProgress(user);
  ensureLinkedIds(user);
  db.users[user.id] = user;
  return user;
}

async function exchangeOAuthCode(provider, code, redirectUri) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || `${provider} token exchange failed`);
  return data.access_token;
}

async function fetchOAuthProfile(provider, accessToken) {
  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.message || `${provider} profile fetch failed`);
  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128`
    : "";
  return { id: `discord:${data.id}`, provider, displayName: data.global_name || data.username || "Discord user", avatarUrl };
}

function validateTelegramPayload(payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram login is not configured.");
  const { hash, ...rest } = payload || {};
  if (!hash) throw new Error("Missing Telegram hash.");
  const dataCheckString = Object.keys(rest)
    .filter((key) => rest[key] !== undefined && rest[key] !== null && rest[key] !== "")
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const hashBuf = Buffer.from(String(hash));
  const expectedBuf = Buffer.from(expected);
  if (hashBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hashBuf, expectedBuf)) {
    throw new Error("Invalid Telegram login.");
  }
  const authDate = Number(rest.auth_date) || 0;
  if (!authDate || Date.now() / 1000 - authDate > 86400) throw new Error("Telegram login expired.");
  return {
    id: `telegram:${rest.id}`,
    provider: "telegram",
    displayName: [rest.first_name, rest.last_name].filter(Boolean).join(" ") || rest.username || "Telegram user",
    avatarUrl: rest.photo_url || "",
  };
}

function validateAvatarDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp);base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Avatar must be a PNG, JPG, or WebP image.");
  const ext = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > AVATAR_MAX_BYTES) throw new Error("Avatar must be 1 MB or smaller.");
  return `data:image/${ext};base64,${bytes.toString("base64")}`;
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

function sanitizeChatText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MESSAGE_MAX);
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function sanitizeVoterKey(value) {
  return sanitizeText(value, 160);
}

function requestVoteKey(req, body) {
  const explicitKey = sanitizeVoterKey(body?.voterKey);
  if (explicitKey) return `voter:${hashText(explicitKey)}`;
  const fallback = [
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
    req.headers["user-agent"] || "",
  ].join("|");
  return fallback.trim() ? `fallback:${hashText(fallback)}` : "";
}

function buildVoteKeys(build) {
  const keys = Array.isArray(build.voteKeys)
    ? build.voteKeys
    : Array.isArray(build.voterKeys)
      ? build.voterKeys
      : Array.isArray(build.voters)
        ? build.voters
        : [];
  build.voteKeys = keys.map(sanitizeVoterKey).filter(Boolean);
  delete build.voterKeys;
  delete build.voters;
  return build.voteKeys;
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

function sanitizeStrategyNotes(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, COMMUNITY_STRATEGY_NOTES_MAX);
}

function sanitizeCommunityDifficulty(value) {
  const raw = String(value ?? "").trim();
  return COMMUNITY_DIFFICULTIES.has(raw) ? raw : "";
}

const DIRECT_DISCORD_VIDEO_HOSTS = new Set([
  "cdn.discordapp.com",
  "media.discordapp.net",
  "attachments.discordapp.net",
]);
const DISCORD_LINK_HOSTS = new Set([
  "discord.com",
  "discord.gg",
  "discordapp.com",
]);
const DIRECT_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const X_LINK_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com"]);

function normalizedVideoHost(url) {
  return url.hostname.replace(/^www\./i, "").toLowerCase();
}

function isDirectDiscordVideoUrl(url, host) {
  if (!DIRECT_DISCORD_VIDEO_HOSTS.has(host)) return false;
  const path = url.pathname.toLowerCase();
  return Array.from(DIRECT_VIDEO_EXTENSIONS).some((ext) => path.endsWith(ext));
}

function isAllowedCommunityVideoUrl(url) {
  const host = normalizedVideoHost(url);
  return (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    DISCORD_LINK_HOSTS.has(host) ||
    isDirectDiscordVideoUrl(url, host) ||
    X_LINK_HOSTS.has(host)
  );
}

function sanitizeCommunityVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!isAllowedCommunityVideoUrl(url)) return null;
    url.hash = "";
    return url.href.slice(0, 240);
  } catch {
    return null;
  }
}

async function handleTestApi(req, res, url) {
  if (!TEST_MODE) return false;

  if (url.pathname === "/api/test/info" && req.method === "GET") {
    return sendJson(res, 200, {
      testMode: true,
      dbFile: path.relative(ROOT, DB_FILE),
      testUserId: TEST_USER_ID,
      endpoints: [
        "POST /api/auth/test-login",
        "GET /api/profile/progress",
        "POST /api/profile/progress/xp",
        "POST /api/test/progress/reset",
        "POST /api/test/spend-energy",
      ],
    });
  }

  if (url.pathname === "/api/auth/test-login" && req.method === "POST") {
    if (!process.env.SESSION_SECRET) {
      return sendJson(res, 503, { error: "SESSION_SECRET is required (set in .env.test or by test-server)." });
    }
    const body = await readBody(req);
    const db = readDb();
    const user = upsertUser(db, {
      id: TEST_USER_ID,
      provider: "test",
      displayName: sanitizeText(body.displayName, 32) || "Test Player",
      avatarUrl: "",
    });
    user.progress = defaultTestProgress();
    db.users[user.id] = user;
    writeDb(db);
    const session = signEnvelope(
      { uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 },
      process.env.SESSION_SECRET
    );
    return sendJson(
      res,
      200,
      { user: publicUser(user), progress: publicPlayerProgress(user.progress) },
      { "set-cookie": cookieHeader(SESSION_COOKIE, session, req) }
    );
  }

  if (url.pathname === "/api/test/progress/reset" && req.method === "POST") {
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return true;
    user.progress = defaultTestProgress();
    user.updatedAt = Date.now();
    db.users[user.id] = user;
    writeDb(db);
    return sendJson(res, 200, { progress: publicPlayerProgress(user.progress) });
  }

  if (url.pathname === "/api/test/spend-energy" && req.method === "POST") {
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return true;
    const body = await readBody(req);
    ensureUserProgress(user);
    const result = spendEnergy(user.progress, body.cost);
    if (!result.ok) return sendJson(res, 400, { error: result.error, progress: publicPlayerProgress(result.progress) });
    user.progress = result.progress;
    user.updatedAt = Date.now();
    db.users[user.id] = user;
    writeDb(db);
    return sendJson(res, 200, { spent: result.spent, progress: publicPlayerProgress(user.progress) });
  }

  return false;
}

async function handleApi(req, res, url) {
  if (await handleTestApi(req, res, url)) return;

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const db = readDb();
    return sendJson(res, 200, { user: publicUser(sessionUser(req, db)), providers: providerStatus() });
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    return sendJson(res, 200, { ok: true }, { "set-cookie": clearCookieHeader(SESSION_COOKIE, req) });
  }

  const loginMatch = url.pathname.match(/^\/api\/auth\/login\/(discord|telegram)$/);
  if (loginMatch && req.method === "GET") {
    const provider = loginMatch[1];
    const providers = providerStatus();
    if (provider === "telegram") {
      return sendJson(res, 501, {
        error: "Use the Telegram Login button in the site UI (Sign in menu).",
        providers,
      });
    }
    if (!process.env.SESSION_SECRET) return sendJson(res, 503, { error: "SESSION_SECRET is required for login.", providers });
    if (!providers[provider]) return sendJson(res, 503, { error: `${provider} login is not configured.`, providers });
    const origin = siteOrigin(req);
    const redirectUri = `${origin}/api/auth/callback/${provider}`;
    const state = signEnvelope(
      { provider, nonce: crypto.randomBytes(16).toString("hex"), exp: Date.now() + 10 * 60 * 1000 },
      process.env.SESSION_SECRET
    );
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "identify");
    authUrl.searchParams.set("state", state);
    res.writeHead(302, {
      location: authUrl.href,
      "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, req, 10 * 60),
      "cache-control": "no-store",
    });
    return res.end();
  }

  const callbackMatch = url.pathname.match(/^\/api\/auth\/callback\/(discord)$/);
  if (callbackMatch && req.method === "GET") {
    const provider = callbackMatch[1];
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = parseCookies(req);
    const statePayload = verifyEnvelope(state, process.env.SESSION_SECRET);
    if (!code || !statePayload || statePayload.provider !== provider || cookies[OAUTH_STATE_COOKIE] !== state) {
      return sendJson(res, 400, { error: "Invalid OAuth callback." });
    }
    const db = readDb();
    const redirectUri = `${siteOrigin(req)}/api/auth/callback/${provider}`;
    const accessToken = await exchangeOAuthCode(provider, code, redirectUri);
    const profile = await fetchOAuthProfile(provider, accessToken);
    const user = statePayload.mode === "link"
      ? (() => {
          const primary = db.users[statePayload.uid];
          if (!primary) throw new Error("Link session expired. Sign in again.");
          linkProviderAccount(db, primary, profile);
          return primary;
        })()
      : resolveAuthUser(db, profile, upsertUser);
    writeDb(db);
    const session = signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, process.env.SESSION_SECRET);
    const linkQuery = statePayload.mode === "link" ? "?linked=discord" : "";
    res.writeHead(302, {
      location: `${siteOrigin(req)}/${linkQuery}`,
      "set-cookie": [
        cookieHeader(SESSION_COOKIE, session, req),
        clearCookieHeader(OAUTH_STATE_COOKIE, req),
      ],
      "cache-control": "no-store",
    });
    return res.end();
  }

  if (url.pathname === "/api/auth/telegram" && req.method === "POST") {
    if (!process.env.SESSION_SECRET) return sendJson(res, 503, { error: "SESSION_SECRET is required for login." });
    const body = await readBody(req);
    const profile = validateTelegramPayload(body);
    const db = readDb();
    const user = resolveAuthUser(db, profile, upsertUser);
    writeDb(db);
    const session = signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, process.env.SESSION_SECRET);
    return sendJson(res, 200, { user: publicUser(user) }, { "set-cookie": cookieHeader(SESSION_COOKIE, session, req) });
  }

  if (url.pathname === "/api/auth/link/telegram" && req.method === "POST") {
    if (!process.env.SESSION_SECRET) return sendJson(res, 503, { error: "SESSION_SECRET is required." });
    const db = readDb();
    const primary = requireUser(req, db, res);
    if (!primary) return;
    try {
      const body = await readBody(req);
      const profile = validateTelegramPayload(body);
      linkProviderAccount(db, primary, profile);
      writeDb(db);
      return sendJson(res, 200, { user: publicUser(primary), linked: "telegram" });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || "Telegram link failed." });
    }
  }

  if (url.pathname === "/api/auth/link/discord" && req.method === "GET") {
    const providers = providerStatus();
    if (!process.env.SESSION_SECRET) return sendJson(res, 503, { error: "SESSION_SECRET is required.", providers });
    if (!providers.discord) return sendJson(res, 503, { error: "Discord login is not configured.", providers });
    const db = readDb();
    const primary = sessionUser(req, db);
    if (!primary) return sendJson(res, 401, { error: "Sign in required to link Discord." });
    const origin = siteOrigin(req);
    const redirectUri = `${origin}/api/auth/callback/discord`;
    const state = signEnvelope(
      {
        provider: "discord",
        mode: "link",
        uid: primary.id,
        nonce: crypto.randomBytes(16).toString("hex"),
        exp: Date.now() + 10 * 60 * 1000,
      },
      process.env.SESSION_SECRET
    );
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "identify");
    authUrl.searchParams.set("state", state);
    res.writeHead(302, {
      location: authUrl.href,
      "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, req, 10 * 60),
      "cache-control": "no-store",
    });
    return res.end();
  }

  if (url.pathname === "/api/profile/avatar" && req.method === "POST") {
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    const body = await readBody(req);
    user.customAvatarUrl = validateAvatarDataUrl(body.dataUrl);
    user.updatedAt = Date.now();
    db.users[user.id] = user;
    writeDb(db);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (url.pathname === "/api/profile/progress" && req.method === "GET") {
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    ensureUserProgress(user);
    return sendJson(res, 200, { progress: publicPlayerProgress(user.progress), persisted: true });
  }

  if (url.pathname === "/api/profile/progress/xp" && req.method === "POST") {
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    const body = await readBody(req);
    const source = String(body.source || "").slice(0, 32);
    if (!["minigame", "test"].includes(source)) {
      return sendJson(res, 400, { error: "Invalid XP source." });
    }
    const result = grantXp(user.progress, body.amount);
    user.progress = result.progress;
    user.updatedAt = Date.now();
    db.users[user.id] = user;
    writeDb(db);
    return sendJson(res, 200, {
      progress: result.after,
      grant: result.grant,
      leveledUp: result.leveledUp,
      levelsGained: result.levelsGained,
    });
  }

  if (url.pathname === "/api/market/getgems-collection" && req.method === "GET") {
    return sendJson(res, 200, await getGetgemsCollectionMarket(url.searchParams.get("address")));
  }

  if (url.pathname === "/api/visits" && req.method === "POST") {
    const db = readDb();
    db.visits += 1;
    writeDb(db);
    return sendJson(res, 200, { visits: db.visits });
  }

  if (url.pathname === "/api/chat/messages" && req.method === "GET") {
    const db = readDb();
    return sendJson(res, 200, { messages: db.chatMessages.map(publicChatMessage) });
  }

  if (url.pathname === "/api/chat/messages" && req.method === "POST") {
    const body = await readBody(req);
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    const text = sanitizeChatText(body.text);
    if (!text) return sendJson(res, 400, { error: "Message is required." });
    const message = {
      id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
      text,
      userId: user.id,
      displayName: sanitizeText(user.displayName, 48) || "Community member",
      avatarUrl: user.customAvatarUrl || user.avatarUrl || "",
      createdAt: Date.now(),
    };
    db.chatMessages = [...db.chatMessages, message].slice(-CHAT_RETENTION_LIMIT);
    writeDb(db);
    return sendJson(res, 201, { message: publicChatMessage(message), messages: db.chatMessages.map(publicChatMessage) });
  }

  if (url.pathname === "/api/community-builds" && req.method === "GET") {
    const db = readDb();
    return sendJson(res, 200, { builds: db.builds.map(publicBuild) });
  }

  if (url.pathname === "/api/community-builds" && req.method === "POST") {
    const body = await readBody(req);
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    const videoUrl = sanitizeCommunityVideoUrl(body.videoUrl);
    if (videoUrl === null) {
      return sendJson(res, 400, { error: "Video link must be YouTube, X/Twitter, or Discord." });
    }
    const build = {
      id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
      title: sanitizeText(body.title, 48) || "Anonymous build",
      author: sanitizeText(body.author, 32) || sanitizeText(user.displayName, 32) || "Anonymous",
      userId: user.id,
      authorProfile: publicUser(user),
      ownerKey: sanitizeText(body.ownerKey, 120),
      character: sanitizeText(body.character, 24),
      mode: sanitizeText(body.mode, 24),
      targetValue: sanitizeNumber(body.targetValue),
      targetLabel: sanitizeText(body.targetLabel, 64),
      power: sanitizePowerText(body.power),
      difficulty: sanitizeCommunityDifficulty(body.difficulty),
      videoUrl,
      strategyNotes: sanitizeStrategyNotes(body.strategyNotes),
      votes: 0,
      voteKeys: [],
      createdAt: Date.now(),
      state: body.state || {},
    };
    db.builds.push(build);
    writeDb(db);
    return sendJson(res, 201, { build: publicBuild(build) });
  }

  const voteMatch = url.pathname.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
  if (voteMatch && req.method === "POST") {
    const body = await readBody(req);
    const db = readDb();
    const user = requireUser(req, db, res);
    if (!user) return;
    const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
    if (!build) return sendJson(res, 404, { error: "Build not found" });
    const voteKey = `user:${user.id}`;
    if (!voteKey) return sendJson(res, 400, { error: "Voter key is required" });
    const voteKeys = buildVoteKeys(build);
    if (voteKeys.includes(voteKey)) {
      return sendJson(res, 409, {
        error: "You already voted for this build.",
        duplicate: true,
        build: publicBuild(build),
      });
    }
    voteKeys.push(voteKey);
    build.votes = (Number(build.votes) || 0) + 1;
    writeDb(db);
    return sendJson(res, 200, { build: publicBuild(build) });
  }

  const deleteMatch = url.pathname.match(/^\/api\/community-builds\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    const body = await readBody(req);
    const db = readDb();
    const user = sessionUser(req, db);
    const id = decodeURIComponent(deleteMatch[1]);
    const build = db.builds.find((b) => b.id === id);
    if (!build) return sendJson(res, 404, { error: "Build not found" });
    const ownerKeyMatches = build.ownerKey && build.ownerKey === sanitizeText(body.ownerKey, 120);
    if (!user && !ownerKeyMatches) return sendJson(res, 401, { error: "Sign in required." });
    if (build.userId ? build.userId !== user?.id : !ownerKeyMatches) {
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
    if (!res.headersSent) return sendJson(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(PORT, () => {
  ensureDb();
  if (TEST_MODE) seedTestDatabase();
  console.log(`BUILDER server: http://localhost:${PORT}/`);
  if (TEST_MODE) {
    console.log(`TEST MODE — db: ${path.relative(ROOT, DB_FILE)}`);
    console.log(`  Site:  http://localhost:${PORT}/`);
    console.log(`  Panel: http://localhost:${PORT}/test/`);
    console.log(`  Login: POST http://localhost:${PORT}/api/auth/test-login`);
  }
});
