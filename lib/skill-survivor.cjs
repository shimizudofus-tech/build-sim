/**
 * Skill Survivor — mini-jeu compétitif (1 KRAPS / vie, 1 vie gratuite / jour UTC, 3 vies max).
 */

const {
  canParticipate,
  ensureFakeSparksRecord,
  addSparks,
} = require("./fake-sparks.cjs");

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomUInt32() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

const GAME_ID = "skill-survivor";
const LIFE_COST_KRAPS = 1;
const MAX_LIVES = 3;
const RUN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 10 * 60 * 1000;
const MIN_DURATION_MS = 3000;
const LEADERBOARD_LIMIT = 50;

const ERR_LINK_REQUIRED = "fake_sparks_link_required";
const ERR_SIGN_IN = "sign_in_required";
const ERR_INSUFFICIENT_KRAPS = "skill_survivor_insufficient_kraps";
const ERR_RUN_ACTIVE = "skill_survivor_run_active";
const ERR_RUN_NOT_FOUND = "skill_survivor_run_not_found";
const ERR_RUN_EXPIRED = "skill_survivor_run_expired";
const ERR_INVALID_SCORE = "skill_survivor_invalid_score";
const ERR_MAX_LIVES = "skill_survivor_max_lives";
const ERR_UPGRADE_OWNED = "skill_survivor_upgrade_owned";
const ERR_UPGRADE_UNKNOWN = "skill_survivor_upgrade_unknown";

/** Améliorations permanentes — niveaux infinis, prix base × 2^level. */
const UPGRADE_CATALOG = [
  {
    id: "attackSpeed2x",
    costKraps: 20,
    labelKey: "skillSurvivor.upgradeAttackSpeed2x",
    descKey: "skillSurvivor.upgradeAttackSpeed2xDesc",
  },
  {
    id: "damage2x",
    costKraps: 25,
    labelKey: "skillSurvivor.upgradeDamage2x",
    descKey: "skillSurvivor.upgradeDamage2xDesc",
  },
  {
    id: "moveSpeed",
    costKraps: 15,
    labelKey: "skillSurvivor.upgradeMoveSpeed",
    descKey: "skillSurvivor.upgradeMoveSpeedDesc",
  },
  {
    id: "bulletSpeed",
    costKraps: 25,
    labelKey: "skillSurvivor.upgradeBulletSpeed",
    descKey: "skillSurvivor.upgradeBulletSpeedDesc",
  },
  {
    id: "pickupMagnet",
    costKraps: 35,
    labelKey: "skillSurvivor.upgradePickupMagnet",
    descKey: "skillSurvivor.upgradePickupMagnetDesc",
  },
  {
    id: "scoreBoost",
    costKraps: 50,
    labelKey: "skillSurvivor.upgradeScoreBoost",
    descKey: "skillSurvivor.upgradeScoreBoostDesc",
  },
  {
    id: "thickSkin",
    costKraps: 60,
    labelKey: "skillSurvivor.upgradeThickSkin",
    descKey: "skillSurvivor.upgradeThickSkinDesc",
  },
  {
    id: "multishot",
    costKraps: 100,
    labelKey: "skillSurvivor.upgradeMultishot",
    descKey: "skillSurvivor.upgradeMultishotDesc",
  },
];

/** Récompenses de run (score atteint sur la partie). */
const RUN_REWARD_TIERS = [
  { minScore: 6000, rewards: [{ type: "kraps", amount: 20 }] },
  { minScore: 4000, rewards: [{ type: "kraps", amount: 12 }] },
  { minScore: 2500, rewards: [{ type: "kraps", amount: 6 }] },
  { minScore: 1200, rewards: [{ type: "kraps", amount: 3 }] },
  { minScore: 400, rewards: [{ type: "kraps", amount: 1 }] },
];

/** Récompenses leaderboard daily (UTC). */
const DAILY_LEADERBOARD_REWARD_TIERS = [
  {
    rankMin: 1,
    rankMax: 1,
    labelKey: "skillSurvivor.rewardRank1",
    rewards: [{ type: "kraps", amount: 25 }],
  },
  {
    rankMin: 2,
    rankMax: 3,
    labelKey: "skillSurvivor.rewardRank2",
    rewards: [{ type: "kraps", amount: 12 }],
  },
  {
    rankMin: 4,
    rankMax: 10,
    labelKey: "skillSurvivor.rewardRank4",
    rewards: [{ type: "kraps", amount: 6 }],
  },
  {
    rankMin: 11,
    rankMax: 25,
    labelKey: "skillSurvivor.rewardRank11",
    rewards: [{ type: "kraps", amount: 3 }],
  },
];

