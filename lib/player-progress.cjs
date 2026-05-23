/** Shared XP / level / energy helpers (server + Cloudflare Pages API). */

const PLAYER_ENERGY_CAP_DEFAULT = 100;
const MAX_LEVEL = 999;
const MAX_XP_GRANT = 5000;

function xpNeededForLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor(100 * Math.pow(lv, 1.2));
}

function breakdownFromTotalXp(totalXp) {
  let xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  while (level < MAX_LEVEL) {
    const need = xpNeededForLevel(level);
    if (xp < need) {
      return {
        level,
        xpInLevel: xp,
        xpToNext: need,
        totalXp: Math.max(0, Math.floor(Number(totalXp) || 0)),
      };
    }
    xp -= need;
    level += 1;
  }
  return {
    level: MAX_LEVEL,
    xpInLevel: 0,
    xpToNext: 0,
    totalXp: Math.max(0, Math.floor(Number(totalXp) || 0)),
  };
}

function normalizeStoredProgress(raw) {
  const energyCap = Math.max(
    1,
    Math.min(500, Math.floor(Number(raw?.energyCap) || PLAYER_ENERGY_CAP_DEFAULT))
  );
  const energy = Math.max(0, Math.min(energyCap, Math.floor(Number(raw?.energy) || energyCap)));
  return {
    totalXp: Math.max(0, Math.floor(Number(raw?.totalXp) || 0)),
    energy,
    energyCap,
    energyUpdatedAt: Number(raw?.energyUpdatedAt) || Date.now(),
  };
}

function ensureUserProgress(user) {
  if (!user) return null;
  user.progress = normalizeStoredProgress(user.progress);
  return user;
}

function publicPlayerProgress(progress) {
  const stored = normalizeStoredProgress(progress);
  const breakdown = breakdownFromTotalXp(stored.totalXp);
  return {
    ...breakdown,
    energy: stored.energy,
    energyCap: stored.energyCap,
    energyUpdatedAt: stored.energyUpdatedAt,
  };
}

function grantXp(progress, amount) {
  const stored = normalizeStoredProgress(progress);
  const before = breakdownFromTotalXp(stored.totalXp);
  const grant = Math.max(0, Math.min(MAX_XP_GRANT, Math.floor(Number(amount) || 0)));
  stored.totalXp += grant;
  const after = breakdownFromTotalXp(stored.totalXp);
  return {
    progress: stored,
    grant,
    leveledUp: after.level > before.level,
    levelsGained: after.level - before.level,
    before,
    after: publicPlayerProgress(stored),
  };
}

function spendEnergy(progress, cost) {
  const stored = normalizeStoredProgress(progress);
  const amount = Math.max(0, Math.floor(Number(cost) || 0));
  if (amount > stored.energy) {
    return { ok: false, progress: stored, error: "Not enough energy." };
  }
  stored.energy -= amount;
  stored.energyUpdatedAt = Date.now();
  return { ok: true, progress: stored, spent: amount };
}

module.exports = {
  PLAYER_ENERGY_CAP_DEFAULT,
  MAX_XP_GRANT,
  xpNeededForLevel,
  breakdownFromTotalXp,
  normalizeStoredProgress,
  ensureUserProgress,
  publicPlayerProgress,
  grantXp,
  spendEnergy,
};
