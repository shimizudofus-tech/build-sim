/**
 * KRAPS — parrainage / invitations (max 3, +100 sparks par filleul validé).
 * Stockage : db.referrals[], db.users[userId].pendingReferrerId, champs sur fakeSparksUsers.
 */

const { userLinkStatus, findUserByProviderAccountId } = require("./auth-accounts.cjs");

function fakeSparksLib() {
  return require("./fake-sparks.cjs");
}

const MAX_REFERRALS = 3;
const REFERRAL_REWARD = 100;

const ERR_INVALID = "fake_sparks_referral_invalid";
const ERR_SELF = "fake_sparks_referral_self";
const ERR_ALREADY_REFERRED = "fake_sparks_referral_already_referred";
const ERR_LIMIT = "fake_sparks_referral_limit";
const ERR_SIGN_IN = "fake_sparks_referral_sign_in";

function randomReferralId() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `ref-${Date.now().toString(36)}-${suffix}`;
}

function normalizeReferrals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.referrer_user_id && r.referred_user_id)
    .map((r) => ({
      id: String(r.id || randomReferralId()),
      referrer_user_id: String(r.referrer_user_id),
      referred_user_id: String(r.referred_user_id),
      referred_discord_id: String(r.referred_discord_id || ""),
      referred_telegram_id: String(r.referred_telegram_id || ""),
      reward_given: Boolean(r.reward_given),
      created_at: Number(r.created_at) || Date.now(),
      validated_at: r.validated_at ? Number(r.validated_at) : null,
    }));
}

function ensureReferrals(db) {
  if (!Array.isArray(db.referrals)) db.referrals = [];
}

function normalizeReferrerId(raw) {
  return String(raw || "").trim().slice(0, 128);
}

function resolveReferrerUser(db, referrerIdRaw) {
  const referrerId = normalizeReferrerId(referrerIdRaw);
  if (!referrerId) return null;
  if (db.users[referrerId]) return db.users[referrerId];
  return findUserByProviderAccountId(db, referrerId);
}

function referredHasMinProvider(user) {
  const links = userLinkStatus(user);
  return Boolean(links.discord || links.telegram);
}

function findReferralForReferred(db, referredUserId) {
  ensureReferrals(db);
  return db.referrals.find((r) => r.referred_user_id === referredUserId) || null;
}

function countValidatedReferrals(db, referrerUserId) {
  ensureReferrals(db);
  return db.referrals.filter(
    (r) => r.referrer_user_id === referrerUserId && r.reward_given
  ).length;
}

function syncReferrerReferralStats(db, referrerUser) {
  const row = fakeSparksLib().ensureFakeSparksRecord(db, referrerUser);
  if (!row) return null;
  row.referral_code = row.referral_code || referrerUser.id;
  row.referral_count = countValidatedReferrals(db, referrerUser.id);
  row.referral_rewards_total = db.referrals
    .filter((r) => r.referrer_user_id === referrerUser.id && r.reward_given)
    .reduce((sum) => sum + REFERRAL_REWARD, 0);
  row.updated_at = Date.now();
  return row;
}

function getReferralPublicState(db, user) {
  const max = MAX_REFERRALS;
  const rewardPerInvite = REFERRAL_REWARD;
  if (!user) {
    return {
      referralCode: "",
      invitePath: "",
      used: 0,
      max,
      rewardPerInvite,
      limitReached: false,
      canInvite: false,
    };
  }
  const used = countValidatedReferrals(db, user.id);
  return {
    referralCode: user.id,
    invitePath: `?ref=${encodeURIComponent(user.id)}`,
    used,
    max,
    rewardPerInvite,
    limitReached: used >= max,
    canInvite: used < max,
    rewardsTotal: (() => {
      const row = db.fakeSparksUsers?.[user.id];
      return Number(row?.referral_rewards_total) || used * REFERRAL_REWARD;
    })(),
  };
}