/** Récompenses leaderboard monthly (UTC). */
const MONTHLY_LEADERBOARD_REWARD_TIERS = [
  {
    rankMin: 1,
    rankMax: 1,
    labelKey: "skillSurvivor.rewardRank1",
    rewards: [
      { type: "kraps", amount: 100 },
      { type: "badge", id: "survivor_champion", label: "Survivor Champion" },
    ],
  },
  {
    rankMin: 2,
    rankMax: 3,
    labelKey: "skillSurvivor.rewardRank2",
    rewards: [{ type: "kraps", amount: 50 }],
  },
  {
    rankMin: 4,
    rankMax: 10,
    labelKey: "skillSurvivor.rewardRank4",
    rewards: [{ type: "kraps", amount: 25 }],
  },
  {
    rankMin: 11,
    rankMax: 25,
    labelKey: "skillSurvivor.rewardRank11",
    rewards: [{ type: "kraps", amount: 10 }],
  },
];

function utcDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function utcMonthKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 7);
}

function utcDayEndMs(ts = Date.now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function utcMonthEndMs(ts = Date.now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

function difficultyAt(seconds) {
  return 1 + Math.floor(Math.max(0, seconds) / 10) * 0.25;
}

function computeScore(durationMs, kills, pickupScore = 0, bossBonusScore = 0) {
  return (
    Math.floor(durationMs / 100) +
    Math.max(0, Math.floor(kills)) * 30 +
    Math.max(0, Math.floor(pickupScore)) +
    Math.max(0, Math.floor(bossBonusScore))
  );
}

function upgradeLevel(raw, id) {
  if (!raw || typeof raw !== "object") return 0;
  const v = raw[id];
  if (typeof v === "boolean") return v ? 1 : 0;
  return Math.max(0, Math.floor(Number(v) || 0));
}

function normalizeUpgrades(raw) {
  const out = {};
  for (const item of UPGRADE_CATALOG) {
    out[item.id] = upgradeLevel(raw, item.id);
  }
  return out;
}

function upgradeCostAtLevel(baseCost, level) {
  const base = Math.max(0, Math.floor(Number(baseCost) || 0));
  const lv = Math.max(0, Math.floor(Number(level) || 0));
  const cost = base * Math.pow(2, lv);
  if (!Number.isFinite(cost) || cost > 2_000_000_000) return 2_000_000_000;
  return Math.floor(cost);
}

function getUpgradeEffects(upgrades) {
  const u = normalizeUpgrades(upgrades);
  const atk = u.attackSpeed2x;
  const dmg = u.damage2x;
  const move = u.moveSpeed;
  const bullet = u.bulletSpeed;
  const magnet = u.pickupMagnet;
  const score = u.scoreBoost;
  const skin = u.thickSkin;
  const multi = u.multishot;
  const multishotHits = multi > 0 ? 1 + multi : 1;
  return {
    fireRateMult: atk > 0 ? Math.pow(2, atk) : 1,
    bulletDamage: dmg > 0 ? Math.pow(2, dmg) : 1,
    multishotHits,
    multishot: multishotHits > 1,
    moveSpeedMult: move > 0 ? Math.pow(1.25, move) : 1,
    bulletSpeedMult: bullet > 0 ? Math.pow(1.3, bullet) : 1,
    pickupRadius: 18 + magnet * 10,
    pickupScoreMult: score > 0 ? Math.pow(1.25, score) : 1,
    invulnMs: 900 + skin * 500,
  };
}

function publicUpgradeCatalog() {
  return UPGRADE_CATALOG.map(({ id, costKraps, labelKey, descKey }) => ({
    id,
    costKraps,
    baseCostKraps: costKraps,
    priceDoubles: true,
    labelKey,
    descKey,
  }));
}

function maxPlausibleKills(durationMs, upgrades = {}) {
  const effects = getUpgradeEffects(upgrades);
  const ms = Math.max(0, Math.min(MAX_DURATION_MS, Math.floor(durationMs)));
  let kills = 0;
  for (let t = 0; t < ms; t += 500) {
    const diff = difficultyAt(t / 1000);
    const multiMult =
      effects.multishotHits > 1 ? 1 + (effects.multishotHits - 1) * 0.6 : 1;
    kills +=
      0.32 * diff * effects.fireRateMult * multiMult * (effects.bulletDamage || 1);
  }
  kills += Math.floor(ms / 10000) * 3 * effects.fireRateMult;
  return Math.ceil(kills * 1.55) + 12;
}

function maxPlausiblePickupScore(durationMs) {
  const ms = Math.max(0, Math.min(MAX_DURATION_MS, Math.floor(durationMs)));
  const spawns = Math.ceil(ms / 1500) + 2;
  return spawns * 55 + 30;
}

function maxPlausibleBossBonus(durationMs) {
  const ms = Math.max(0, Math.min(MAX_DURATION_MS, Math.floor(durationMs)));
  return ms >= 120000 ? 1000 : 0;
}

function spendSparks(row, amount) {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (row.fake_sparks_total < cost) {
    return { ok: false, error: ERR_INSUFFICIENT_KRAPS };
  }
  row.fake_sparks_total -= cost;
  row.updated_at = Date.now();
  return { ok: true, spent: cost };
}

function normalizeSkillSurvivorDb(raw) {
  if (!raw || typeof raw !== "object") {
    return { runs: {}, users: {} };
  }
  return {
    runs: raw.runs && typeof raw.runs === "object" ? raw.runs : {},
    users: raw.users && typeof raw.users === "object" ? raw.users : {},
  };
}

function migrateSkillSurvivorStore(store) {
  for (const stats of Object.values(store.users || {})) {
    if (!stats?.upgrades || typeof stats.upgrades !== "object") continue;
    const needsMigrate = Object.values(stats.upgrades).some((v) => typeof v === "boolean");
    if (needsMigrate) stats.upgrades = normalizeUpgrades(stats.upgrades);
  }
}

function ensureSkillSurvivorDb(db) {
  db.skillSurvivor = normalizeSkillSurvivorDb(db.skillSurvivor);
  migrateSkillSurvivorStore(db.skillSurvivor);
  return db.skillSurvivor;
}

function ensureUserStats(store, user) {
  const row = ensureFakeSparksRecordsSafe(user);
  if (!row) return null;
  let stats = store.users[user.id];
  if (!stats) {
    stats = {
      userId: user.id,
      username: String(user.displayName || "Player").trim().slice(0, 80),
      avatarUrl: String(user.customAvatarUrl || user.avatarUrl || "").slice(0, 512),
      bestScore: 0,
      bestDurationMs: 0,
      bestKills: 0,
      totalRuns: 0,
      lastFreeRunDay: "",
      upgrades: normalizeUpgrades({}),
      updatedAt: Date.now(),
    };
    store.users[user.id] = stats;
  }
  stats.username = String(user.displayName || stats.username || "Player").trim().slice(0, 80);
  stats.avatarUrl = String(user.customAvatarUrl || user.avatarUrl || stats.avatarUrl || "").slice(
    0,
    512,
  );
  stats.upgrades = normalizeUpgrades(stats.upgrades);
  return stats;
}

function ensureFakeSparksRecordsSafe(user) {
  if (!user?.id) return null;
  return user;
}

function purgeExpiredRuns(store) {
  const now = Date.now();
  for (const [id, run] of Object.entries(store.runs)) {
    if (!run || run.status !== "active") continue;
    if (now - (run.startedAt || 0) > RUN_EXPIRY_MS) {
      run.status = "expired";
      run.updatedAt = now;
    }
  }
}

function normalizeRun(run) {
  if (!run || typeof run !== "object") return run;
  const lives = Math.floor(Number(run.livesPurchased));
  if (!Number.isFinite(lives) || lives < 0) {
    const legacyPaid = Boolean(run.freeRun) || Math.floor(Number(run.costPaid) || 0) > 0;
    run.livesPurchased = legacyPaid ? 1 : 0;
  }
  return run;
}

function cancelRun(run, reason = "cancelled") {
  if (!run || run.status !== "active") return;
  run.status = reason;
  run.updatedAt = Date.now();
}

/** Run créée mais sans vie achetée — bloque le lobby sans partie en cours. */
function isZombieRun(run) {
  if (!run || run.status !== "active") return false;
  normalizeRun(run);
  return Math.floor(Number(run.livesPurchased) || 0) <= 0;
}

function cleanupZombieRuns(store, userId) {
  purgeExpiredRuns(store);
  for (const run of Object.values(store.runs || {})) {
    if (!run || run.userId !== userId) continue;
    normalizeRun(run);
    if (isZombieRun(run)) cancelRun(run, "cancelled");
  }
}

function activeRunForUser(store, userId) {
  purgeExpiredRuns(store);
  const run =
    Object.values(store.runs).find(
      (r) => r && r.userId === userId && r.status === "active",
    ) || null;
  return run ? normalizeRun(run) : null;
}

function bumpPeriodBest(current, periodKey, score, durationMs, kills, now) {
  let row =
    current && current.periodKey === periodKey
      ? { ...current }
      : { periodKey, score: 0, durationMs: 0, kills: 0, updatedAt: 0 };
  if (score > (row.score || 0)) {
    row.score = score;
    row.durationMs = durationMs;
    row.kills = kills;
    row.updatedAt = now;
  } else if (score === (row.score || 0) && score > 0) {
    if (
      durationMs > (row.durationMs || 0) ||
      (durationMs === (row.durationMs || 0) && (row.updatedAt || 0) > now)
    ) {
      row.durationMs = durationMs;
      row.kills = kills;
      row.updatedAt = now;
    }
  }
  return row;
}

function buildLeaderboardForPeriod(store, userId, period, rewardTiers, now = Date.now()) {
  const day = utcDayKey(now);
  const month = utcMonthKey(now);
  const periodKey = period === "daily" ? day : month;

  const rows = Object.values(store.users || {})
    .map((u) => {
      if (!u) return null;
      const pb = period === "daily" ? u.dailyBest : u.monthlyBest;
      if (!pb || pb.periodKey !== periodKey || (pb.score || 0) <= 0) return null;
      return {
        userId: u.userId,
        username: u.username || "Player",
        avatarUrl: u.avatarUrl || "",
        score: pb.score || 0,
        durationMs: pb.durationMs || 0,
        kills: pb.kills || 0,
        updatedAt: pb.updatedAt || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diff = (b.score || 0) - (a.score || 0);
      if (diff !== 0) return diff;
      if ((b.durationMs || 0) !== (a.durationMs || 0)) {
        return (b.durationMs || 0) - (a.durationMs || 0);
      }
      return (a.updatedAt || 0) - (b.updatedAt || 0);
    });

  const entries = rows.slice(0, LEADERBOARD_LIMIT).map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    username: row.username,
    avatarUrl: row.avatarUrl,
    score: row.score,
    durationMs: row.durationMs,
    kills: row.kills,
    leaderboardRewards: rewardsForRank(index + 1, rewardTiers),
  }));

  let myRank = null;
  if (userId) {
    const idx = rows.findIndex((r) => r.userId === userId);
    if (idx >= 0) {
      const rank = idx + 1;
      myRank = {
        rank,
        score: rows[idx].score,
        durationMs: rows[idx].durationMs,
        kills: rows[idx].kills,
        leaderboardRewards: rewardsForRank(rank, rewardTiers),
      };
    }
  }

  return {
    period,
    periodKey,
    resetsAt: period === "daily" ? utcDayEndMs(now) : utcMonthEndMs(now),
    entries,
    myRank,
    totalPlayers: rows.length,
    rewardTiers,
  };
}

