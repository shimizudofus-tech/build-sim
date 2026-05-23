/**
 * Skill Survivor — canvas mini-game (Spekter skill icons).
 */
(function (global) {
  "use strict";

  const ARENA_W = 420;
  const ARENA_H = 420;
  const PLAYER_R = 14;
  const BASE_FIRE_MS = 420;

  const ENEMY_SKILL_IDS = [
    "bat",
    "tentacle",
    "orb",
    "razor",
    "shuriken",
    "buldak",
    "frost-field",
    "boom-frog",
    "tempest",
    "familiar",
    "lightning-whip",
    "fire-field",
  ];

  const EVO_BOSS_IDS = [
    "bat-purple",
    "thunderbolt-purple",
    "cutting-blades-purple",
    "lightning-whip-purple",
    "binding-chain-purple",
    "familiar-purple",
    "tempest-purple",
    "tentacle-purple",
    "buldak-purple",
    "orb-purple",
    "razor-purple",
    "frost-field-purple",
    "boom-frog-pruple",
    "shuriken-purple",
    "carapace-mauve",
    "fire-field-mauve",
  ];

  const GHOST_BOSS_ID = "prism_shell";
  const GHOST_BOSS_R = 24;
  const GHOST_BOSS_ICON_SCALE = 2.05;
  const GHOST_BOSS_BONUS = 1000;
  const GHOST_BOSS_LIFETIME_MS = 60000;
  const GHOST_BOSS_SPAWN_MS = 60000;
  const GHOST_BOSS_WARN_MS = 58000;
  const GHOST_BOSS_WARN_DURATION_MS = 2000;

  function difficultyAt(seconds) {
    return 1 + Math.floor(Math.max(0, seconds) / 10) * 0.25;
  }

  function upgradeLevel(raw, id) {
    if (!raw || typeof raw !== "object") return 0;
    const v = raw[id];
    if (typeof v === "boolean") return v ? 1 : 0;
    return Math.max(0, Math.floor(Number(v) || 0));
  }

  function buildUpgradeEffects(upgrades) {
    const u = upgrades || {};
    const atk = upgradeLevel(u, "attackSpeed2x");
    const dmg = upgradeLevel(u, "damage2x");
    const move = upgradeLevel(u, "moveSpeed");
    const bullet = upgradeLevel(u, "bulletSpeed");
    const magnet = upgradeLevel(u, "pickupMagnet");
    const score = upgradeLevel(u, "scoreBoost");
    const skin = upgradeLevel(u, "thickSkin");
    const multi = upgradeLevel(u, "multishot");
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

  const PICKUP_LIFE_MS = 4000;
  const PICKUP_SPAWN_MIN = 1800;
  const PICKUP_SPAWN_MAX = 3200;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.hypot(dx, dy);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /** SFX procéduraux (Web Audio) — synthèse locale, libres de droits. */
  class SurvivorSfx {
    constructor(enabled = true) {
      this.enabled = enabled;
      this.volume = 0.28;
      this.ctx = null;
    }

    setEnabled(on) {
      this.enabled = Boolean(on);
      if (!this.ctx) return;
      const fn = this.enabled ? "resume" : "suspend";
      this.ctx[fn]().catch(() => {});
    }

    destroy() {
      this.enabled = false;
      if (!this.ctx) return;
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }

    _ensure() {
      if (!this.enabled) return null;
      if (global.BuilderAudioSettings && !global.BuilderAudioSettings.isSoundEnabled()) return null;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return null;
      if (!this.ctx) this.ctx = new Ctx();
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return this.ctx;
    }

    _gain(at, peak, duration) {
      const ctx = this._ensure();
      if (!ctx) return null;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * this.volume), at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      g.connect(ctx.destination);
      return g;
    }

    _tone(freqStart, freqEnd, duration, type, peak) {
      const ctx = this._ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = this._gain(t0, peak, duration);
      if (!g) return;
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t0);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration * 0.85);
      }
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    _noise(duration, peak, freq = 900) {
      const ctx = this._ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = 0.7;
      const g = this._gain(t0, peak, duration);
      if (!g) return;
      src.connect(filter);
      filter.connect(g);
      src.start(t0);
      src.stop(t0 + duration + 0.02);
    }

    startRun() {
      this._tone(520, 880, 0.14, "sine", 0.55);
      this._tone(660, 990, 0.1, "triangle", 0.35);
    }

    shoot() {
      this._tone(920, 640, 0.06, "square", 0.22);
    }

    kill() {
      this._noise(0.09, 0.45, 1200);
      this._tone(240, 120, 0.08, "sine", 0.3);
    }

    hurt() {
      this._tone(180, 90, 0.16, "sawtooth", 0.38);
      this._noise(0.05, 0.25, 400);
    }

    gameOver() {
      this._tone(420, 140, 0.35, "triangle", 0.42);
      this._tone(280, 80, 0.45, "sine", 0.35);
    }
  }

  class SkillSurvivorGame {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.seed = options.seed >>> 0;
      this.rand = mulberry32(this.seed || 1);
      this.pngUrlFor = options.pngUrlFor || (() => "");
      this.pngUrlListFor = options.pngUrlListFor || null;
      this.playerSkillId = options.playerSkillId || "shuriken";
      this.onState = options.onState || (() => {});
      this.onGameOver = options.onGameOver || (() => {});
      this.onFatalHit = options.onFatalHit || null;
      this.sfx = options.sfx instanceof SurvivorSfx ? options.sfx : new SurvivorSfx(options.sound !== false);
      this.effects = buildUpgradeEffects(options.upgrades);

      this.running = false;
      this.paused = false;
      this.sessionActive = false;
      this._pauseStarted = 0;
      this._wasRunningBeforePause = false;
      this.startedAt = 0;
      this.lastFrame = 0;
      this.elapsedMs = 0;
      this.kills = 0;
      this.pickupScore = 0;
      this.bossBonusScore = 0;
      this.hp = 1;
      this.maxLives = options.maxLives || 3;
      this.livesPurchased = 0;
      this.spawnTimer = 0;
      this.fireTimer = 0;
      this.pickupSpawnTimer = 1200;
      this._lastEliteDecade = -1;
      this._ghostBossSpawned = false;
      this._ghostBossWarningStarted = false;
      this.bossWarning = null;
      this.invulnMs = 0;
      this.shakeMs = 0;

      this.player = { x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0 };
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.particles = [];
      this.images = new Map();
      this.keys = new Set();

      this._bindInput();
      this._loadImages();
      this._resize();
    }

    _syncSfxEnabled() {
      const userOn = !global.BuilderAudioSettings || global.BuilderAudioSettings.isSoundEnabled();
      const runtimeOn = userOn && this.sessionActive && this.running && !this.paused;
      this.sfx.setEnabled(runtimeOn);
    }

    _bindInput() {
      this._onKeyDown = (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
          e.preventDefault();
        }
        this.keys.add(e.key.toLowerCase());
      };
      this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
      window.addEventListener("keydown", this._onKeyDown);
      window.addEventListener("keyup", this._onKeyUp);

      this._touchId = null;
      this._touchOrigin = null;
      this._onTouchStart = (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        if (!t) return;
        this._touchId = t.identifier;
        const rect = this.canvas.getBoundingClientRect();
        this._touchOrigin = { x: t.clientX - rect.left, y: t.clientY - rect.top };
      };
      this._onTouchMove = (e) => {
        e.preventDefault();
        if (this._touchId == null || !this._touchOrigin) return;
        const t = [...e.changedTouches].find((x) => x.identifier === this._touchId);
        if (!t) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        const dx = x - this._touchOrigin.x;
        const dy = y - this._touchOrigin.y;
        const len = Math.hypot(dx, dy) || 1;
        const max = 48;
        const scale = Math.min(max, len) / len;
        this.player.vx = (dx / len) * scale * 220 * this.effects.moveSpeedMult;
        this.player.vy = (dy / len) * scale * 220 * this.effects.moveSpeedMult;
      };
      this._onTouchEnd = (e) => {
        const t = [...e.changedTouches].find((x) => x.identifier === this._touchId);
        if (!t) return;
        this._touchId = null;
        this._touchOrigin = null;
        this.player.vx = 0;
        this.player.vy = 0;
      };
      this.canvas.addEventListener("touchstart", this._onTouchStart, { passive: false });
      this.canvas.addEventListener("touchmove", this._onTouchMove, { passive: false });
      this.canvas.addEventListener("touchend", this._onTouchEnd);
    }

    _imageKey(type, id) {
      return `${type}:${id}`;
    }

    _loadImages() {
      const loads = [
        ["skill", this.playerSkillId],
        ...ENEMY_SKILL_IDS.map((id) => ["skill", id]),
        ...EVO_BOSS_IDS.map((id) => ["evo", id]),
        ["mythic", GHOST_BOSS_ID],
      ];
      loads.forEach(([type, id]) => this._loadImageWithFallbacks(type, id));
    }

    _loadImageWithFallbacks(type, id) {
      const urls =
        typeof this.pngUrlListFor === "function"
          ? this.pngUrlListFor(type, id).filter(Boolean)
          : [this.pngUrlFor(type, id)].filter(Boolean);
      if (!urls.length) return;
      const key = this._imageKey(type, id);
      let idx = 0;
      const tryNext = () => {
        if (idx >= urls.length) return;
        const url = urls[idx++];
        const img = new Image();
        img.onload = () => this.images.set(key, img);
        img.onerror = () => tryNext();
        img.src = url;
      };
      tryNext();
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = ARENA_W * dpr;
      this.canvas.height = ARENA_H * dpr;
      this.canvas.style.width = "100%";
      this.canvas.style.maxWidth = `${ARENA_W}px`;
      this.canvas.style.aspectRatio = "1 / 1";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    applyUpgrades(upgrades) {
      this.effects = buildUpgradeEffects(upgrades);
    }

    start(options = {}) {
      if (this.running) return;
      this.livesPurchased = Math.max(0, Math.floor(Number(options.livesPurchased) || 0));
      this.hp = Math.max(0, Math.min(1, Math.floor(Number(options.hp) || 0)));
      if (this.livesPurchased < 1 || this.hp < 1) return;
      this.running = true;
      this.startedAt = performance.now();
      this.lastFrame = this.startedAt;
      this.elapsedMs = 0;
      this.kills = 0;
      this.pickupScore = 0;
      this.bossBonusScore = 0;
      this.enemies = [];
      this.bullets = [];
      this.pickups = [];
      this.particles = [];
      this.spawnTimer = 0;
      this.fireTimer = 0;
      this.pickupSpawnTimer = 1200;
      this._lastEliteDecade = -1;
      this._ghostBossSpawned = false;
      this._ghostBossWarningStarted = false;
      this.bossWarning = null;
      this.invulnMs = 0;
      this.shakeMs = 0;
      this._fatalPending = false;
      this.player.x = ARENA_W / 2;
      this.player.y = ARENA_H / 2;
      this.player.vx = 0;
      this.player.vy = 0;
      this.paused = false;
      this._pauseStarted = 0;
      this._wasRunningBeforePause = false;
      this.sessionActive = true;
      this._syncSfxEnabled();
      if (!global.BuilderAudioSettings || global.BuilderAudioSettings.isSoundEnabled()) {
        this.sfx.startRun();
      }
      requestAnimationFrame((t) => this._loop(t));
    }

    revive({ livesPurchased, hp = 1 }) {
      this.livesPurchased = Math.max(1, Math.floor(Number(livesPurchased) || 1));
      this.hp = Math.max(1, Math.floor(Number(hp) || 1));
      this.invulnMs = 1200;
      this.shakeMs = 0;
      this._fatalPending = false;
      if (!this.running) {
        this.running = true;
        this.lastFrame = performance.now();
        this._syncSfxEnabled();
        requestAnimationFrame((t) => this._loop(t));
      }
    }

    stop() {
      this.running = false;
      this.paused = false;
      this.sessionActive = false;
      this._pauseStarted = 0;
      this._wasRunningBeforePause = false;
      this.sfx.setEnabled(false);
    }

    pause() {
      if (this.paused || !this.sessionActive) return;
      this._wasRunningBeforePause = this.running;
      this.paused = true;
      this.running = false;
      if (this._wasRunningBeforePause) this._pauseStarted = performance.now();
      this._syncSfxEnabled();
    }

    resume() {
      if (!this.paused) return;
      this.paused = false;
      if (this._wasRunningBeforePause) {
        if (this._pauseStarted) {
          this.startedAt += performance.now() - this._pauseStarted;
          this._pauseStarted = 0;
        }
        this.running = true;
        this.lastFrame = performance.now();
        this._syncSfxEnabled();
        requestAnimationFrame((t) => this._loop(t));
      }
      this._wasRunningBeforePause = false;
    }

    destroy() {
      this.stop();
      this.sfx.destroy();
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("keyup", this._onKeyUp);
      this.canvas.removeEventListener("touchstart", this._onTouchStart);
      this.canvas.removeEventListener("touchmove", this._onTouchMove);
      this.canvas.removeEventListener("touchend", this._onTouchEnd);
    }

    _score() {
      return (
        Math.floor(this.elapsedMs / 100) +
        this.kills * 30 +
        this.pickupScore +
        this.bossBonusScore
      );
    }

    _loop(now) {
      if (!this.running || this.paused) return;
      const dt = Math.min(32, now - this.lastFrame);
      this.lastFrame = now;
      this.elapsedMs = now - this.startedAt;
      this._update(dt);
      this._draw();
      this.onState({
        elapsedMs: this.elapsedMs,
        kills: this.kills,
        hp: this.hp,
        livesPurchased: this.livesPurchased,
        maxLives: this.maxLives,
        score: this._score(),
        pickupScore: this.pickupScore,
        bossBonusScore: this.bossBonusScore,
        difficulty: difficultyAt(this.elapsedMs / 1000),
      });
      requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt) {
      const sec = this.elapsedMs / 1000;
      const diff = difficultyAt(sec);

      if (this._touchId == null) {
        let vx = 0;
        let vy = 0;
        if (this.keys.has("arrowleft") || this.keys.has("a")) vx -= 1;
        if (this.keys.has("arrowright") || this.keys.has("d")) vx += 1;
        if (this.keys.has("arrowup") || this.keys.has("w")) vy -= 1;
        if (this.keys.has("arrowdown") || this.keys.has("s")) vy += 1;
        const len = Math.hypot(vx, vy) || 1;
        const speed = (175 + Math.min(40, sec * 0.4)) * this.effects.moveSpeedMult;
        this.player.vx = (vx / len) * speed;
        this.player.vy = (vy / len) * speed;
      }

      this.player.x = clamp(this.player.x + (this.player.vx * dt) / 1000, PLAYER_R, ARENA_W - PLAYER_R);
      this.player.y = clamp(this.player.y + (this.player.vy * dt) / 1000, PLAYER_R, ARENA_H - PLAYER_R);

      this.spawnTimer -= dt;
      const spawnEvery = Math.max(220, 1100 / diff);
      const maxEnemies = Math.min(55, Math.floor(14 + diff * 11));
      if (this.spawnTimer <= 0 && this.enemies.length < maxEnemies) {
        this.spawnTimer = spawnEvery;
        this._spawnEnemy(diff);
      }

      const decade = Math.floor(sec / 10);
      if (decade >= 1 && decade !== this._lastEliteDecade) {
        this._lastEliteDecade = decade;
        this._spawnEliteBoss(decade, diff);
      }

      if (
        this.elapsedMs >= GHOST_BOSS_WARN_MS &&
        !this._ghostBossSpawned &&
        !this._ghostBossWarningStarted
      ) {
        this._ghostBossWarningStarted = true;
        this.bossWarning = {
          x: ARENA_W / 2,
          y: ARENA_H / 2,
          r: GHOST_BOSS_R,
          startedAtMs: this.elapsedMs,
          durationMs: GHOST_BOSS_WARN_DURATION_MS,
        };
      }

      if (this.bossWarning && !this._ghostBossSpawned) {
        if (this.elapsedMs - this.bossWarning.startedAtMs >= this.bossWarning.durationMs) {
          this.bossWarning = null;
          this._spawnGhostBoss();
          this._ghostBossSpawned = true;
        }
      }

      this.fireTimer -= dt;
      const fireEvery = Math.max(
        110,
        BASE_FIRE_MS / Math.sqrt(diff) / this.effects.fireRateMult,
      );
      if (this.fireTimer <= 0) {
        this.fireTimer = fireEvery;
        this._fireAtNearest();
      }

      this.pickupSpawnTimer -= dt;
      if (this.pickupSpawnTimer <= 0 && this.pickups.length < 6) {
        this.pickupSpawnTimer =
          PICKUP_SPAWN_MIN + this.rand() * (PICKUP_SPAWN_MAX - PICKUP_SPAWN_MIN);
        this._spawnPickup();
      }

      for (const p of this.pickups) {
        p.lifeMs -= dt;
      }
      this.pickups = this.pickups.filter((p) => p.lifeMs > 0);

      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (dist(this.player.x, this.player.y, p.x, p.y) < this.effects.pickupRadius) {
          this.pickupScore += Math.floor(p.value * this.effects.pickupScoreMult);
          this.pickups.splice(i, 1);
          this._burst(p.x, p.y, "#ffe566");
        }
      }

      const enemySpeed = 42 + diff * 28;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.kind === "ghostBoss") {
          if (this._updateGhostBoss(e, dt)) {
            this.enemies.splice(i, 1);
          }
          continue;
        }
        const d = dist(e.x, e.y, this.player.x, this.player.y) || 1;
        const speedMul = e.kind === "elite" ? 0.82 : 1;
        e.x += ((this.player.x - e.x) / d) * ((enemySpeed * speedMul * dt) / 1000);
        e.y += ((this.player.y - e.y) / d) * ((enemySpeed * speedMul * dt) / 1000);
      }

      for (const b of this.bullets) {
        b.x += b.vx * (dt / 1000);
        b.y += b.vy * (dt / 1000);
        b.life -= dt;
      }
      this.bullets = this.bullets.filter((b) => b.life > 0);

      for (const b of this.bullets) {
        if (!b.hitCount) b.hitCount = 0;
        const maxHits = this.effects.multishotHits || 1;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (dist(b.x, b.y, e.x, e.y) < e.r + 6) {
            if (e.invincible) continue;
            e.hp = (e.hp || 1) - (this.effects.bulletDamage || 1);
            b.hitCount += 1;
            this._burst(e.x, e.y, e.color);
            if (e.hp <= 0) {
              this.enemies.splice(i, 1);
              this.kills += 1;
              this.sfx.kill();
            }
            if (b.hitCount >= maxHits) {
              b.life = 0;
              break;
            }
          }
        }
      }

      if (this.invulnMs > 0) this.invulnMs -= dt;
      if (this.shakeMs > 0) this.shakeMs -= dt;

      if (this.invulnMs <= 0) {
        for (const e of this.enemies) {
          if (dist(this.player.x, this.player.y, e.x, e.y) < PLAYER_R + e.r - 2) {
            this.hp -= 1;
            this.invulnMs = this.effects.invulnMs;
            this.shakeMs = 220;
            this._burst(this.player.x, this.player.y, "#ff6688");
            this.sfx.hurt();
            if (this.hp <= 0) {
              this._handleFatalHit();
              return;
            }
            break;
          }
        }
      }

      for (const p of this.particles) {
        p.x += p.vx * (dt / 1000);
        p.y += p.vy * (dt / 1000);
        p.life -= dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }

    _spawnEnemy(diff) {
      const edge = Math.floor(this.rand() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = this.rand() * ARENA_W;
        y = -16;
      } else if (edge === 1) {
        x = ARENA_W + 16;
        y = this.rand() * ARENA_H;
      } else if (edge === 2) {
        x = this.rand() * ARENA_W;
        y = ARENA_H + 16;
      } else {
        x = -16;
        y = this.rand() * ARENA_H;
      }
      const skillId = ENEMY_SKILL_IDS[Math.floor(this.rand() * ENEMY_SKILL_IDS.length)];
      const palette = ["#7ecbff", "#c49bff", "#ff9a62", "#8dffb2", "#ffe566"];
      this.enemies.push({
        x,
        y,
        r: 12 + this.rand() * 5,
        skillId,
        iconType: "skill",
        kind: "normal",
        color: palette[Math.floor(this.rand() * palette.length)],
        hp: 1,
        maxHp: 1,
      });
    }

    _spawnEliteBoss(decade, diff) {
      const edge = Math.floor(this.rand() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = this.rand() * ARENA_W;
        y = -20;
      } else if (edge === 1) {
        x = ARENA_W + 20;
        y = this.rand() * ARENA_H;
      } else if (edge === 2) {
        x = this.rand() * ARENA_W;
        y = ARENA_H + 20;
      } else {
        x = -20;
        y = this.rand() * ARENA_H;
      }
      const evoId = EVO_BOSS_IDS[Math.floor(this.rand() * EVO_BOSS_IDS.length)];
      const hp = 4 + decade * 2 + Math.floor(diff);
      this.enemies.push({
        x,
        y,
        r: 18 + this.rand() * 3,
        skillId: evoId,
        iconType: "evo",
        kind: "elite",
        color: "#ffd56a",
        hp,
        maxHp: hp,
      });
    }

    _spawnGhostBoss() {
      const angle = this.rand() * Math.PI * 2;
      const speed = 26;
      this.enemies.push({
        x: ARENA_W / 2,
        y: ARENA_H / 2,
        r: GHOST_BOSS_R,
        skillId: GHOST_BOSS_ID,
        iconType: "mythic",
        kind: "ghostBoss",
        invincible: true,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#c49bff",
        hp: 9999,
        maxHp: 9999,
        spawnAtMs: this.elapsedMs,
        diesAtMs: this.elapsedMs + GHOST_BOSS_LIFETIME_MS,
      });
    }

    _updateGhostBoss(e, dt) {
      e.x += e.vx * (dt / 1000);
      e.y += e.vy * (dt / 1000);
      if (e.x - e.r < 0) {
        e.x = e.r;
        e.vx = Math.abs(e.vx);
      } else if (e.x + e.r > ARENA_W) {
        e.x = ARENA_W - e.r;
        e.vx = -Math.abs(e.vx);
      }
      if (e.y - e.r < 0) {
        e.y = e.r;
        e.vy = Math.abs(e.vy);
      } else if (e.y + e.r > ARENA_H) {
        e.y = ARENA_H - e.r;
        e.vy = -Math.abs(e.vy);
      }
      if (this.elapsedMs >= e.diesAtMs) {
        this.bossBonusScore += GHOST_BOSS_BONUS;
        this._burst(e.x, e.y, "#ffe566");
        for (let i = 0; i < 16; i++) {
          const a = (Math.PI * 2 * i) / 16;
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * (90 + this.rand() * 120),
            vy: Math.sin(a) * (90 + this.rand() * 120),
            life: 420 + this.rand() * 220,
            color: "#c49bff",
          });
        }
        this.sfx.kill();
        return true;
      }
      return false;
    }

    _spawnPickup() {
      const pad = 24;
      this.pickups.push({
        x: pad + this.rand() * (ARENA_W - pad * 2),
        y: pad + this.rand() * (ARENA_H - pad * 2),
        value: 15 + Math.floor(this.rand() * 36),
        lifeMs: PICKUP_LIFE_MS,
      });
    }

    _fireAtNearest() {
      if (!this.enemies.length) return;
      let best = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        const d = dist(this.player.x, this.player.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) return;
      const d = bestD || 1;
      const speed = 340 * this.effects.bulletSpeedMult;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: ((best.x - this.player.x) / d) * speed,
        vy: ((best.y - this.player.y) / d) * speed,
        life: 900,
        hitCount: 0,
      });
      this.sfx.shoot();
    }

    _handleFatalHit() {
      if (this._fatalPending) return;
      const payload = {
        durationMs: Math.floor(this.elapsedMs),
        kills: this.kills,
        pickupScore: this.pickupScore,
        bossBonusScore: this.bossBonusScore,
        score: this._score(),
        livesPurchased: this.livesPurchased,
        maxLives: this.maxLives,
      };
      if (this.livesPurchased < this.maxLives && typeof this.onFatalHit === "function") {
        this._fatalPending = true;
        this.running = false;
        Promise.resolve(this.onFatalHit(payload))
          .then((result) => {
            this._fatalPending = false;
            if (result && result.continue) {
              this.revive({
                livesPurchased: result.livesPurchased || this.livesPurchased + 1,
                hp: 1,
              });
              return;
            }
            this.sfx.gameOver();
            this.onGameOver(payload);
          })
          .catch(() => {
            this._fatalPending = false;
            this.sfx.gameOver();
            this.onGameOver(payload);
          });
        return;
      }
      this.running = false;
      this.sfx.gameOver();
      this.onGameOver(payload);
    }

    _burst(x, y, color) {
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        this.particles.push({
          x,
          y,
          vx: Math.cos(a) * (60 + this.rand() * 80),
          vy: Math.sin(a) * (60 + this.rand() * 80),
          life: 280 + this.rand() * 180,
          color,
        });
      }
    }

    _drawIcon(type, id, x, y, size) {
      const img = this.images.get(this._imageKey(type, id));
      const half = size / 2;
      if (img && img.complete && img.naturalWidth) {
        this.ctx.drawImage(img, x - half, y - half, size, size);
      } else {
        this.ctx.fillStyle = "#6ea8fe";
        this.ctx.beginPath();
        this.ctx.arc(x, y, half, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    _drawEnemyHpBar(e) {
      if ((e.maxHp || 1) <= 1 || e.kind === "ghostBoss") return;
      const w = e.r * 1.6;
      const h = 4;
      const x = e.x - w / 2;
      const y = e.y - e.r - 10;
      const ratio = clamp((e.hp || 0) / (e.maxHp || 1), 0, 1);
      this.ctx.fillStyle = "rgba(0,0,0,0.45)";
      this.ctx.fillRect(x, y, w, h);
      this.ctx.fillStyle = e.kind === "elite" ? "#ffd56a" : "#8dffb2";
      this.ctx.fillRect(x, y, w * ratio, h);
    }

    _draw() {
      const ctx = this.ctx;
      const shakeX = this.shakeMs > 0 ? (Math.random() - 0.5) * 6 : 0;
      const shakeY = this.shakeMs > 0 ? (Math.random() - 0.5) * 6 : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const grd = ctx.createRadialGradient(
        ARENA_W * 0.5,
        ARENA_H * 0.35,
        20,
        ARENA_W * 0.5,
        ARENA_H * 0.5,
        ARENA_W * 0.75,
      );
      grd.addColorStop(0, "#1a2238");
      grd.addColorStop(1, "#0a0e16");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      ctx.strokeStyle = "rgba(110,168,254,0.18)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, ARENA_W - 2, ARENA_H - 2);

      for (let gx = 0; gx < ARENA_W; gx += 42) {
        for (let gy = 0; gy < ARENA_H; gy += 42) {
          ctx.fillStyle = "rgba(255,255,255,0.015)";
          ctx.fillRect(gx, gy, 1, 1);
        }
      }

      for (const p of this.particles) {
        ctx.globalAlpha = clamp(p.life / 300, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (this.bossWarning) {
        const w = this.bossWarning;
        const elapsed = this.elapsedMs - w.startedAtMs;
        const t = clamp(elapsed / w.durationMs, 0, 1);
        const pulse = 0.55 + 0.45 * Math.sin(t * Math.PI * 8);
        const radius = w.r * (0.9 + pulse * 0.2);
        ctx.fillStyle = `rgba(255, 40, 60, ${0.06 + pulse * 0.12})`;
        ctx.beginPath();
        ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 55, 75, ${0.45 + pulse * 0.55})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 100, 110, ${0.25 + pulse * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(w.x, w.y, radius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const e of this.enemies) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.arc(e.x + 2, e.y + 3, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.kind === "elite" ? 3 : e.kind === "ghostBoss" ? 4 : 2;
        if (e.kind === "ghostBoss") {
          ctx.shadowColor = "#c49bff";
          ctx.shadowBlur = 20;
        }
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const iconType = e.iconType || "skill";
        const iconScale =
          e.kind === "elite" ? 1.85 : e.kind === "ghostBoss" ? GHOST_BOSS_ICON_SCALE : 1.55;
        this._drawIcon(iconType, e.skillId, e.x, e.y, e.r * iconScale);
        this._drawEnemyHpBar(e);
      }

      for (const b of this.bullets) {
        ctx.fillStyle = "#ffe566";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of this.pickups) {
        const pulse = 0.55 + 0.45 * Math.sin(this.elapsedMs / 120 + p.x * 0.05);
        const alpha = clamp(p.lifeMs / PICKUP_LIFE_MS, 0.25, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(255, 224, 102, ${0.35 + pulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe566";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff8cc";
        ctx.font = "bold 9px system-ui,sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.value), p.x, p.y);
      }
      ctx.globalAlpha = 1;

      if (this.invulnMs <= 0 || Math.floor(this.elapsedMs / 80) % 2 === 0) {
        ctx.strokeStyle = "#6ea8fe";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, PLAYER_R + 2, 0, Math.PI * 2);
        ctx.stroke();
        this._drawIcon("skill", this.playerSkillId, this.player.x, this.player.y, PLAYER_R * 2.1);
      }

      ctx.restore();
    }
  }

  global.SkillSurvivor = {
    create(canvas, options) {
      return new SkillSurvivorGame(canvas, options);
    },
    difficultyAt,
    SurvivorSfx,
  };
})(typeof window !== "undefined" ? window : globalThis);
