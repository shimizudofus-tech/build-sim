import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
let h = fs.readFileSync(file, "utf8");

function rep(from, to) {
  if (!h.includes(from)) return false;
  h = h.split(from).join(to);
  return true;
}

const html = [
  ['<motion class="market-cluster" aria-label="Market widgets">', '<div class="market-cluster" data-i18n-aria-label="market.widgetsAria">'],
  ['aria-label="Open Getgems collection"', 'data-i18n-aria-label="market.openGetgems" aria-label="Open Getgems collection"'],
  ['<span class="market-title"><span class="market-live" aria-hidden="true"></span>Getgems collection</span>', '<span class="market-title"><span class="market-live" aria-hidden="true"></span><span data-i18n="market.getgemsTitle">Getgems collection</span></span>'],
  ['<span class="market-line">Floor: <strong', '<span class="market-line"><span data-i18n="market.floor">Floor:</span> <strong'],
  ['<span class="market-line">\n              Supply: <strong', '<span class="market-line">\n              <span data-i18n="market.supply">Supply:</span> <strong'],
  ['              / Owners: <strong', '              <span data-i18n="market.owners">/ Owners:</span> <strong'],
  ['id="collectionMarketUpdated">Live</span>', 'id="collectionMarketUpdated" data-i18n="market.live">Live</span>'],
  ['aria-label="Open Astar on CoinMarketCap"', 'data-i18n-aria-label="market.openAstar" aria-label="Open Astar on CoinMarketCap"'],
  ['<span class="market-title"><span class="market-live" aria-hidden="true"></span>Astar market</span>', '<span class="market-title"><span class="market-live" aria-hidden="true"></span><span data-i18n="market.astarTitle">Astar market</span></span>'],
  ['<span class="market-line">ASTR: <strong', '<span class="market-line"><span data-i18n="market.astr">ASTR:</span> <strong'],
  ['id="astarMarketUpdated">Live</span>', 'id="astarMarketUpdated" data-i18n="market.live">Live</span>'],
  ['<span class="market-line"><strong>$SPEK: TBA</strong></span>', '<span class="market-line"><strong data-i18n="market.spekTba">$SPEK: TBA</strong></span>'],
  ['aria-label="Current build level">Build level: 0', 'data-i18n-aria-label="builder.buildLevelAria" aria-label="Current build level">Build level: 0'],
  ['aria-label="Available mythics"', 'data-i18n-aria-label="builder.mythicsAria" aria-label="Available mythics"'],
  ['<h2>Mythic available</h2>', '<h2 data-i18n="builder.mythicAvailable">Mythic available</h2>'],
  ['<p class="hint">Click to fuse (2 EVO → mythic in an upper slot).</p>', '<p class="hint" data-i18n="builder.mythicHint">Click to fuse (2 EVO → mythic in an upper slot).</p>'],
  ['<div class="build-row-label">Active Skill</motion>', '<motion class="build-row-label" data-i18n="builder.activeSkill">Active Skill</div>'],
  ['<div class="build-row-label">Passive Skill</div>', '<div class="build-row-label" data-i18n="builder.passiveSkill">Passive Skill</motion>'],
  ['aria-label="Build skills"', 'data-i18n-aria-label="builder.buildSkillsAria" aria-label="Build skills"'],
  ['aria-label="Build passives"', 'data-i18n-aria-label="builder.buildPassivesAria" aria-label="Build passives"'],
  ['aria-label="Skills"', 'data-i18n-aria-label="builder.skillsAria" aria-label="Skills"'],
  ['aria-label="Passives"', 'data-i18n-aria-label="builder.passivesAria" aria-label="Passives"'],
  ['aria-label="Quick build planner"', 'data-i18n-aria-label="builder.plannerAria" aria-label="Quick build planner"'],
  ['<h2>Quick build planner</h2>', '<h2 data-i18n="builder.plannerTitle">Quick build planner</h2>'],
  ['aria-label="Best theoretical build"', 'data-i18n-aria-label="builder.bestBuildAria" aria-label="Best theoretical build"'],
  ['<h2 id="bestBuildTitle">Best theoretical build</h2>', '<h2 id="bestBuildTitle" data-i18n="builder.bestBuildTitle">Best theoretical build</h2>'],
  ['<h2 class="visually-hidden">EVO in the build</h2>', '<h2 class="visually-hidden" data-i18n="builder.evoHidden">EVO in the build</h2>'],
  ['<h2 class="visually-hidden">Available fusions</h2>', '<h2 class="visually-hidden" data-i18n="builder.fusionsHidden">Available fusions</h2>'],
  ['aria-label="Publish build to Community"', 'data-i18n-aria-label="builder.publishAria" aria-label="Publish build to Community"'],
  ['<span class="publish-community-title">Publish to Community</span>', '<span class="publish-community-title" data-i18n="builder.publishTitle">Publish to Community</span>'],
  ['<span class="publish-community-hint">This posts your current build to the Community tab.</span>', '<span class="publish-community-hint" data-i18n="builder.publishHint">This posts your current build to the Community tab.</span>'],
  ['id="builderCommunityTargetLabel" for="builderCommunityTargetValue">Cleared level</label>', 'id="builderCommunityTargetLabel" for="builderCommunityTargetValue" data-i18n="builder.clearedLevel">Cleared level</label>'],
  ['<label for="builderCommunityDifficulty">Difficulty</label>', '<label for="builderCommunityDifficulty" data-i18n="builder.difficulty">Difficulty</label>'],
  ['aria-label="Contextual boss difficulty"', 'data-i18n-aria-label="builder.difficultyAria" aria-label="Contextual boss difficulty"'],
  ['<option value="">Not rated</option>', '<option value="" data-i18n="difficulty.notRated">Not rated</option>'],
  ['<option value="very_easy">Very easy</option>', '<option value="very_easy" data-i18n="difficulty.veryEasy">Very easy</option>'],
  ['<option value="easy">Easy</option>', '<option value="easy" data-i18n="difficulty.easy">Easy</option>'],
  ['<option value="medium">Medium</option>', '<option value="medium" data-i18n="difficulty.medium">Medium</option>'],
  ['<option value="hard">Hard</option>', '<option value="hard" data-i18n="difficulty.hard">Hard</option>'],
  ['<option value="very_hard">Very hard</option>', '<option value="very_hard" data-i18n="difficulty.veryHard">Very hard</option>'],
  ['placeholder="Power (optional)"', 'data-i18n-placeholder="builder.powerOptional" placeholder="Power (optional)"'],
  ['placeholder="Video link (optional)"', 'data-i18n-placeholder="builder.videoOptional" placeholder="Video link (optional)"'],
  ['placeholder="Boss strategy / notes (optional). Example: Buldak helps block projectiles on this boss."', 'data-i18n-placeholder="builder.strategyPlaceholder" placeholder="Boss strategy / notes (optional). Example: Buldak helps block projectiles on this boss."'],
  ['id="builderSaveCommunityBuild">Publish current build</button>', 'id="builderSaveCommunityBuild" data-i18n="builder.publish">Publish current build</button>'],
  ['      <p class="hint">\n        Create your build in the Build tab, publish it from there, then vote. The highest score moves to the top for the selected filters.\n      </p>', '      <p class="hint" data-i18n="community.hint">\n        Create your build in the Build tab, publish it from there, then vote. The highest score moves to the top for the selected filters.\n      </p>'],
  ['aria-label="Community filters"', 'data-i18n-aria-label="community.filtersAria" aria-label="Community filters"'],
  ['<label for="communityCharacter">Character</label>', '<label for="communityCharacter" data-i18n="community.character">Character</label>'],
  ['<option value="">All characters</option>', '<option value="" data-i18n="community.allCharacters">All characters</option>'],
  ['<label for="communityMode">Community mode</label>', '<label for="communityMode" data-i18n="community.mode">Community mode</label>'],
  ['<option value="stage">Stage</option>', '<option value="stage" data-i18n="mode.stage">Stage</option>'],
  ['<option value="boss">Boss</option>', '<option value="boss" data-i18n="mode.boss">Boss</option>'],
  ['<option value="abyss">Abyss</option>', '<option value="abyss" data-i18n="mode.abyss">Abyss</option>'],
  ['<label for="communityPower">Power</label>', '<label for="communityPower" data-i18n="community.power">Power</label>'],
  ['<option value="">All power</option>', '<option value="" data-i18n="community.allPower">All power</option>'],
  ['aria-label="Community progression filters"', 'data-i18n-aria-label="community.progressionAria" aria-label="Community progression filters"'],
  ['aria-label="Progression preview"', 'data-i18n-aria-label="miniGames.progressAria" aria-label="Progression preview"'],
  ['<p class="player-progress-hint">XP and energy will unlock with mini games — full system coming soon.</p>', '<p class="player-progress-hint" data-i18n="miniGames.xpHint">XP and energy will unlock with mini games — full system coming soon.</p>'],
  ['aria-label="Mini games"', 'data-i18n-aria-label="miniGames.placeholderAria" aria-label="Mini games"'],
  ['<h2>Coming soon</h2>', '<h2 data-i18n="miniGames.comingTitle">Coming soon</h2>'],
  ['<p>Mini games are on the way. XP and energy (30/30) will power each run.</p>', '<p data-i18n="miniGames.comingBody">Mini games are on the way. XP and energy (30/30) will power each run.</p>'],
  ['<p id="authModalDescription" class="auth-modal-copy">', '<p id="authModalDescription" class="auth-modal-copy" data-i18n="auth.description">'],
  ['<li>Publish your current build to the Community tab.</li>', '<li data-i18n="auth.benefitPublish">Publish your current build to the Community tab.</li>'],
  ['<li>Vote for community builds and keep vote sorting fair.</li>', '<li data-i18n="auth.benefitVote">Vote for community builds and keep vote sorting fair.</li>'],
  ['<li>Delete your own published builds.</li>', '<li data-i18n="auth.benefitDelete">Delete your own published builds.</li>'],
  ['<li>Click your profile picture to set a custom avatar.</li>', '<li data-i18n="auth.benefitAvatar">Click your profile picture to set a custom avatar.</li>'],
  ['<p id="liveChatStatus" class="live-chat-status">Public to read. Sign in to write.</p>', '<p id="liveChatStatus" class="live-chat-status" data-i18n="chat.publicRead">Public to read. Sign in to write.</p>'],
  ['<p class="live-chat-empty">Loading messages...</p>', '<p class="live-chat-empty" data-i18n="chat.loadingMessages">Loading messages...</p>'],
  ['placeholder="Sign in to write..."', 'data-i18n-placeholder="chat.placeholderSignIn" placeholder="Sign in to write..."'],
  ['Guests can read the chat.', '${t("chat.guestsRead")}'],
  ['<button type="button" id="liveChatSignIn">Sign in to write</button>', '<button type="button" id="liveChatSignIn" data-i18n="chat.signInToWrite">Sign in to write</button>'],
  ['<p>\n      If this builder helps you a little', '<p data-i18n="support.coffee">\n      If this builder helps you a little'],
];