function buildLeaderboards(store, userId, now = Date.now()) {
  return {
    daily: buildLeaderboardForPeriod(store, userId, "daily", DAILY_LEADERBOARD_REWARD_TIERS, now),
    monthly: buildLeaderboardForPeriod(
      store,
      userId,
      "monthly",
      MONTHLY_LEADERBOARD_REWARD_TIERS,
      now,
    ),
  };
}

function rewardsForRank(rank, tiers = DAILY_LEADERBOARD_REWARD_TIERS) {
  const tier = tiers.find((t) => rank >= t.rankMin && rank <= t.rankMax);
  return tier ? tier.rewards : [];
}

function rewardsForScore(score) {
  const tier = RUN_REWARD_TIERS.find((t) => score >= t.minScore);
  return tier ? tier.rewards : [];
}

function grantRewards(row, rewards) {
  const granted = [];
  for (const reward of rewards || []) {
    if (reward.type === "kraps") {
      const { gain } = addSparks(row, reward.amount);
      granted.push({ type: "kraps", amount: gain });
    } else {
      granted.push({ ...reward });
    }
  }
  return granted;
}

function publicConfig() {
  return {
    gameId: GAME_ID,
    lifeCostKraps: LIFE_COST_KRAPS,
    maxLives: MAX_LIVES,
    freeLifeDaily: true,
    maxDurationMs: MAX_DURATION_MS,
    runRewardTiers: RUN_REWARD_TIERS,
    dailyLeaderboardRewardTiers: DAILY_LEADERBOARD_REWARD_TIERS,
    monthlyLeaderboardRewardTiers: MONTHLY_LEADERBOARD_REWARD_TIERS,
    dailyResetsAt: utcDayEndMs(),
    monthlyResetsAt: utcMonthEndMs(),
    upgradeCatalog: publicUpgradeCatalog(),
  };
}

