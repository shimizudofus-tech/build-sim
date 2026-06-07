/** Online presence + linked-member counts (Discord/Telegram). */

const { userLinkStatus, ensureLinkedIds } = require("./auth-accounts.cjs");

const PRESENCE_TTL_MS = 5 * 60 * 1000;
const PRESENCE_MAX_ENTRIES = 500;
const VISITOR_ID_MAX = 64;

function sanitizeVisitorId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w:.-]/g, "")
    .slice(0, VISITOR_ID_MAX);
}

function prunePresence(presence, now = Date.now()) {
  if (!presence || typeof presence !== "object") return {};
  const out = {};
  for (const [id, entry] of Object.entries(presence)) {
    const lastSeenAt = Number(entry?.lastSeenAt) || 0;
    if (now - lastSeenAt <= PRESENCE_TTL_MS) {
      out[id] = {
        lastSeenAt,
        userId: entry?.userId ? String(entry.userId).slice(0, 120) : null,
      };
    }
  }
  const keys = Object.keys(out);
  if (keys.length > PRESENCE_MAX_ENTRIES) {
    keys.sort((a, b) => (out[a].lastSeenAt || 0) - (out[b].lastSeenAt || 0));
    const drop = keys.length - PRESENCE_MAX_ENTRIES;
    for (let i = 0; i < drop; i += 1) delete out[keys[i]];
  }
  return out;
}

function countOnline(presence, now = Date.now()) {
  return Object.keys(prunePresence(presence, now)).length;
}

function countLinkedMembers(users) {
  if (!users || typeof users !== "object") return 0;
  return Object.values(users).filter((user) => {
    ensureLinkedIds(user);
    const links = userLinkStatus(user);
    return links.discord || links.telegram;
  }).length;
}

function touchPresence(db, visitorId, userId = null, now = Date.now()) {
  const id = sanitizeVisitorId(visitorId);
  if (!id) return db;
  if (!db.presence || typeof db.presence !== "object") db.presence = {};
  db.presence = prunePresence(db.presence, now);
  db.presence[id] = {
    lastSeenAt: now,
    userId: userId ? String(userId).slice(0, 120) : null,
  };
  return db;
}

/** Évite un PUT KV à chaque ping (quota gratuit Cloudflare : 1000 PUT/jour). */
const PRESENCE_KV_WRITE_INTERVAL_MS = 30 * 60 * 1000;

function presenceKvWriteDue(db, visitorId, minIntervalMs = PRESENCE_KV_WRITE_INTERVAL_MS, now = Date.now()) {
  const id = sanitizeVisitorId(visitorId);
  if (!id) return false;
  const last = Number(db.presence?.[id]?.lastSeenAt) || 0;
  return !last || now - last >= minIntervalMs;
}

function publicCommunityStats(db, now = Date.now()) {
  return {
    online: countOnline(db.presence, now),
    membersTotal: countLinkedMembers(db.users),
  };
}

module.exports = {
  PRESENCE_TTL_MS,
  sanitizeVisitorId,
  prunePresence,
  countOnline,
  countLinkedMembers,
  touchPresence,
  presenceKvWriteDue,
  PRESENCE_KV_WRITE_INTERVAL_MS,
  publicCommunityStats,
};
