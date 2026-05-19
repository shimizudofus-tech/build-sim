/**
 * Lightweight i18n for Spekter Agency Build Simulator.
 * Loads /locales/{locale}.json — no dependencies.
 */
(function (global) {
  const STORAGE_KEY = "builder_locale";
  const SUPPORTED = ["fr", "en", "pt-BR", "id", "vi"];
  const DEFAULT_LOCALE = "en";
  const BCP47 = {
    fr: "fr-FR",
    en: "en-US",
    "pt-BR": "pt-BR",
    id: "id-ID",
    vi: "vi-VN",
  };

  /** Server/API English messages → translation keys (API unchanged). */
  const API_ERROR_KEYS = {
    "Sign in required.": "api.signInRequired",
    "Sign in required to link Discord.": "api.signInRequiredLinkDiscord",
    "Sign in required to link Telegram.": "api.signInRequiredLinkTelegram",
    "Discord login is not configured.": "api.discordNotConfigured",
    "Telegram login is not configured.": "api.telegramNotConfigured",
    "Use the Telegram Login button in the site UI.": "api.useTelegramButton",
    "Invalid OAuth callback.": "api.invalidOAuth",
    "Telegram link failed.": "api.telegramLinkFailed",
    "Message is required.": "api.messageRequired",
    "Video link must be YouTube, X/Twitter, or Discord.": "api.videoLinkInvalid",
    "CP is required.": "api.cpRequired",
    "Invalid CP format.": "api.cpInvalid",
    "Power (CP) is required.": "api.cpRequired",
    "Invalid Power (CP) value.": "api.cpInvalid",
    "Build not found": "api.buildNotFound",
    "Voter key is required": "api.voterKeyRequired",
    "You already voted for this build.": "api.alreadyVoted",
    "Only the author can delete this build": "api.onlyAuthorDelete",
    "Not found": "api.notFound",
    "Server error": "api.serverError",
    "Avatar must be a PNG, JPG, or WebP image.": "api.avatarType",
    "Avatar must be 1 MB or smaller.": "api.avatarSize",
    "Not enough energy.": "api.notEnoughEnergy",
    "API disabled": "api.apiDisabled",
  };

  let locale = DEFAULT_LOCALE;
  let messages = {};
  let readyPromise = null;
  const changeListeners = new Set();

  function normalizeLocale(code) {
    if (!code) return null;
    const lower = String(code).trim();
    if (SUPPORTED.includes(lower)) return lower;
    const short = lower.split("-")[0];
    if (short === "pt") return "pt-BR";
    if (SUPPORTED.includes(short)) return short;
    return null;
  }

  function detectLocale() {
    const stored = normalizeLocale(
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
    );
    if (stored) return stored;
    const nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("pt")) return "pt-BR";
    if (nav.startsWith("id")) return "id";
    if (nav.startsWith("vi")) return "vi";
    if (nav.startsWith("en")) return "en";
    return DEFAULT_LOCALE;
  }

  function localePath(code) {
    const base = document.querySelector("base")?.href || document.baseURI || "/";
    return new URL(`locales/${code}.json`, base).href;
  }

  async function loadMessages(code) {
    const url = localePath(code);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Locale ${code} failed (${res.status})`);
    return res.json();
  }

  function interpolate(text, params) {
    if (!params || typeof text !== "string") return text;
    return text.replace(/\{(\w+)\}/g, (_, key) => {
      const v = params[key];
      return v === undefined || v === null ? `{${key}}` : String(v);
    });
  }

  function t(key, params) {
    const raw = messages[key] ?? messages[`${key}`];
    if (raw === undefined) {
      if (locale !== DEFAULT_LOCALE && global.__I18N_FALLBACK?.[key]) {
        return interpolate(global.__I18N_FALLBACK[key], params);
      }
      return key;
    }
    return interpolate(raw, params);
  }

  function translateApiError(message) {
    if (!message) return "";
    const key = API_ERROR_KEYS[message];
    return key ? t(key) : message;
  }

  function applyMeta() {
    document.title = t("seo.title");
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t("seo.description"));
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", t("seo.ogTitle"));
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", t("seo.ogDescription"));
    document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : locale;
  }

  function applyNode(el) {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
    const htmlKey = el.getAttribute("data-i18n-html");
    if (htmlKey) el.innerHTML = t(htmlKey);
    const phKey = el.getAttribute("data-i18n-placeholder");
    if (phKey) el.setAttribute("placeholder", t(phKey));
    const titleKey = el.getAttribute("data-i18n-title");
    if (titleKey) el.setAttribute("title", t(titleKey));
    const ariaKey = el.getAttribute("data-i18n-aria-label");
    if (ariaKey) el.setAttribute("aria-label", t(ariaKey));
    const attrList = el.getAttribute("data-i18n-attr");
    if (attrList) {
      attrList.split(";").forEach((pair) => {
        const [attr, k] = pair.split(":").map((s) => s.trim());
        if (attr && k) el.setAttribute(attr, t(k));
      });
    }
  }

  function applyDocument(root = document) {
    root.querySelectorAll(
      "[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-attr]",
    ).forEach(applyNode);
    root.querySelectorAll("option[data-i18n]").forEach((opt) => {
      opt.textContent = t(opt.getAttribute("data-i18n"));
    });
    applyMeta();
    document.querySelectorAll(".lang-switcher [data-locale]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-locale") === locale);
      btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
    });
  }

  function bindLangSwitcher() {
    document.querySelectorAll(".lang-switcher [data-locale]").forEach((btn) => {
      if (btn.dataset.i18nBound) return;
      btn.dataset.i18nBound = "1";
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-locale");
        if (next && next !== locale) setLocale(next);
      });
    });
  }

  async function setLocale(code, { save = true } = {}) {
    const next = normalizeLocale(code) || DEFAULT_LOCALE;
    if (next === locale && Object.keys(messages).length) {
      applyDocument();
      return;
    }
    locale = next;
    if (save && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, locale);
    }
    messages = await loadMessages(locale);
    if (locale !== DEFAULT_LOCALE) {
      try {
        global.__I18N_FALLBACK = await loadMessages(DEFAULT_LOCALE);
      } catch {
        global.__I18N_FALLBACK = {};
      }
    }
    applyDocument();
    changeListeners.forEach((fn) => {
      try {
        fn(locale);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function onChange(fn) {
    changeListeners.add(fn);
    return () => changeListeners.delete(fn);
  }

  function init(startLocale) {
    if (!readyPromise) {
      readyPromise = (async () => {
        locale = normalizeLocale(startLocale) || detectLocale();
        try {
          messages = await loadMessages(locale);
        } catch {
          locale = DEFAULT_LOCALE;
          messages = await loadMessages(DEFAULT_LOCALE);
        }
        if (locale !== DEFAULT_LOCALE) {
          try {
            global.__I18N_FALLBACK = await loadMessages(DEFAULT_LOCALE);
          } catch {
            global.__I18N_FALLBACK = {};
          }
        }
        applyDocument();
        bindLangSwitcher();
      })();
    }
    return readyPromise;
  }

  const I18n = {
    init,
    setLocale,
    t,
    translateApiError,
    applyDocument,
    applyMeta,
    onChange,
    get locale() {
      return locale;
    },
    get bcp47() {
      return BCP47[locale] || BCP47.en;
    },
    supported: SUPPORTED,
  };

  global.I18n = I18n;
})(typeof window !== "undefined" ? window : globalThis);