function getSkillSurvivorState(db, user) {
  const store = ensureSkillSurvivorDb(db);
  if (user?.id) cleanupZombieRuns(store, user.id);
  const eligible = canParticipate(user);
  const sparksRow = user ? ensureFakeSparksRecord(db, user) : null;
  const stats = user ? ensureUserStats(store, user) : null;
  const day = utcDayKey();
  const freeAvailable = Boolean(stats && stats.lastFreeRunDay !== day);
  const balance = sparksRow?.fake_sparks_total || 0;
  const activeRun = user ? activeRunForUser(store, user.id) : null;
  const livesPurchased = Math.floor(Number(activeRun?.livesPurchased) || 0);
  const canAffordLife = freeAvailable || balance >= LIFE_COST_KRAPS;
  const canResume = Boolean(user && eligible && activeRun && livesPurchased > 0);
  const canStartFresh = Boolean(user && eligible && !activeRun && canAffordLife);

  return {
    eligible,
    signedIn: Boolean(user),
    participationMessage: eligible ? "" : ERR_LINK_REQUIRED,
    config: publicConfig(),
    balance,
    freeAvailable,
    canStart: canStartFresh || canResume,
    canResume,
    activeRun: activeRun
      ? {
          runId: activeRun.id,
          seed: activeRun.seed,
          startedAt: activeRun.startedAt,
          livesPurchased,
        }
      : null,
    myBest: stats
      ? {
          score: stats.bestScore || 0,
          durationMs: stats.bestDurationMs || 0,
          kills: stats.bestKills || 0,
          totalRuns: stats.totalRuns || 0,
        }
      : null,
    leaderboards: buildLeaderboards(store, user?.id || ""),
    upgrades: stats ? stats.upgrades : normalizeUpgrades({}),
    upgradeCatalog: publicUpgradeCatalog(),
  };
}

