import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
let h = fs.readFileSync(file, "utf8");

const pairs = [
  ['aria-label="Site visit counter">Visits: 0', 'data-i18n-aria-label="nav.visitsAria">Visits: 0'],
  ['<nav class="app-nav" aria-label="Navigation">', '<nav class="app-nav" data-i18n-aria-label="nav.aria">'],
  ['<span class="app-nav-main">Build</span>', '<span class="app-nav-main" data-i18n="nav.buildMain">Build</span>'],
  ['<span class="app-nav-sub">Simulator</span>', '<span class="app-nav-sub" data-i18n="nav.buildSub">Simulator</span>'],
  ['<span class="app-nav-main">Community</span>', '<span class="app-nav-main" data-i18n="nav.communityMain">Community</span>'],
  ['<span class="app-nav-sub">Rankings</span>', '<span class="app-nav-sub" data-i18n="nav.communitySub">Rankings</span>'],
  ['<span class="app-nav-main">Book</span>', '<span class="app-nav-main" data-i18n="nav.bookMain">Book</span>'],
  ['<span class="app-nav-sub">Recipes</span>', '<span class="app-nav-sub" data-i18n="nav.bookSub">Recipes</span>'],
  ['<span class="app-nav-main">Mini Games</span>', '<span class="app-nav-main" data-i18n="nav.miniGamesMain">Mini Games</span>'],
  ['<span class="app-nav-sub">Soon</span>', '<span class="app-nav-sub" data-i18n="nav.miniGamesSub">Soon</span>'],
  ['title="Coming soon"', 'data-i18n-title="nav.comingSoon" title="Coming soon"'],
  ['<aside class="profile-widget" aria-label="Profile">', '<aside class="profile-widget" data-i18n-aria-label="profile.aria">'],
  ['title="Profile"', 'data-i18n-title="profile.title" title="Profile"'],
  ['aria-label="Change profile picture"', 'data-i18n-aria-label="profile.changeAvatar" aria-label="Change profile picture"'],
  ['<span class="profile-button-main">Sign in</span>', '<span class="profile-button-main" data-i18n="profile.signIn">Sign in</span>'],
  ['<span class="profile-button-sub">Community account</span>', '<span class="profile-button-sub" data-i18n="profile.communityAccount">Community account</span>'],
  ['aria-label="XP and energy preview (coming soon)"', 'data-i18n-aria-label="profile.xpPreviewAria" aria-label="XP and energy preview (coming soon)"'],
  ['<span class="player-progress-badge">Coming soon</span>', '<span class="player-progress-badge" data-i18n="profile.comingSoon">Coming soon</span>'],
  ['<span>Lv <strong>1</strong></span>', '<span data-i18n="profile.level">Lv</span> <strong>1</strong>'],
  ['title="Energy preview">⚡ 30/30', 'data-i18n-title="profile.energyPreview" title="Energy preview">⚡ 30/30'],
  ['aria-label="XP preview"', 'data-i18n-aria-label="profile.xpPreview" aria-label="XP preview"'],
  ['<p class="player-progress-label">0 / 100 XP</p>', '<p class="player-progress-label" data-i18n="profile.xpLabel">0 / 100 XP</p>'],
  ['<p id="profileName" class="profile-name">Not signed in</p>', '<p id="profileName" class="profile-name" data-i18n="profile.notSignedIn">Not signed in</p>'],
  ['<p id="profileMeta" class="profile-meta">Sign in to publish, vote, delete, or set your avatar.</p>', '<p id="profileMeta" class="profile-meta" data-i18n="profile.signInMeta">Sign in to publish, vote, delete, or set your avatar.</p>'],
  ['<h2 id="authModalTitle" class="auth-modal-title">Sign in to use community features</h2>', '<h2 id="authModalTitle" class="auth-modal-title" data-i18n="auth.title">Sign in to use community features</h2>'],
  ['aria-label="Close sign-in popup"', 'data-i18n-aria-label="auth.close" aria-label="Close sign-in popup"'],
  ['<aside id="liveChat" class="live-chat" aria-label="Community live chat"', '<aside id="liveChat" class="live-chat" data-i18n-aria-label="chat.aria"'],
  ['<span class="live-chat-badge">CHAT</span>', '<span class="live-chat-badge" data-i18n="chat.badge">CHAT</span>'],
  ['<span class="live-chat-title-vertical">Live chat</span>', '<span class="live-chat-title-vertical" data-i18n="chat.title">Live chat</span>'],
  ['<h2>Live chat</h2>', '<h2 data-i18n="chat.title">Live chat</h2>'],
  ['<button type="button" id="liveChatRefresh" class="secondary live-chat-refresh">Refresh</button>', '<button type="button" id="liveChatRefresh" class="secondary live-chat-refresh" data-i18n="chat.refresh">Refresh</button>'],
  ['<button type="submit" id="liveChatSend" disabled>Send</button>', '<button type="submit" id="liveChatSend" disabled data-i18n="chat.send">Send</button>'],
  ['<aside class="support-banner" aria-label="Support">', '<aside class="support-banner" data-i18n-aria-label="support.aria">'],
  ['>Play Spekter Agency</a', ' data-i18n="support.playGame">Play Spekter Agency</a'],
  ['<label for="supportWallet">TON blockchain</label>', '<label for="supportWallet" data-i18n="support.ton">TON blockchain</label>'],
  ['<label>Telegram</label>', '<label data-i18n="support.telegram">Telegram</label>'],
  ['<label>Discord</label>', '<label data-i18n="support.discord">Discord</label>'],
  ['<label for="character">Character</label>', '<label for="character" data-i18n="builder.character">Character</label>'],
  ['<label for="mode">Game mode</label>', '<label for="mode" data-i18n="builder.gameMode">Game mode</label>'],
  ['<option value="stage">Stage (5 slots)</option>', '<option value="stage" data-i18n="builder.modeStage">Stage (5 slots)</option>'],
  ['<option value="boss">Boss (5 slots)</option>', '<option value="boss" data-i18n="builder.modeBoss">Boss (5 slots)</option>'],
  ['<option value="abyss">Abyss (6 slots)</option>', '<option value="abyss" data-i18n="builder.modeAbyss">Abyss (6 slots)</option>'],
  ['id="reset">Reset build</button>', 'id="reset" data-i18n="builder.reset">Reset build</button>'],
  ['id="undo" disabled>Undo last fusion</button>', 'id="undo" disabled data-i18n="builder.undoFusion">Undo last fusion</button>'],
  ['<h2>Community builds</h2>', '<h2 data-i18n="community.title">Community builds</h2>'],
  ['<h2>EVO — skill + passive</h2>', '<h2 data-i18n="book.evoTitle">EVO — skill + passive</h2>'],
  ['<h2>Mythics — EVO pairs</h2>', '<h2 data-i18n="book.mythicTitle">Mythics — EVO pairs</h2>'],
];