for (const [a, b] of html) rep(a, b);

// fix accidental motion tags from bad patterns
h = h.replace(/<motion class="build-row-label"/g, '<div class="build-row-label"');
h = h.replace(/Passive Skill<\/motion>/g, "Passive Skill</motion>").replace("Passive Skill</motion>", "Passive Skill</div>");
h = h.replace(/<motion class="market-cluster"/g, '<div class="market-cluster"');

const js = [
  ['showPassiveHint(`EVO removed — skill restored: ${skillLabel(existing.skillId)}`)', 'showPassiveHint(t("hint.evoRemoved", { skill: skillLabel(existing.skillId) }))'],
  ['showPassiveHint(`EVO taken: ${ready.elab} — skill removed from the board (passives unchanged).`)', 'showPassiveHint(t("hint.evoTaken", { label: ready.elab }))'],
  ['showPassiveHint(`Slot ${i + 1}: mythic in place — undo the fusion to change it.`)', 'showPassiveHint(t("hint.mythicLocked", { n: i + 1 }))'],
  ['showPassiveHint(`${skillLabel(skillId)} is exclusive to ${owner?.label ?? "another hero"}.`)', 'showPassiveHint(t("hint.skillExclusiveOther", { skill: skillLabel(skillId), hero: owner?.label ?? "?" }))'],
  ["showPassiveHint(`${skillLabel(skillId)} is ${ch.label}'s exclusive skill — it cannot be removed.`)", 'showPassiveHint(t("hint.skillExclusiveLocked", { skill: skillLabel(skillId), hero: ch.label }))'],
  ['showPassiveHint(`${cfg.label} is required before publishing.`)', 'showPassiveHint(t("community.targetRequired", { label: cfg.label }))'],
  ['showPassiveHint(`${cfg.label} must use steps of ${cfg.step}.`)', 'showPassiveHint(t("community.targetStep", { label: cfg.label, step: cfg.step }))'],
  ['showPassiveHint("Video link must be YouTube, X/Twitter, or Discord.")', 'showPassiveHint(t("community.videoInvalid"))'],
  ['showPassiveHint("Build published online. Vote sorting updated.")', 'showPassiveHint(t("community.publishedOnline"))'],
  ['showPassiveHint("Online publish failed. Build saved locally.")', 'showPassiveHint(t("community.publishFailedLocal"))'],
  ['showPassiveHint("Build published locally. Vote sorting updated.")', 'showPassiveHint(t("community.publishedLocal"))'],
  ['showPassiveHint("Online vote failed. Vote saved locally.")', 'showPassiveHint(t("community.voteFailedLocal"))'],
  ['showPassiveHint("Only the author can delete this build.")', 'showPassiveHint(t("community.onlyAuthorDelete"))'],
  ['showPassiveHint(err.message || "Online delete failed.")', 'showPassiveHint(translateApiError(err.message) || t("community.deleteFailed"))'],
  ['media.innerHTML = "<span>Boss image missing</span>"', 'media.innerHTML = `<span>${t("community.bossImageMissing")}</span>`'],
  ['`Delete</button>`', '`${t("community.delete")}</button>`'],
  ['|| "Anonymous"', '|| t("community.anonymous")'],
  ['`Power ${escapeHtml(power)}`', '`${t("community.powerLabel")} ${escapeHtml(power)}`'],
  ['`Difficulty ${escapeHtml(communityDifficultyLabel(difficulty))}`', '`${t("community.difficultyLabel")} ${escapeHtml(communityDifficultyLabel(difficulty))}`'],
  ["liveChatMessagesEl.innerHTML = '<p class=\"live-chat-error\">Live chat is unavailable right now.</p>'", 'liveChatMessagesEl.innerHTML = `<p class="live-chat-error">${t("chat.unavailable")}</p>`'],
  ['<option value="">All</option>', '<option value="" data-i18n="community.filterAll">All</option>'],
  ['<span class="has-build">● build</span>', '<span class="has-build" data-i18n="community.filterBuild">● build</span>'],
  ['<span class="no-build">● none</span>', '<span class="no-build" data-i18n="community.filterNone">● none</span>'],
  ['`Apply this build`', 't("community.applyBuild")'],
  ['`Open YouTube`', 't("community.openYoutube")'],
  ['`Open Discord`', 't("community.openDiscord")'],
  ['`Open X/Twitter`', 't("community.openX")'],
  ['`Open video`', 't("community.openVideo")'],
  ['`Unsupported video link`', 't("community.unsupportedVideo")'],
  ['title="Community build YouTube video"', 'data-i18n-title="community.youtubeIframeTitle" title="Community build YouTube video"'],
  ['`by `', '`${t("community.by")} `'],
];