function startSkillSurvivorRun(db, user) {
  if (!user) return { error: ERR_SIGN_IN, status: 401 };
  if (!canParticipate(user)) return { error: ERR_LINK_REQUIRED, status: 403 };

  const store = ensureSkillSurvivorDb(db);
  const sparksRow = ensureFakeSparksRecord(db, user);
  const stats = ensureUserStats(store, user);
  cleanupZombieRuns(store, user.id);

  const existing = activeRunForUser(store, user.id);
  if (existing) {
    return {
      error: ERR_RUN_ACTIVE,
      status: 409,
      activeRun: {
        runId: existing.id,
        seed: existing.seed,
        livesPurchased: Math.floor(Number(existing.livesPurchased) || 0),
      },
    };
  }

  const runId = randomHex(12);
  const seed = randomUInt32();
  const now = Date.now();

  store.runs[runId] = {
    id: runId,
    userId: user.id,
    seed,
    startedAt: now,
    status: "active",
    livesPurchased: 0,
    totalCostPaid: 0,
    updatedAt: now,
  };

  stats.totalRuns = (stats.totalRuns || 0) + 1;
  stats.updatedAt = now;

  return {
    ok: true,
    runId,
    seed,
    balance: sparksRow.fake_sparks_total,
    freeAvailable: stats.lastFreeRunDay !== utcDayKey(),
    config: publicConfig(),
  };
}