for (const [from, to] of pairs) {
  if (h.includes(from) && !h.includes(to)) h = h.split(from).join(to);
}

if (!h.includes("assets/i18n.js")) {
  h = h.replace("  <script>\n    const SPRITE", '  <script src="assets/i18n.js"></script>\n  <script>\n    const SPRITE');
}

const scriptInject = `    const t = (key, params) => window.I18n.t(key, params);
    const translateApiError = (msg) => window.I18n.translateApiError(msg);
    const localeTag = () => window.I18n.bcp47;
    function refreshI18nUi() {
      if (visitCounterEl) updateVisitCounter();
      renderProfile();
      syncCommunityDifficultyOptions();
      renderCommunityBuilds();
      renderSlots();
      renderPlanner();
      renderBestBuilds();
      updateLiveChatUi();
      if (typeof updateBuildLevelCounter === "function") updateBuildLevelCounter();
    }
    window.I18n.onChange(() => refreshI18nUi());

`;

if (!h.includes("const t = (key, params)")) {
  h = h.replace("    const SPRITE = ", scriptInject + "    const SPRITE = ");
}

// modeLabel
h = h.replace(
  `    function modeLabel(modeId = modeEl?.value) {
      return modeConfig(modeId).label;
    }`,
  `    function modeLabel(modeId = modeEl?.value) {
      const id = modeId || modeEl?.value || "stage";
      return t(\`mode.\${id}\`);
    }`,
);