for (const [a, b] of js) rep(a, b);

// community empty state
rep(
  '`<p class="community-empty">No builds published for ${escapeHtml(characterScope)}, ${escapeHtml(powerScope)}, this mode, and this filter yet.</p>`',
  '`<p class="community-empty">${t("community.empty")}</p>`',
);

// refreshI18nUi extras
if (!h.includes("syncBuilderCommunityTargetLabel")) {
  rep(
    `    function syncCommunityDifficultyOptions() {`,
    `    function syncBuilderCommunityTargetLabel() {
      const el = document.getElementById("builderCommunityTargetLabel");
      if (!el) return;
      const cfg = communityTargetConfig(modeEl?.value || "stage");
      el.textContent = t(cfg.labelKey || "builder.clearedLevel");
    }
    function syncCommunityDifficultyOptions() {`,
  );
  rep(
    `      renderBuildLevel();
    }
    window.I18n.onChange`,
    `      renderBuildLevel();
      syncBuilderCommunityTargetLabel();
      if (typeof updateCommunityPublishFields === "function") updateCommunityPublishFields();
    }
    window.I18n.onChange`,
  );
}

// communityTargetConfig labelKey
rep('label: "Cleared level"', 'labelKey: "builder.clearedLevel", label: "Cleared level"');
rep('label: "Cleared floor"', 'labelKey: "builder.clearedFloor", label: "Cleared floor"');
rep('label: "Boss damage"', 'labelKey: "builder.bossDamage", label: "Boss damage"');

fs.writeFileSync(file, h);
console.log("done");
