/**
 * KRAPS — airdrop communautaire fun (sans lien officiel Spekter Agency).
 * Stockage : db.fakeSparksUsers[userId]
 */

const { userLinkStatus, ensureLinkedIds } = require("./auth-accounts.cjs");
const {
  getReferralPublicState,
  tryValidateReferralForUser,
  setPendingReferrer,
  applyReferralAfterAuth,
  REFERRAL_REWARD,
  MAX_REFERRALS,
} = require("./fake-sparks-referrals.cjs");

/** Segments roue (poids / 10 000 = %). Somme = 10 000 (100 %). */
const WHEEL_SEGMENTS = [
  { id: "fs1",    label: "+1",   sparks: 1,   weight: 4000 },
  { id: "fs2",    label: "+2",   sparks: 2,   weight: 3000 },
  { id: "fs3",    label: "+3",   sparks: 3,   weight: 1500 },
  { id: "fs5",    label: "+5",   sparks: 5,   weight: 1000 },
  { id: "fs10",   label: "+10",  sparks: 10,  weight: 400  },
  { id: "fs_lost",label: "Rien", sparks: 0,   weight: 100  },
];

const DAILY_SPARKS_REWARD = 1;
const LEADERBOARD_LIMIT = 50;

function utcDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function normalizeFakeSparksUsers(raw) {
  if (!raw || typeof raw !== "object") return {};
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.filter((r) => r?.user_id).map((r) => [r.user_id, r]));
  }
  return raw;
}

function providerId(user, provider) {
  ensureLinkedIds(user);
  const linked = user.linkedIds?.[provider] || "";
  if (!linked) return "";
  const prefix = `${provider}:`;
  return linked.startsWith(prefix) ? linked.slice(prefix.length) : linked;
}

function pickAvatar(user) {
  return String(user.customAvatarUrl || user.avatarUrl || "").trim().slice(0, 512);
}

function ensureFakeSparksRecord(db, user) {
  if (!user?.id) return null;
  if (!db.fakeSparksUsers || typeof db.fakeSparksUsers !== "object") {
    db.fakeSparksUsers = {};
  }
  const now = Date.now();
  let row = db.fakeSparksUsers[user.id];
  if (!row) {
    row = {
      user_id: user.id,
      discord_id: "",
      telegram_id: "",
      username: "",
      avatar_url: "",
      fake_sparks_total: 0,
      last_daily_claim: "",
      last_wheel_spin: "",
      disclaimer_ack: false,
      referral_code: user.id,
      referral_count: 0,
      referral_rewards_total: 0,
      created_at: now,
      updated_at: now,
    };
    db.fakeSparksUsers[user.id] = row;
  }
  row.discord_id = providerId(user, "discord");
  row.telegram_id = providerId(user, "telegram");
  row.username = String(user.displayName || "Player").trim().slice(0, 80);
  row.avatar_url = pickAvatar(user);
  row.fake_sparks_total = Math.max(0, Math.floor(Number(row.fake_sparks_total) || 0));
  row.referral_code = String(row.referral_code || user.id).slice(0, 128);
  row.referral_count = Math.max(0, Math.floor(Number(row.referral_count) || 0));
  row.referral_rewards_total = Math.max(0, Math.floor(Number(row.referral_rewards_total) || 0));
  row.updated_at = now;
  return row;
}

function canParticipate(user) {
  if (!user) return false;
  const links = userLinkStatus(user);
  return Boolean(links.discord || links.telegram);
}

const ERR_LINK_REQUIRED = "fake_sparks_link_required";
const ERR_DAILY_CLAIMED = "fake_sparks_daily_claimed";
const ERR_WHEEL_SPUN = "fake_sparks_wheel_spun";

function participationError() {
  return ERR_LINK_REQUIRED;
}

function pickWheelSegment() {
  const total = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const seg of WHEEL_SEGMENTS) {
    roll -= seg.weight;
    if (roll <= 0) return seg;
  }
  return WHEEL_SEGMENTS[0];
}

function addSparks(row, amount) {
  const before = row.fake_sparks_total;
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  row.fake_sparks_total = before + gain;
  row.updated_at = Date.now();
  const firstEarn = before === 0 && row.fake_sparks_total > 0;
  return { gain, firstEarn };
}

function publicWheelConfig() {
  return WHEEL_SEGMENTS.map(({ id, label, sparks, weight }) => ({ id, label, sparks, weight }));
}

function publicRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    fakeSparksTotal: row.fake_sparks_total,
    lastDailyClaim: row.last_daily_claim || "",
    lastWheelSpin: row.last_wheel_spin || "",
    disclaimerAck: Boolean(row.disclaimer_ack),
  };
}