// COMMUNITY_DIFFICULTIES
h = h.replace(
  `    const COMMUNITY_DIFFICULTIES = [
      ["", "Not rated"],
      ["very_easy", "Very easy"],
      ["easy", "Easy"],
      ["medium", "Medium"],
      ["hard", "Hard"],
      ["very_hard", "Very hard"],
    ];`,
  `    const COMMUNITY_DIFFICULTY_KEYS = [
      ["", "difficulty.notRated"],
      ["very_easy", "difficulty.veryEasy"],
      ["easy", "difficulty.easy"],
      ["medium", "difficulty.medium"],
      ["hard", "difficulty.hard"],
      ["very_hard", "difficulty.veryHard"],
    ];
    function communityDifficultyLabel(value) {
      const row = COMMUNITY_DIFFICULTY_KEYS.find(([v]) => v === value);
      return row ? t(row[1]) : value;
    }
    const COMMUNITY_DIFFICULTIES = COMMUNITY_DIFFICULTY_KEYS.map(([v, k]) => [v, k]);`,
);

// Fix COMMUNITY_DIFFICULTY_LABELS usage - was Map of value->label, now keys
h = h.replace(
  `    const COMMUNITY_DIFFICULTY_LABELS = new Map(COMMUNITY_DIFFICULTIES);`,
  `    function communityDifficultyLabelsMap() {
      return new Map(COMMUNITY_DIFFICULTY_KEYS.map(([v, k]) => [v, t(k)]));
    }`,
);

// Grep for COMMUNITY_DIFFICULTY_LABELS usage
// Replace with communityDifficultyLabel(id) or communityDifficultyLabelsMap()

h = h.replace(/COMMUNITY_DIFFICULTY_LABELS\.get\(/g, "communityDifficultyLabelsMap().get(");

// updateVisitCounter
h = h.replace(
  `visitCounterEl.textContent = \`Visits: \${Number(data.visits || 0).toLocaleString("en-US")}\`;`,
  `visitCounterEl.textContent = t("nav.visits", { count: Number(data.visits || 0).toLocaleString(localeTag()) });`,
);
h = h.replace(
  `visitCounterEl.textContent = \`Visits: \${count.toLocaleString("en-US")}\`;`,
  `visitCounterEl.textContent = t("nav.visits", { count: count.toLocaleString(localeTag()) });`,
);

// bootstrap wrap
h = h.replace(
  `      loadIconCacheVer().then(() => {
        initMarketWidgets();
        updateVisitCounter();
        resetBuildSlots();
        bindAppTabs();
        bindSupportCopy();
        bindProfileMenu();
        bindLiveChat();
        bindCommunityBuilds();
        bindPlanner();
        bindPickerClicks();
        bindStarClicks();
        loadAuthState();
        renderBestBuilds();
        renderSlots();
        onUpdate();
        checkGamePngAssets();
        const ch = currentCharacter();
        showPassiveHint(
          \`\${ch.label} — \${skillLabel(ch.exclusiveSkill)} required (not removable). ★3 + passive → click EVO if you want.\`
        );
      });`,
  `      window.I18n.init().then(() => {
        loadIconCacheVer().then(() => {
          initMarketWidgets();
          updateVisitCounter();
          resetBuildSlots();
          bindAppTabs();
          bindSupportCopy();
          bindProfileMenu();
          bindLiveChat();
          bindCommunityBuilds();
          bindPlanner();
          bindPickerClicks();
          bindStarClicks();
          loadAuthState();
          renderBestBuilds();
          renderSlots();
          onUpdate();
          checkGamePngAssets();
          const ch = currentCharacter();
          showPassiveHint(
            t("hint.startingSkillStars", { hero: ch.label, skill: skillLabel(ch.exclusiveSkill) })
          );
        });
      });`,
);

// fatal error
h = h.replace(
  `      fatal.textContent =
        "HTML structure error: build / EVO areas not found. Reload the page (Ctrl+F5).";`,
  `      fatal.textContent = t("fatal.htmlStructure");`,
);

// syncCommunityDifficultyOptions - add function if builder select exists
if (!h.includes("function syncCommunityDifficultyOptions")) {
  h = h.replace(
    `    function communityDifficultyLabel(value) {`,
    `    function syncCommunityDifficultyOptions() {
      const sel = document.getElementById("builderCommunityDifficulty");
      if (!sel) return;
      for (const opt of sel.options) {
        const row = COMMUNITY_DIFFICULTY_KEYS.find(([v]) => v === opt.value);
        if (row) opt.textContent = t(row[1]);
      }
    }
    function communityDifficultyLabel(value) {`,
  );
}

fs.writeFileSync(file, h);
console.log("patched index.html");
