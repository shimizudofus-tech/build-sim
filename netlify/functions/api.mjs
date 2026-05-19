import crypto from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";
import {
  ensureUserProgress,
  publicPlayerProgress,
  grantXp,
} from "../../lib/player-progress.cjs";
import {
  ensureLinkedIds,
  resolveAuthUser,
  linkProviderAccount,
  publicUserLinks,
} from "../../lib/auth-accounts.cjs";

const DB_KEY = "db";
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

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
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

function requestVoteKey(event, body) {
  const explicitKey = sanitizeVoterKey(body?.voterKey);
  if (explicitKey) return `voter:${hashText(explicitKey)}`;
  const headers = event.headers || {};
  const fallback = [
    headers["x-forwarded-for"] || headers["client-ip"] || event.requestContext?.http?.sourceIp || "",
    headers["user-agent"] || "",
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

function parseCookies(event) {
  const header = event.headers?.cookie || event.headers?.Cookie || "";
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

function secureCookie(event) {
  const proto = event.headers?.["x-forwarded-proto"] || "";
  return proto === "https" || String(process.env.PUBLIC_SITE_URL || process.env.URL || "").startsWith("https://");
}

function cookieHeader(name, value, event, maxAge = SESSION_MAX_AGE_SECONDS, httpOnly = true) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    httpOnly ? "HttpOnly" : "",
    secureCookie(event) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookieHeader(name, event) {
  return cookieHeader(name, "", event, 0);
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
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeUsers(users) {
  if (Array.isArray(users)) return Object.fromEntries(users.filter((u) => u?.id).map((u) => [u.id, u]));
  return users && typeof users === "object" ? users : {};
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

function siteOrigin(event) {
  const configured = process.env.PUBLIC_SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const rawUrl = event.rawUrl || `https://${event.headers?.host || "localhost"}${event.path || ""}`;
  return new URL(rawUrl).origin;
}

function sessionUser(event, db) {
  const session = verifyEnvelope(parseCookies(event)[SESSION_COOKIE], process.env.SESSION_SECRET);
  return session?.uid ? db.users[session.uid] || null : null;
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
  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
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
  return {
    id: `discord:${data.id}`,
    provider,
    displayName: data.global_name || data.username || "Discord user",
    avatarUrl: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` : "",
  };
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
  if (hash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
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

function apiPath(event) {
  const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path || "/";
  if (rawPath.startsWith("/api/")) return rawPath;
  return rawPath.replace(/^\/\.netlify\/functions\/api/, "/api");
}

async function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (raw.length > 1_500_000) throw new Error("Body too large");
  return JSON.parse(raw);
}

async function readDb(store) {
  const db = (await store.get(DB_KEY, { type: "json" })) || {};
  return {
    visits: Number(db.visits) || 0,
    builds: Array.isArray(db.builds) ? db.builds : [],
    users: normalizeUsers(db.users),
    chatMessages: Array.isArray(db.chatMessages) ? db.chatMessages.slice(-CHAT_RETENTION_LIMIT) : [],
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
    if (path === "/api/auth/me" && event.httpMethod === "GET") {
      const db = await readDb(store);
      return json(200, { user: publicUser(sessionUser(event, db)), providers: providerStatus() });
    }

    if (path === "/api/auth/logout" && event.httpMethod === "POST") {
      return json(200, { ok: true }, { "set-cookie": clearCookieHeader(SESSION_COOKIE, event) });
    }

    const loginMatch = path.match(/^\/api\/auth\/login\/(discord|telegram)$/);
    if (loginMatch && event.httpMethod === "GET") {
      const provider = loginMatch[1];
      const providers = providerStatus();
      if (provider === "telegram") {
        return json(501, {
          error: "Use the Telegram Login button in the site UI (Sign in menu).",
          providers,
        });
      }
      if (!process.env.SESSION_SECRET) return json(503, { error: "SESSION_SECRET is required for login.", providers });
      if (!providers[provider]) return json(503, { error: `${provider} login is not configured.`, providers });
      const origin = siteOrigin(event);
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
      return {
        statusCode: 302,
        headers: {
          location: authUrl.href,
          "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, event, 10 * 60),
          "cache-control": "no-store",
        },
        body: "",
      };
    }

    const callbackMatch = path.match(/^\/api\/auth\/callback\/(discord)$/);
    if (callbackMatch && event.httpMethod === "GET") {
      const provider = callbackMatch[1];
      const rawUrl = event.rawUrl || `https://local${event.path || ""}`;
      const callbackUrl = new URL(rawUrl);
      const code = callbackUrl.searchParams.get("code");
      const state = callbackUrl.searchParams.get("state");
      const cookies = parseCookies(event);
      const statePayload = verifyEnvelope(state, process.env.SESSION_SECRET);
      if (!code || !statePayload || statePayload.provider !== provider || cookies[OAUTH_STATE_COOKIE] !== state) {
        return json(400, { error: "Invalid OAuth callback." });
      }
      const db = await readDb(store);
      const redirectUri = `${siteOrigin(event)}/api/auth/callback/${provider}`;
      const accessToken = await exchangeOAuthCode(provider, code, redirectUri);
      const profile = await fetchOAuthProfile(provider, accessToken);
      const user =
        statePayload.mode === "link"
          ? (() => {
              const primary = db.users[statePayload.uid];
              if (!primary) throw new Error("Link session expired. Sign in again.");
              linkProviderAccount(db, primary, profile);
              return primary;
            })()
          : resolveAuthUser(db, profile, upsertUser);
      await writeDb(store, db);
      const session = signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, process.env.SESSION_SECRET);
      const linkQuery = statePayload.mode === "link" ? "?linked=discord" : "";
      return {
        statusCode: 302,
        headers: { location: `${siteOrigin(event)}/${linkQuery}`, "cache-control": "no-store" },
        multiValueHeaders: {
          "set-cookie": [
            cookieHeader(SESSION_COOKIE, session, event),
            clearCookieHeader(OAUTH_STATE_COOKIE, event),
          ],
        },
        body: "",
      };
    }

    if (path === "/api/auth/telegram" && event.httpMethod === "POST") {
      if (!process.env.SESSION_SECRET) return json(503, { error: "SESSION_SECRET is required for login." });
      const body = await readBody(event);
      const profile = validateTelegramPayload(body);
      const db = await readDb(store);
      const user = resolveAuthUser(db, profile, upsertUser);
      await writeDb(store, db);
      const session = signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, process.env.SESSION_SECRET);
      return json(200, { user: publicUser(user) }, { "set-cookie": cookieHeader(SESSION_COOKIE, session, event) });
    }

    if (path === "/api/auth/link/telegram" && event.httpMethod === "POST") {
      if (!process.env.SESSION_SECRET) return json(503, { error: "SESSION_SECRET is required." });
      const db = await readDb(store);
      const primary = sessionUser(event, db);
      if (!primary) return json(401, { error: "Sign in required to link Telegram." });
      try {
        const body = await readBody(event);
        const profile = validateTelegramPayload(body);
        linkProviderAccount(db, primary, profile);
        await writeDb(store, db);
        return json(200, { user: publicUser(primary), linked: "telegram" });
      } catch (err) {
        return json(400, { error: err.message || "Telegram link failed." });
      }
    }

    if (path === "/api/auth/link/discord" && event.httpMethod === "GET") {
      const providers = providerStatus();
      if (!process.env.SESSION_SECRET) return json(503, { error: "SESSION_SECRET is required.", providers });
      if (!providers.discord) return json(503, { error: "Discord login is not configured.", providers });
      const db = await readDb(store);
      const primary = sessionUser(event, db);
      if (!primary) return json(401, { error: "Sign in required to link Discord." });
      const origin = siteOrigin(event);
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
      return {
        statusCode: 302,
        headers: { location: authUrl.href, "cache-control": "no-store" },
        multiValueHeaders: {
          "set-cookie": [cookieHeader(OAUTH_STATE_COOKIE, state, event, 10 * 60)],
        },
        body: "",
      };
    }

    if (path === "/api/profile/avatar" && event.httpMethod === "POST") {
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      const body = await readBody(event);
      user.customAvatarUrl = validateAvatarDataUrl(body.dataUrl);
      user.updatedAt = Date.now();
      db.users[user.id] = user;
      await writeDb(store, db);
      return json(200, { user: publicUser(user) });
    }

    if (path === "/api/profile/progress" && event.httpMethod === "GET") {
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      ensureUserProgress(user);
      return json(200, { progress: publicPlayerProgress(user.progress), persisted: true });
    }

    if (path === "/api/profile/progress/xp" && event.httpMethod === "POST") {
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      const body = await readBody(event);
      const source = String(body.source || "").slice(0, 32);
      if (!["minigame", "test"].includes(source)) {
        return json(400, { error: "Invalid XP source." });
      }
      const result = grantXp(user.progress, body.amount);
      user.progress = result.progress;
      user.updatedAt = Date.now();
      db.users[user.id] = user;
      await writeDb(store, db);
      return json(200, {
        progress: result.after,
        grant: result.grant,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
      });
    }

    if (path === "/api/market/getgems-collection" && event.httpMethod === "GET") {
      const rawUrl = event.rawUrl || `https://local${event.path || ""}`;
      return json(200, await getGetgemsCollectionMarket(new URL(rawUrl).searchParams.get("address")));
    }

    if (path === "/api/visits" && event.httpMethod === "POST") {
      const db = await readDb(store);
      db.visits += 1;
      await writeDb(store, db);
      return json(200, { visits: db.visits });
    }

    if (path === "/api/chat/messages" && event.httpMethod === "GET") {
      const db = await readDb(store);
      return json(200, { messages: db.chatMessages.map(publicChatMessage) });
    }

    if (path === "/api/chat/messages" && event.httpMethod === "POST") {
      const body = await readBody(event);
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      const text = sanitizeChatText(body.text);
      if (!text) return json(400, { error: "Message is required." });
      const message = {
        id: `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
        text,
        userId: user.id,
        displayName: sanitizeText(user.displayName, 48) || "Community member",
        avatarUrl: user.customAvatarUrl || user.avatarUrl || "",
        createdAt: Date.now(),
      };
      db.chatMessages = [...db.chatMessages, message].slice(-CHAT_RETENTION_LIMIT);
      await writeDb(store, db);
      return json(201, { message: publicChatMessage(message), messages: db.chatMessages.map(publicChatMessage) });
    }

    if (path === "/api/community-builds" && event.httpMethod === "GET") {
      const db = await readDb(store);
      return json(200, { builds: db.builds.map(publicBuild) });
    }

    if (path === "/api/community-builds" && event.httpMethod === "POST") {
      const body = await readBody(event);
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      const videoUrl = sanitizeCommunityVideoUrl(body.videoUrl);
      if (videoUrl === null) {
        return json(400, { error: "Video link must be YouTube, X/Twitter, or Discord." });
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
      await writeDb(store, db);
      return json(201, { build: publicBuild(build) });
    }

    const voteMatch = path.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
    if (voteMatch && event.httpMethod === "POST") {
      const body = await readBody(event);
      const db = await readDb(store);
      const user = sessionUser(event, db);
      if (!user) return json(401, { error: "Sign in required." });
      const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
      if (!build) return json(404, { error: "Build not found" });
      const voteKey = `user:${user.id}`;
      if (!voteKey) return json(400, { error: "Voter key is required" });
      const voteKeys = buildVoteKeys(build);
      if (voteKeys.includes(voteKey)) {
        return json(409, {
          error: "You already voted for this build.",
          duplicate: true,
          build: publicBuild(build),
        });
      }
      voteKeys.push(voteKey);
      build.votes = (Number(build.votes) || 0) + 1;
      await writeDb(store, db);
      return json(200, { build: publicBuild(build) });
    }

    const deleteMatch = path.match(/^\/api\/community-builds\/([^/]+)$/);
    if (deleteMatch && event.httpMethod === "DELETE") {
      const body = await readBody(event);
      const db = await readDb(store);
      const user = sessionUser(event, db);
      const id = decodeURIComponent(deleteMatch[1]);
      const build = db.builds.find((b) => b.id === id);
      if (!build) return json(404, { error: "Build not found" });
      const ownerKeyMatches = build.ownerKey && build.ownerKey === sanitizeText(body.ownerKey, 120);
      if (!user && !ownerKeyMatches) return json(401, { error: "Sign in required." });
      if (build.userId ? build.userId !== user?.id : !ownerKeyMatches) {
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
