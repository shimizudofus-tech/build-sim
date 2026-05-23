/**
 * Helpers dev local — actifs uniquement via server.js + requêtes localhost.
 */

const LOCAL_DEV_USER_ID = "local:dev";
const LOCAL_DEV_KRAPS = 100;

function isLocalHostRequest(req) {
  const raw = String(req.headers.host || "");
  const host = raw.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function localDevEnabled(req) {
  if (process.env.BUILDER_LOCAL_DEV === "0") return false;
  return isLocalHostRequest(req);
}

function bootstrapLocalDevUser(db, deps) {
  const { upsertUser, ensureLinkedIds, ensureFakeSparksRecord, applyReferralAfterAuth } = deps;
  const user = upsertUser(db, {
    id: LOCAL_DEV_USER_ID,
    provider: "local",
    displayName: "Local Dev",
    avatarUrl: "",
  });
  ensureLinkedIds(user);
  user.linkedIds.discord = "discord:local-dev-fake";
  user.linkedIds.telegram = "telegram:local-dev-fake";
  user.updatedAt = Date.now();
  db.users[user.id] = user;
  applyReferralAfterAuth(db, user);

  const row = ensureFakeSparksRecord(db, user);
  row.fake_sparks_total = LOCAL_DEV_KRAPS;
  row.disclaimer_ack = true;
  row.updated_at = Date.now();

  return user;
}

module.exports = {
  LOCAL_DEV_USER_ID,
  LOCAL_DEV_KRAPS,
  isLocalHostRequest,
  localDevEnabled,
  bootstrapLocalDevUser,
};