function clearPendingReferrer(referredUser) {
  if (!referredUser) return;
  referredUser.pendingReferrerId = "";
}

function tryValidateReferralForUser(db, referredUser) {
  if (!referredUser?.id) return { validated: false };
  if (!referredHasMinProvider(referredUser)) return { validated: false };

  const referrerUser = resolveReferrerUser(db, referredUser.pendingReferrerId);
  if (!referrerUser) {
    clearPendingReferrer(referredUser);
    db.users[referredUser.id] = referredUser;
    return { validated: false, reason: ERR_INVALID };
  }
  const referrerId = referrerUser.id;

  ensureReferrals(db);

  if (referrerId === referredUser.id) {
    clearPendingReferrer(referredUser);
    db.users[referredUser.id] = referredUser;
    return { validated: false, reason: ERR_SELF };
  }

  if (findReferralForReferred(db, referredUser.id)) {
    clearPendingReferrer(referredUser);
    db.users[referredUser.id] = referredUser;
    return { validated: false, reason: ERR_ALREADY_REFERRED };
  }

  if (countValidatedReferrals(db, referrerId) >= MAX_REFERRALS) {
    clearPendingReferrer(referredUser);
    db.users[referredUser.id] = referredUser;
    return { validated: false, reason: ERR_LIMIT };
  }

  const now = Date.now();
  const referral = {
    id: randomReferralId(),
    referrer_user_id: referrerId,
    referred_user_id: referredUser.id,
    referred_discord_id: fakeSparksLib().providerId(referredUser, "discord"),
    referred_telegram_id: fakeSparksLib().providerId(referredUser, "telegram"),
    reward_given: true,
    created_at: now,
    validated_at: now,
  };
  db.referrals.push(referral);

  const lib = fakeSparksLib();
  const referrerRow = lib.ensureFakeSparksRecord(db, referrerUser);
  const { gain, firstEarn } = lib.addSparks(referrerRow, REFERRAL_REWARD);
  syncReferrerReferralStats(db, referrerUser);

  clearPendingReferrer(referredUser);
  db.users[referredUser.id] = referredUser;

  return {
    validated: true,
    gain,
    firstEarn,
    referrerId,
    referralId: referral.id,
  };
}

function applyReferralAfterAuth(db, user) {
  if (!user) return { validated: false };
  return tryValidateReferralForUser(db, user);
}

function setPendingReferrer(db, referredUser, referrerIdRaw) {
  if (!referredUser) {
    return { error: ERR_SIGN_IN, status: 401 };
  }
  const referrerUser = resolveReferrerUser(db, referrerIdRaw);
  if (!referrerUser) {
    return { error: ERR_INVALID, status: 400 };
  }
  const referrerId = referrerUser.id;
  if (referrerId === referredUser.id) {
    return { error: ERR_SELF, status: 400 };
  }
  if (findReferralForReferred(db, referredUser.id)) {
    return { error: ERR_ALREADY_REFERRED, status: 409 };
  }
  if (countValidatedReferrals(db, referrerId) >= MAX_REFERRALS) {
    return { error: ERR_LIMIT, status: 409 };
  }

  referredUser.pendingReferrerId = referrerId;
  db.users[referredUser.id] = referredUser;

  const validation = tryValidateReferralForUser(db, referredUser);
  return {
    ok: true,
    referrals: getReferralPublicState(db, referredUser),
    validation,
  };
}

module.exports = {
  MAX_REFERRALS,
  REFERRAL_REWARD,
  ERR_INVALID,
  ERR_SELF,
  ERR_ALREADY_REFERRED,
  ERR_LIMIT,
  ERR_SIGN_IN,
  normalizeReferrals,
  ensureReferrals,
  getReferralPublicState,
  setPendingReferrer,
  tryValidateReferralForUser,
  applyReferralAfterAuth,
  countValidatedReferrals,
  resolveReferrerUser,
};
