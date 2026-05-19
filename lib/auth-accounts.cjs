/** Discord ↔ Telegram account linking (shared across API runtimes). */

const PROVIDERS = ["discord", "telegram"];

function providerFromUserId(userId) {
  const id = String(userId || "");
  if (id.startsWith("discord:")) return "discord";
  if (id.startsWith("telegram:")) return "telegram";
  return "";
}

function ensureLinkedIds(user) {
  if (!user) return user;
  if (!user.linkedIds || typeof user.linkedIds !== "object") user.linkedIds = {};
  const fromId = providerFromUserId(user.id);
  if (fromId) user.linkedIds[fromId] = user.id;
  for (const provider of PROVIDERS) {
    const linked = user.linkedIds[provider];
    if (linked) user.linkedIds[provider] = String(linked);
  }
  return user;
}

function userLinkedId(user, provider) {
  if (!user) return "";
  ensureLinkedIds(user);
  return user.linkedIds[provider] || "";
}

function userLinkStatus(user) {
  ensureLinkedIds(user);
  return {
    discord: Boolean(user.linkedIds.discord),
    telegram: Boolean(user.linkedIds.telegram),
  };
}

function findUserByProviderAccountId(db, accountId) {
  const id = String(accountId || "");
  if (!id) return null;
  if (db.users[id]) return db.users[id];
  for (const user of Object.values(db.users)) {
    ensureLinkedIds(user);
    for (const provider of PROVIDERS) {
      if (user.linkedIds[provider] === id) return user;
    }
  }
  return null;
}

function mergeProgress(primary, secondary) {
  ensureUserProgress(primary);
  ensureUserProgress(secondary);
  const a = primary.progress;
  const b = secondary.progress;
  if ((b.totalXp || 0) > (a.totalXp || 0)) {
    a.totalXp = b.totalXp;
  }
  if ((b.energyCap || 0) > (a.energyCap || 0)) {
    a.energyCap = b.energyCap;
  }
  if ((b.energy || 0) > (a.energy || 0)) {
    a.energy = Math.min(a.energyCap, b.energy);
  }
}

function ensureUserProgress(user) {
  const { ensureUserProgress: ensure } = require("./player-progress.cjs");
  return ensure(user);
}

function mergeUserRecords(db, primaryId, secondaryId) {
  if (!primaryId || !secondaryId || primaryId === secondaryId) return;
  const primary = db.users[primaryId];
  const secondary = db.users[secondaryId];
  if (!primary || !secondary) return;

  ensureLinkedIds(primary);
  ensureLinkedIds(secondary);

  for (const provider of PROVIDERS) {
    const linked = userLinkedId(secondary, provider);
    if (linked) primary.linkedIds[provider] = linked;
  }

  if (!primary.customAvatarUrl && secondary.customAvatarUrl) {
    primary.customAvatarUrl = secondary.customAvatarUrl;
  }
  mergeProgress(primary, secondary);

  for (const build of db.builds || []) {
    if (build.userId === secondaryId) {
      build.userId = primaryId;
    }
    const voteKeys = Array.isArray(build.voteKeys) ? build.voteKeys : [];
    const oldKey = `user:${secondaryId}`;
    const newKey = `user:${primaryId}`;
    build.voteKeys = voteKeys.map((key) => (key === oldKey ? newKey : key));
  }

  for (const message of db.chatMessages || []) {
    if (message.userId === secondaryId) message.userId = primaryId;
  }

  delete db.users[secondaryId];
}

function applyProviderProfile(user, profile) {
  const now = Date.now();
  const provider = profile.provider || providerFromUserId(profile.id);
  if (profile.displayName) user.displayName = profile.displayName;
  if (profile.avatarUrl && provider === profile.provider) {
    if (!user.avatarUrl || user.provider === provider) user.avatarUrl = profile.avatarUrl;
  }
  if (provider) user.provider = provider;
  user.updatedAt = now;
  ensureLinkedIds(user);
  return user;
}

function linkProviderAccount(db, primaryUser, profile) {
  const accountId = String(profile.id || "");
  const provider = profile.provider || providerFromUserId(accountId);
  if (!provider || !accountId) throw new Error("Invalid provider account.");

  ensureLinkedIds(primaryUser);
  const existingOwner = findUserByProviderAccountId(db, accountId);
  if (existingOwner && existingOwner.id !== primaryUser.id) {
    mergeUserRecords(db, primaryUser.id, existingOwner.id);
    primaryUser = db.users[primaryUser.id] || primaryUser;
  }

  if (userLinkedId(primaryUser, provider) && userLinkedId(primaryUser, provider) !== accountId) {
    throw new Error(`Your profile already has a different ${provider} account linked.`);
  }

  primaryUser.linkedIds[provider] = accountId;
  applyProviderProfile(primaryUser, profile);
  ensureUserProgress(primaryUser);
  db.users[primaryUser.id] = primaryUser;
  return primaryUser;
}

function resolveAuthUser(db, profile, upsertUser) {
  const accountId = String(profile.id || "");
  const owner = findUserByProviderAccountId(db, accountId);
  if (owner) {
    applyProviderProfile(owner, profile);
    ensureUserProgress(owner);
    db.users[owner.id] = owner;
    return owner;
  }
  return upsertUser(db, profile);
}

function publicUserLinks(user) {
  return userLinkStatus(user);
}

module.exports = {
  PROVIDERS,
  providerFromUserId,
  ensureLinkedIds,
  userLinkedId,
  userLinkStatus,
  findUserByProviderAccountId,
  mergeUserRecords,
  linkProviderAccount,
  resolveAuthUser,
  publicUserLinks,
  applyProviderProfile,
};