function buySkillSurvivorLife(db, user, body) {
  if (!user) return { error: ERR_SIGN_IN, status: 401 };
  if (!canParticipate(user)) return { error: ERR_LINK_REQUIRED, status: 403 };

  const runId = String(body?.runId || "").trim();
  if (!runId) return { error: ERR_RUN_NOT_FOUND, status: 404 };

  const store = ensureSkillSurvivorDb(db);
  const sparksRow = ensureFakeSparksRecord(db, user);
  const stats = ensureUserStats(store, user);
  const run = store.runs[runId];

  if (!run || run.userId !== user.id) {
    return { error: ERR_RUN_NOT_FOUND, status: 404 };
  }
  if (run.status !== "active") {
    return { error: ERR_RUN_EXPIRED, status: 409 };
  }
  if (Date.now() - (run.startedAt || 0) > RUN_EXPIRY_MS) {
    run.status = "expired";
    return { error: ERR_RUN_EXPIRED, status: 409 };
  }

  const livesPurchased = Math.max(0, Math.floor(Number(run.livesPurchased) || 0));
  if (livesPurchased >= MAX_LIVES) {
    return { error: ERR_MAX_LIVES, status: 409 };
  }

  const day = utcDayKey();
  let freeLife = false;
  let costPaid = 0;

  if (livesPurchased === 0 && stats.lastFreeRunDay !== day) {
    freeLife = true;
    stats.lastFreeRunDay = day;
  } else {
    const spend = spendSparks(sparksRow, LIFE_COST_KRAPS);
    if (!spend.ok) return { error: spend.error, status: 402 };
    costPaid = spend.spent;
  }

  const now = Date.now();
  run.livesPurchased = livesPurchased + 1;
  run.totalCostPaid = (run.totalCostPaid || 0) + costPaid;
  run.updatedAt = now;
  stats.updatedAt = now;

  return {
    ok: true,
    runId,
    livesPurchased: run.livesPurchased,
    freeLife,
    costPaid,
    balance: sparksRow.fake_sparks_total,
    freeAvailable: stats.lastFreeRunDay !== day,
    config: publicConfig(),
  };
}

function completeSkillSurvivorRun(db, user, body) {
  if (!user) return { error: ERR_SIGN_IN, status: 401 };
  if (!canParticipate(user)) return { error: ERR_LINK_REQUIRED, status: 403 };

  const runId = String(body?.runId || "").trim();
  const durationMs = Math.floor(Number(body?.durationMs) || 0);
  const kills = Math.floor(Number(body?.kills) || 0);
  const pickupScore = Math.floor(Number(body?.pickupScore) || 0);
  const bossBonusScore = Math.floor(Number(body?.bossBonusScore) || 0);

  if (!runId) return { error: ERR_RUN_NOT_FOUND, status: 404 };

  const store = ensureSkillSurvivorDb(db);
  const sparksRow = ensureFakeSparksRecord(db, user);
  const stats = ensureUserStats(store, user);
  const run = store.runs[runId];

  if (!run || run.userId !== user.id) {
    return { error: ERR_RUN_NOT_FOUND, status: 404 };
  }
  if (run.status !== "active") {
    return { error: ERR_RUN_EXPIRED, status: 409 };
  }
  if (Date.now() - (run.startedAt || 0) > RUN_EXPIRY_MS) {
    run.status = "expired";
    return { error: ERR_RUN_EXPIRED, status: 409 };
  }
  if (durationMs < 0 || durationMs > MAX_DURATION_MS + 5000) {
    return { error: ERR_INVALID_SCORE, status: 400 };
  }
  if (durationMs > 0 && durationMs < MIN_DURATION_MS && kills > 12) {
    return { error: ERR_INVALID_SCORE, status: 400 };
  }
  if (kills < 0 || kills > maxPlausibleKills(durationMs, stats.upgrades)) {
    return { error: ERR_INVALID_SCORE, status: 400 };
  }
  if (pickupScore < 0 || pickupScore > maxPlausiblePickupScore(durationMs)) {
    return { error: ERR_INVALID_SCORE, status: 400 };
  }
  if (bossBonusScore < 0 || bossBonusScore > maxPlausibleBossBonus(durationMs)) {
    return { error: ERR_INVALID_SCORE, status: 400 };
  }

  const score = computeScore(durationMs, kills, pickupScore, bossBonusScore);
  const now = Date.now();

  run.status = "completed";
  run.completedAt = now;
  run.durationMs = durationMs;
  run.kills = kills;
  run.score = score;
  run.updatedAt = now;

  let personalBest = false;
  if (score > (stats.bestScore || 0)) {
    stats.bestScore = score;
    stats.bestDurationMs = durationMs;
    stats.bestKills = kills;
    stats.updatedAt = now;
    personalBest = true;
  }

  stats.dailyBest = bumpPeriodBest(stats.dailyBest, utcDayKey(now), score, durationMs, kills, now);
  stats.monthlyBest = bumpPeriodBest(
    stats.monthlyBest,
    utcMonthKey(now),
    score,
    durationMs,
    kills,
    now,
  );

  const runRewards = rewardsForScore(score);
  const granted = grantRewards(sparksRow, runRewards);
  const leaderboards = buildLeaderboards(store, user.id, now);

  return {
    ok: true,
    score,
    durationMs,
    kills,
    pickupScore,
    bossBonusScore,
    personalBest,
    runRewards,
    granted,
    balance: sparksRow.fake_sparks_total,
    myBest: {
      score: stats.bestScore || 0,
      durationMs: stats.bestDurationMs || 0,
      kills: stats.bestKills || 0,
      totalRuns: stats.totalRuns || 0,
    },
    leaderboards,
  };
}

