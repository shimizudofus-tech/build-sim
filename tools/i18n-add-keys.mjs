import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const adds = {
  en: {
    "community.optionBuild": "build",
    "community.optionBuildCount": "build ({count})",
    "community.optionNone": "none",
    "auth.statusDiscordAvailable": "Discord sign-in is available.",
    "auth.statusDiscordUnavailable": "Discord is not configured on the server.",
    "auth.statusTelegramAvailable":
      "Use the Telegram button below (domain must be set in @BotFather).",
    "auth.statusTelegramUnavailable":
      "Telegram needs TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.",
  },
  fr: {
    "community.optionBuild": "build",
    "community.optionBuildCount": "build ({count})",
    "community.optionNone": "aucun",
    "auth.statusDiscordAvailable": "Connexion Discord disponible.",
    "auth.statusDiscordUnavailable": "Discord n'est pas configuré sur le serveur.",
    "auth.statusTelegramAvailable":
      "Utilisez le bouton Telegram ci-dessous (domaine à configurer dans @BotFather).",
    "auth.statusTelegramUnavailable":
      "Telegram nécessite TELEGRAM_BOT_TOKEN et TELEGRAM_BOT_USERNAME.",
  },
  "pt-BR": {
    "community.optionBuild": "build",
    "community.optionBuildCount": "build ({count})",
    "community.optionNone": "nenhum",
    "auth.statusDiscordAvailable": "Login Discord disponível.",
    "auth.statusDiscordUnavailable": "Discord não está configurado no servidor.",
    "auth.statusTelegramAvailable":
      "Use o botão Telegram abaixo (domínio deve estar no @BotFather).",
    "auth.statusTelegramUnavailable":
      "Telegram precisa de TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME.",
  },
  id: {
    "community.optionBuild": "build",
    "community.optionBuildCount": "build ({count})",
    "community.optionNone": "tidak ada",
    "auth.statusDiscordAvailable": "Login Discord tersedia.",
    "auth.statusDiscordUnavailable": "Discord belum dikonfigurasi di server.",
    "auth.statusTelegramAvailable":
      "Gunakan tombol Telegram di bawah (domain harus di @BotFather).",
    "auth.statusTelegramUnavailable":
      "Telegram membutuhkan TELEGRAM_BOT_TOKEN dan TELEGRAM_BOT_USERNAME.",
  },
  vi: {
    "community.optionBuild": "build",
    "community.optionBuildCount": "build ({count})",
    "community.optionNone": "không",
    "auth.statusDiscordAvailable": "Đăng nhập Discord khả dụng.",
    "auth.statusDiscordUnavailable": "Discord chưa được cấu hình trên máy chủ.",
    "auth.statusTelegramAvailable":
      "Dùng nút Telegram bên dưới (tên miền phải cấu hình trong @BotFather).",
    "auth.statusTelegramUnavailable":
      "Telegram cần TELEGRAM_BOT_TOKEN và TELEGRAM_BOT_USERNAME.",
  },
};

const files = {
  en: "locales/en.json",
  fr: "locales/fr.json",
  "pt-BR": "locales/pt-BR.json",
  id: "locales/id.json",
  vi: "locales/vi.json",
};

for (const [loc, rel] of Object.entries(files)) {
  const file = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(data, adds[loc]);
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("patched", loc, Object.keys(adds[loc]).length, "keys");
}
