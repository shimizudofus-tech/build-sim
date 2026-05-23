/**
 * Préférences audio globales (localStorage) — effets sonores & musique.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "builder_audio_prefs_v1";
  const defaults = { sound: true, music: true, musicVolume: 0.55 };
  const listeners = new Set();
  let prefs = loadPrefs();

  function clampVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return defaults.musicVolume;
    return Math.max(0, Math.min(1, n));
  }

  function loadPrefs() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return {
        sound: parsed.sound !== false,
        music: parsed.music !== false,
        musicVolume: clampVolume(parsed.musicVolume ?? defaults.musicVolume),
      };
    } catch {
      return { ...defaults };
    }
  }

  function savePrefs() {
    try {
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* quota / private mode */
    }
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(getPrefs());
      } catch {
        /* ignore listener errors */
      }
    });
  }

  function getPrefs() {
    return {
      sound: prefs.sound,
      music: prefs.music,
      musicVolume: prefs.musicVolume,
    };
  }

  function isSoundEnabled() {
    return prefs.sound !== false;
  }

  function isMusicEnabled() {
    return prefs.music !== false;
  }

  function getMusicVolume() {
    return prefs.musicVolume;
  }

  function setSound(on) {
    prefs.sound = Boolean(on);
    savePrefs();
    notify();
  }

  function setMusic(on) {
    prefs.music = Boolean(on);
    savePrefs();
    notify();
  }

  function setMusicVolume(value) {
    prefs.musicVolume = clampVolume(value);
    savePrefs();
    notify();
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  global.BuilderAudioSettings = {
    getPrefs,
    isSoundEnabled,
    isMusicEnabled,
    getMusicVolume,
    setSound,
    setMusic,
    setMusicVolume,
    onChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