function buySkillSurvivorUpgrade(db, user, body) {
  if (!user) return { error: ERR_SIGN_IN, status: 401 };
  if (!canParticipate(user)) return { error: ERR_LINK_REQUIRED, status: 403 };

  const upgradeId = String(body?.upgradeId || "").trim();
  const item = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
  if (!item) return { error: ERR_UPGRADE_UNKNOWN, status: 400 };

  const store = ensureSkillSurvivorDb(db);
  const sparksRow = ensureFakeSparksRecord(db, user);
  const stats = ensureUserStats(store, user);
  const levels = normalizeUpgrades(stats.upgrades);
  const level = levels[upgradeId];
  const cost = upgradeCostAtLevel(item.costKraps, level);

  const spend = spendSparks(sparksRow, cost);
  if (!spend.ok) return { error: spend.error, status: 402 };

  const now = Date.now();
  levels[upgradeId] = level + 1;
  stats.upgrades = levels;
  stats.updatedAt = now;

  return {
    ok: true,
    upgradeId,
    level: levels[upgradeId],
    costPaid: spend.spent,
    nextCost: upgradeCostAtLevel(item.costKraps, levels[upgradeId]),
    balance: sparksRow.fake_sparks_total,
    upgrades: stats.upgrades,
    upgradeCatalog: publicUpgradeCatalog(),
  };
}

module.exports = {
  GAME_ID,
  ERR_LINK_REQUIRED,
  ERR_SIGN_IN,
  ERR_INSUFFICIENT_KRAPS,
  ERR_RUN_ACTIVE,
  ERR_RUN_NOT_FOUND,
  ERR_RUN_EXPIRED,
  ERR_INVALID_SCORE,
  ERR_MAX_LIVES,
  ERR_UPGRADE_OWNED,
  ERR_UPGRADE_UNKNOWN,
  normalizeSkillSurvivorDb,
  difficultyAt,
  computeScore,
  maxPlausibleKills,
  maxPlausiblePickupScore,
  maxPlausibleBossBonus,
  normalizeUpgrades,
  upgradeLevel,
  upgradeCostAtLevel,
  getUpgradeEffects,
  UPGRADE_CATALOG,
  getSkillSurvivorState,
  startSkillSurvivorRun,
  buySkillSurvivorLife,
  buySkillSurvivorUpgrade,
  completeSkillSurvivorRun,
  publicConfig,
  LIFE_COST_KRAPS,
  MAX_LIVES,
  RUN_REWARD_TIERS,
  DAILY_LEADERBOARD_REWARD_TIERS,
  MONTHLY_LEADERBOARD_REWARD_TIERS,
  utcDayKey,
  utcMonthKey,
  utcDayEndMs,
  utcMonthEndMs,
  buildLeaderboards,
};