function buildLeaderboard(db, userId) {
  const rows = Object.values(db.fakeSparksUsers || {})
    .filter((r) => r && (r.fake_sparks_total || 0) > 0)
    .sort((a, b) => {
      const diff = (b.fake_sparks_total || 0) - (a.fake_sparks_total || 0);
      if (diff !== 0) return diff;
      return (a.updated_at || 0) - (b.updated_at || 0);
    });

  const entries = rows.slice(0, LEADERBOARD_LIMIT).map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    username: row.username || "Player",
    avatarUrl: row.avatar_url || "",
    fakeSparksTotal: row.fake_sparks_total || 0,
  }));

  let myRank = null;
  if (userId) {
    const idx = rows.findIndex((r) => r.user_id === userId);
    if (idx >= 0) {
      myRank = {
        rank: idx + 1,
        fakeSparksTotal: rows[idx].fake_sparks_total || 0,
      };
    }
  }

  return { entries, myRank, totalPlayers: rows.length };
}

function missionStatus(row) {
  const day = utcDayKey();
  return {
    daily: {
      reward: DAILY_SPARKS_REWARD,
      claimedToday: Boolean(row?.last_daily_claim && row.last_daily_claim === day),
    },
    wheel: {
      canSpin: Boolean(row && row.last_wheel_spin !== day),
      segments: publicWheelConfig(),
    },
    miniGame: {
      status: "live",
      enabled: true,
      gameId: "skill-survivor",
    },
  };
}

function getFakeSparksState(db, user) {
  const eligible = canParticipate(user);
  const row = user ? ensureFakeSparksRecord(db, user) : null;
  if (user) tryValidateReferralForUser(db, user);
  const leaderboard = buildLeaderboard(db, user?.id || "");
  return {
    eligible,
    participationMessage: eligible ? "" : ERR_LINK_REQUIRED,
    me: row ? publicRow(row) : null,
    missions: missionStatus(row),
    leaderboard,
    referrals: getReferralPublicState(db, user),
    config: {
      dailyReward: DAILY_SPARKS_REWARD,
      wheel: publicWheelConfig(),
      referralReward: REFERRAL_REWARD,
      referralMax: MAX_REFERRALS,
    },
  };
}

function registerReferralPending(db, user, referrerId) {
  return setPendingReferrer(db, user, referrerId);
}

function claimDaily(db, user) {
  if (!canParticipate(user)) {
    return { error: ERR_LINK_REQUIRED, status: 403 };
  }
  const row = ensureFakeSparksRecord(db, user);
  const day = utcDayKey();
  if (row.last_daily_claim === day) {
    return { error: ERR_DAILY_CLAIMED, status: 409 };
  }
  row.last_daily_claim = day;
  const { gain, firstEarn } = addSparks(row, DAILY_SPARKS_REWARD);
  const showDisclaimer = firstEarn && !row.disclaimer_ack;
  return {
    ok: true,
    gain,
    showDisclaimer,
    me: publicRow(row),
    missions: missionStatus(row),
  };
}

function spinWheel(db, user) {
  if (!canParticipate(user)) {
    return { error: ERR_LINK_REQUIRED, status: 403 };
  }
  const row = ensureFakeSparksRecord(db, user);
  const day = utcDayKey();
  if (row.last_wheel_spin === day) {
    return { error: ERR_WHEEL_SPUN, status: 409 };
  }
  const segment = pickWheelSegment();
  row.last_wheel_spin = day;
  const { gain, firstEarn } = addSparks(row, segment.sparks);
  const showDisclaimer = firstEarn && !row.disclaimer_ack;
  return {
    ok: true,
    segment: { id: segment.id, label: segment.label, sparks: segment.sparks },
    gain,
    showDisclaimer,
    me: publicRow(row),
    missions: missionStatus(row),
  };
}

function acknowledgeDisclaimer(db, user) {
  if (!user) return { error: "Sign in required.", status: 401 };
  const row = ensureFakeSparksRecord(db, user);
  row.disclaimer_ack = true;
  row.updated_at = Date.now();
  return { ok: true, me: publicRow(row) };
}

module.exports = {
  ERR_LINK_REQUIRED,
  ERR_DAILY_CLAIMED,
  ERR_WHEEL_SPUN,
  WHEEL_SEGMENTS,
  DAILY_SPARKS_REWARD,
  LEADERBOARD_LIMIT,
  normalizeFakeSparksUsers,
  canParticipate,
  getFakeSparksState,
  claimDaily,
  spinWheel,
  acknowledgeDisclaimer,
  registerReferralPending,
  applyReferralAfterAuth,
  ensureFakeSparksRecord,
  addSparks,
  providerId,
  publicWheelConfig,
};
