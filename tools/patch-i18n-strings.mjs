import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
let h = fs.readFileSync(file, "utf8");

const reps = [
  ['showPassiveHint("Sign in first, then link Telegram.")', 'showPassiveHint(t("profile.signInFirstTelegram"))'],
  ['profileStatusEl.textContent = "Linking Telegram..."', 'profileStatusEl.textContent = t("profile.linkingTelegram")'],
  ['showPassiveHint("Telegram linked. Any older separate login was merged into this profile.")', 'showPassiveHint(t("profile.telegramLinked"))'],
  ['openAuthModal("Sign in to change your profile picture.")', 'openAuthModal(t("profile.signInForAvatar"))'],
  ['showPassiveHint("Sign in requires the site server (not file://).")', 'showPassiveHint(t("profile.signInRequiresServer"))'],
  ['authModalStatusEl.textContent = "Connecting with Telegram..."', 'authModalStatusEl.textContent = t("profile.connectingTelegram")'],
  ['showPassiveHint("Signed in with Telegram.")', 'showPassiveHint(t("profile.signedInTelegram"))'],
  ['showPassiveHint("Discord linked. Any older separate login was merged into this profile.")', 'showPassiveHint(t("profile.discordLinked"))'],
  ['showPassiveHint("Signed out.")', 'showPassiveHint(t("profile.signedOut"))'],
  ['showPassiveHint("Avatar must be PNG, JPG, or WebP.")', 'showPassiveHint(t("profile.avatarType"))'],
  ['showPassiveHint("Avatar must be 1 MB or smaller.")', 'showPassiveHint(t("profile.avatarSize"))'],
  ['showPassiveHint("Avatar updated.")', 'showPassiveHint(t("profile.avatarUpdated"))'],
  ['showPassiveHint(err.message || "Avatar upload failed.")', 'showPassiveHint(translateApiError(err.message) || t("profile.avatarUploadFailed"))'],
  ['liveChatStatusEl.textContent = "Loading messages..."', 'liveChatStatusEl.textContent = t("chat.loadingMessages")'],
  ['liveChatStatusEl.textContent = "Live chat unavailable."', 'liveChatStatusEl.textContent = t("chat.unavailable")'],
  ['showPassiveHint("Best theoretical build applied.")', 'showPassiveHint(t("hint.bestBuildApplied"))'],
  ['showPassiveHint("Unable to save builds in this browser.")', 'showPassiveHint(t("community.unableSaveBrowser"))'],
  ['showPassiveHint("Community build applied.")', 'showPassiveHint(t("community.applied"))'],
  ['showPassiveHint("Create a build before publishing it.")', 'showPassiveHint(t("community.createBeforePublish"))'],
  ['showPassiveHint("You already voted for this build.")', 'showPassiveHint(t("community.alreadyVoted"))'],
  ['showPassiveHint("Build deleted.")', 'showPassiveHint(t("community.deleted"))'],
  ['showPassiveHint("This passive is already used.")', 'showPassiveHint(t("hint.duplicatePassive"))'],
  ['profileMainEl.textContent = currentUser ? displayName : "Sign in"', 'profileMainEl.textContent = currentUser ? displayName : t("profile.signIn")'],
  ['profileSubEl.textContent = currentUser ? "Profile" : "Community account"', 'profileSubEl.textContent = currentUser ? t("profile.title") : t("profile.communityAccount")'],
  ['profileButtonEl.title = currentUser ? `Signed in as ${displayName}` : "Sign in"', 'profileButtonEl.title = currentUser ? t("profile.signedInAs", { name: displayName }) : t("profile.signIn")'],
  ['profileNameEl.textContent = currentUser ? displayName : "Not signed in"', 'profileNameEl.textContent = currentUser ? displayName : t("profile.notSignedIn")'],
  ['profileMetaEl.textContent = "Sign in to publish, vote, delete, or set your avatar."', 'profileMetaEl.textContent = t("profile.signInMeta")'],
  ['<button type="button" data-auth-action="logout">Logout</button>', '<button type="button" data-auth-action="logout">${t("profile.logout")}</button>'],
  ['builderSaveCommunityBuildEl.textContent = API_ENABLED && !currentUser ? "Sign in to publish" : "Publish current build"', 'builderSaveCommunityBuildEl.textContent = API_ENABLED && !currentUser ? t("builder.signInToPublish") : t("builder.publish")'],
  ['const message = `Sign in to ${action}.`', 'const message = t("profile.signInToAction", { action })'],
  ['displayName = currentUser?.displayName || "Guest"', 'displayName = currentUser?.displayName || t("profile.guest")'],
  ['lbl.textContent = "EVO ✓"', 'lbl.textContent = t("slot.evoDone")'],
  ['lbl.textContent = "Mythic ✓"', 'lbl.textContent = t("slot.mythicDone")'],
  ['lbl.textContent = "EVO ?"', 'lbl.textContent = t("slot.evoPending")'],
  ['floorEl.textContent = "Unavailable"', 'floorEl.textContent = t("market.unavailable")'],
  ['supplyEl.textContent = "Unavailable"', 'supplyEl.textContent = t("market.unavailable")'],
  ['ownersEl.textContent = "Unavailable"', 'ownersEl.textContent = t("market.unavailable")'],
  ['updatedEl.textContent = "Open Getgems"', 'updatedEl.textContent = t("market.openGetgemsLink")'],
  ['if (priceEl) priceEl.textContent = "Unavailable"', 'if (priceEl) priceEl.textContent = t("market.unavailable")'],
  ['updatedEl.textContent = "CoinGecko unavailable"', 'updatedEl.textContent = t("market.coinGeckoUnavailable")'],
  ['return `${number.toLocaleString("en-US",', 'return `${number.toLocaleString(localeTag(),'],
  ['toLocaleString("en-US")', 'toLocaleString(localeTag())'],
  ['toLocaleTimeString("en-US"', 'toLocaleTimeString(localeTag()'],
];

for (const [a, b] of reps) {
  if (h.includes(a)) h = h.split(a).join(b);
}

// auth provider buttons
h = h.replace(
  `function authProviderButtonsHtml() {
      const discordBtn = \`<button type="button" class="auth-discord-button" data-auth-provider="discord"\${authProviders.discord ? "" : " disabled"}>Sign in with Discord\${authProviders.discord ? "" : " (not configured)"}</button>\`;
      const telegramBlock = authProviders.telegram
        ? \`<motion class="auth-telegram-login" aria-label="Sign in with Telegram"></div>\`
        : \`<button type="button" class="auth-telegram-pending" disabled>Telegram (not configured)</button>\`;
      return \`\${discordBtn}\${telegramBlock}\`;
    }`,
  `function authProviderButtonsHtml() {
      const discordBtn = \`<button type="button" class="auth-discord-button" data-auth-provider="discord"\${authProviders.discord ? "" : " disabled"}>\${authProviders.discord ? t("profile.signInDiscord") : t("profile.signInDiscordUnavailable")}</button>\`;
      const telegramBlock = authProviders.telegram
        ? \`<div class="auth-telegram-login" data-i18n-aria-label="profile.signInTelegram"></motion>\`
        : \`<button type="button" class="auth-telegram-pending" disabled>\${t("profile.signInTelegramUnavailable")}</button>\`;
      return \`\${discordBtn}\${telegramBlock}\`;
    }`,
);

fs.writeFileSync(file, h);
console.log("string patches done");
