/**
 * Préférences audio globales (localStorage) — effets sonores & musique.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "builder_audio_prefs_v1";
  const defaults = { sound: true, music: true };
  const listeners = new Set();
  let prefs = loadPrefs();

  function loadPrefs() {
    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return {
        sound: parsed.sound !== false,
        music: parsed.music !== false,
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
    return { sound: prefs.sound, music: prefs.music };
  }

  function isSoundEnabled() {
    return prefs.sound !== false;
  }

  function isMusicEnabled() {
    return prefs.music !== false;
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

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  global.BuilderAudioSettings = {
    getPrefs,
    isSoundEnabled,
    isMusicEnabled,
    setSound,
    setMusic,
    onChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
