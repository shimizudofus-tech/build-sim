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

function json(body, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else headers.set(key, value);
  });
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
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

async function hashText(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeVoterKey(value) {
  return sanitizeText(value, 160);
}

async function requestVoteKey(request, body) {
  const explicitKey = sanitizeVoterKey(body?.voterKey);
  if (explicitKey) return `voter:${await hashText(explicitKey)}`;
  const fallback = [
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "",
    request.headers.get("user-agent") || "",
  ].join("|");
  return fallback.trim() ? `fallback:${await hashText(fallback)}` : "";
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

function base64urlFromBytes(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64url(value) {
  return base64urlFromBytes(new TextEncoder().encode(value));
}

function bytesFromBase64(base64) {
  const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64urlFromBytes(new Uint8Array(signature));
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
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

function secureCookie(request, env) {
  return new URL(request.url).protocol === "https:" || String(env.PUBLIC_SITE_URL || "").startsWith("https://");
}

function cookieHeader(name, value, request, env, maxAge = SESSION_MAX_AGE_SECONDS, httpOnly = true) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
    httpOnly ? "HttpOnly" : "",
    secureCookie(request, env) ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearCookieHeader(name, request, env) {
  return cookieHeader(name, "", request, env, 0);
}

async function signEnvelope(payload, secret) {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${await hmac(encoded, secret)}`;
}

async function verifyEnvelope(value, secret) {
  if (!value || !secret) return null;
  const [encoded, sig] = String(value).split(".");
  if (!encoded || !sig) return null;
  if ((await hmac(encoded, secret)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64(encoded)));
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

function telegramBotUsername(env) {
  return String(env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
}

function providerStatus(env) {
  const botUsername = telegramBotUsername(env);
  return {
    discord: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && botUsername),
    telegramBotUsername: botUsername,
  };
}

function siteOrigin(request, env) {
  const configured = env.PUBLIC_SITE_URL || env.URL || env.DEPLOY_PRIME_URL;
  return configured ? configured.replace(/\/+$/, "") : new URL(request.url).origin;
}

async function sessionUser(request, env, db) {
  const session = await verifyEnvelope(parseCookies(request)[SESSION_COOKIE], env.SESSION_SECRET);
  return session?.uid ? db.users[session.uid] || null : null;
}

async function requireUser(request, env, db) {
  return sessionUser(request, env, db);
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

async function exchangeOAuthCode(env, provider, code, redirectUri) {
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
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

async function validateTelegramPayload(env, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Telegram login is not configured.");
  const { hash, ...rest } = payload || {};
  if (!hash) throw new Error("Missing Telegram hash.");
  const dataCheckString = Object.keys(rest)
    .filter((key) => rest[key] !== undefined && rest[key] !== null && rest[key] !== "")
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");
  const tokenDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN));
  const key = await crypto.subtle.importKey("raw", tokenDigest, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(dataCheckString));
  const expected = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected !== hash) throw new Error("Invalid Telegram login.");
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
  const bytes = bytesFromBase64(match[2]);
  if (!bytes.length || bytes.length > AVATAR_MAX_BYTES) throw new Error("Avatar must be 1 MB or smaller.");
  return `data:image/${ext};base64,${match[2]}`;
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

async function readDb(env) {
  if (!env.BUILDER_KV) {
    throw new Error("Missing Cloudflare KV binding: BUILDER_KV");
  }
  const db = (await env.BUILDER_KV.get(DB_KEY, "json")) || {};
  return {
    visits: Number(db.visits) || 0,
    builds: Array.isArray(db.builds) ? db.builds : [],
    users: normalizeUsers(db.users),
    chatMessages: Array.isArray(db.chatMessages) ? db.chatMessages.slice(-CHAT_RETENTION_LIMIT) : [],
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
  if (text.length > 1_500_000) throw new Error("Body too large");
  return text ? JSON.parse(text) : {};
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") return json({}, 204);

  try {
    if (path === "/api/auth/me" && method === "GET") {
      const db = await readDb(env);
      return json({ user: publicUser(await sessionUser(request, env, db)), providers: providerStatus(env) });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": clearCookieHeader(SESSION_COOKIE, request, env) });
    }

    const loginMatch = path.match(/^\/api\/auth\/login\/(discord|telegram)$/);
    if (loginMatch && method === "GET") {
      const provider = loginMatch[1];
      const providers = providerStatus(env);
      if (provider === "telegram") {
        return json(
          {
            error: "Use the Telegram Login button in the site UI (Sign in menu).",
            providers,
          },
          501
        );
      }
      if (!env.SESSION_SECRET) return json({ error: "SESSION_SECRET is required for login.", providers }, 503);
      if (!providers[provider]) return json({ error: `${provider} login is not configured.`, providers }, 503);
      const origin = siteOrigin(request, env);
      const redirectUri = `${origin}/api/auth/callback/${provider}`;
      const state = await signEnvelope(
        { provider, nonce: crypto.randomUUID?.() || String(Date.now()), exp: Date.now() + 10 * 60 * 1000 },
        env.SESSION_SECRET
      );
      const authUrl = new URL("https://discord.com/api/oauth2/authorize");
      authUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "identify");
      authUrl.searchParams.set("state", state);
      return new Response(null, {
        status: 302,
        headers: {
          location: authUrl.href,
          "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, request, env, 10 * 60),
          "cache-control": "no-store",
        },
      });
    }

    const callbackMatch = path.match(/^\/api\/auth\/callback\/(discord)$/);
    if (callbackMatch && method === "GET") {
      const provider = callbackMatch[1];
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookies = parseCookies(request);
      const statePayload = await verifyEnvelope(state, env.SESSION_SECRET);
      if (!code || !statePayload || statePayload.provider !== provider || cookies[OAUTH_STATE_COOKIE] !== state) {
        return json({ error: "Invalid OAuth callback." }, 400);
      }
      const db = await readDb(env);
      const redirectUri = `${siteOrigin(request, env)}/api/auth/callback/${provider}`;
      const accessToken = await exchangeOAuthCode(env, provider, code, redirectUri);
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
      await writeDb(env, db);
      const session = await signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, env.SESSION_SECRET);
      const linkQuery = statePayload.mode === "link" ? "?linked=discord" : "";
      const headers = new Headers({ location: `${siteOrigin(request, env)}/${linkQuery}`, "cache-control": "no-store" });
      headers.append("set-cookie", cookieHeader(SESSION_COOKIE, session, request, env));
      headers.append("set-cookie", clearCookieHeader(OAUTH_STATE_COOKIE, request, env));
      return new Response(null, { status: 302, headers });
    }

    if (path === "/api/auth/telegram" && method === "POST") {
      if (!env.SESSION_SECRET) return json({ error: "SESSION_SECRET is required for login." }, 503);
      const body = await readBody(request);
      const profile = await validateTelegramPayload(env, body);
      const db = await readDb(env);
      const user = resolveAuthUser(db, profile, upsertUser);
      await writeDb(env, db);
      const session = await signEnvelope({ uid: user.id, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, env.SESSION_SECRET);
      return json({ user: publicUser(user) }, 200, { "set-cookie": cookieHeader(SESSION_COOKIE, session, request, env) });
    }

    if (path === "/api/auth/link/telegram" && method === "POST") {
      if (!env.SESSION_SECRET) return json({ error: "SESSION_SECRET is required." }, 503);
      const db = await readDb(env);
      const primary = await requireUser(request, env, db);
      if (!primary) return json({ error: "Sign in required to link Telegram." }, 401);
      try {
        const body = await readBody(request);
        const profile = await validateTelegramPayload(env, body);
        linkProviderAccount(db, primary, profile);
        await writeDb(env, db);
        return json({ user: publicUser(primary), linked: "telegram" });
      } catch (err) {
        return json({ error: err.message || "Telegram link failed." }, 400);
      }
    }

    if (path === "/api/auth/link/discord" && method === "GET") {
      const providers = providerStatus(env);
      if (!env.SESSION_SECRET) return json({ error: "SESSION_SECRET is required.", providers }, 503);
      if (!providers.discord) return json({ error: "Discord login is not configured.", providers }, 503);
      const db = await readDb(env);
      const primary = await sessionUser(request, env, db);
      if (!primary) return json({ error: "Sign in required to link Discord." }, 401);
      const origin = siteOrigin(request, env);
      const redirectUri = `${origin}/api/auth/callback/discord`;
      const state = await signEnvelope(
        {
          provider: "discord",
          mode: "link",
          uid: primary.id,
          nonce: crypto.randomUUID?.() || String(Date.now()),
          exp: Date.now() + 10 * 60 * 1000,
        },
        env.SESSION_SECRET
      );
      const authUrl = new URL("https://discord.com/api/oauth2/authorize");
      authUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "identify");
      authUrl.searchParams.set("state", state);
      return new Response(null, {
        status: 302,
        headers: {
          location: authUrl.href,
          "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, request, env, 10 * 60),
          "cache-control": "no-store",
        },
      });
    }

    if (path === "/api/profile/avatar" && method === "POST") {
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      const body = await readBody(request);
      user.customAvatarUrl = validateAvatarDataUrl(body.dataUrl);
      user.updatedAt = Date.now();
      db.users[user.id] = user;
      await writeDb(env, db);
      return json({ user: publicUser(user) });
    }

    if (path === "/api/profile/progress" && method === "GET") {
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      ensureUserProgress(user);
      return json({ progress: publicPlayerProgress(user.progress), persisted: true });
    }

    if (path === "/api/profile/progress/xp" && method === "POST") {
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      const body = await readBody(request);
      const source = String(body.source || "").slice(0, 32);
      if (!["minigame", "test"].includes(source)) {
        return json({ error: "Invalid XP source." }, 400);
      }
      const result = grantXp(user.progress, body.amount);
      user.progress = result.progress;
      user.updatedAt = Date.now();
      db.users[user.id] = user;
      await writeDb(env, db);
      return json({
        progress: result.after,
        grant: result.grant,
        leveledUp: result.leveledUp,
        levelsGained: result.levelsGained,
      });
    }

    if (path === "/api/market/getgems-collection" && method === "GET") {
      return json(await getGetgemsCollectionMarket(url.searchParams.get("address")));
    }

    if (path === "/api/visits" && method === "POST") {
      const db = await readDb(env);
      db.visits += 1;
      await writeDb(env, db);
      return json({ visits: db.visits });
    }

    if (path === "/api/chat/messages" && method === "GET") {
      const db = await readDb(env);
      return json({ messages: db.chatMessages.map(publicChatMessage) });
    }

    if (path === "/api/chat/messages" && method === "POST") {
      const body = await readBody(request);
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      const text = sanitizeChatText(body.text);
      if (!text) return json({ error: "Message is required." }, 400);
      const message = {
        id: randomId(),
        text,
        userId: user.id,
        displayName: sanitizeText(user.displayName, 48) || "Community member",
        avatarUrl: user.customAvatarUrl || user.avatarUrl || "",
        createdAt: Date.now(),
      };
      db.chatMessages = [...db.chatMessages, message].slice(-CHAT_RETENTION_LIMIT);
      await writeDb(env, db);
      return json({ message: publicChatMessage(message), messages: db.chatMessages.map(publicChatMessage) }, 201);
    }

    if (path === "/api/community-builds" && method === "GET") {
      const db = await readDb(env);
      return json({ builds: db.builds.map(publicBuild) });
    }

    if (path === "/api/community-builds" && method === "POST") {
      const body = await readBody(request);
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      const videoUrl = sanitizeCommunityVideoUrl(body.videoUrl);
      if (videoUrl === null) {
        return json({ error: "Video link must be YouTube, X/Twitter, or Discord." }, 400);
      }
      const build = {
        id: randomId(),
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
      await writeDb(env, db);
      return json({ build: publicBuild(build) }, 201);
    }

    const voteMatch = path.match(/^\/api\/community-builds\/([^/]+)\/vote$/);
    if (voteMatch && method === "POST") {
      const body = await readBody(request);
      const db = await readDb(env);
      const user = await requireUser(request, env, db);
      if (!user) return json({ error: "Sign in required." }, 401);
      const build = db.builds.find((b) => b.id === decodeURIComponent(voteMatch[1]));
      if (!build) return json({ error: "Build not found" }, 404);
      const voteKey = `user:${user.id}`;
      if (!voteKey) return json({ error: "Voter key is required" }, 400);
      const voteKeys = buildVoteKeys(build);
      if (voteKeys.includes(voteKey)) {
        return json(
          { error: "You already voted for this build.", duplicate: true, build: publicBuild(build) },
          409
        );
      }
      voteKeys.push(voteKey);
      build.votes = (Number(build.votes) || 0) + 1;
      await writeDb(env, db);
      return json({ build: publicBuild(build) });
    }

    const deleteMatch = path.match(/^\/api\/community-builds\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const body = await readBody(request);
      const db = await readDb(env);
      const user = await sessionUser(request, env, db);
      const id = decodeURIComponent(deleteMatch[1]);
      const build = db.builds.find((b) => b.id === id);
      if (!build) return json({ error: "Build not found" }, 404);
      const ownerKeyMatches = build.ownerKey && build.ownerKey === sanitizeText(body.ownerKey, 120);
      if (!user && !ownerKeyMatches) return json({ error: "Sign in required." }, 401);
      if (build.userId ? build.userId !== user?.id : !ownerKeyMatches) {
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
