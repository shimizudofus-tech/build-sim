import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const patches = {
  en: {
    "chat.tabMessages": "Messages",
    "chat.tabOnline": "Online",
    "chat.tabsAria": "Chat sections",
    "chat.onlineCount": "{count} online",
    "chat.onlineHint": "Active visitors in the last 5 minutes.",
    "profile.linkedMembersShort": "Builders",
    "profile.linkedMembersAria": "Builders signed in with Discord or Telegram",
    "profile.linkedMembersTitle": "{count} Builders with Discord or Telegram",
  },
  fr: {
    "chat.tabMessages": "Messages",
    "chat.tabOnline": "En ligne",
    "chat.tabsAria": "Sections du chat",
    "chat.onlineCount": "{count} en ligne",
    "chat.onlineHint": "Visiteurs actifs sur les 5 dernières minutes.",
    "profile.linkedMembersShort": "Membres",
    "profile.linkedMembersAria": "Membres connectés via Discord ou Telegram",
    "profile.linkedMembersTitle": "{count} membres via Discord ou Telegram",
  },
  "pt-BR": {
    "chat.tabMessages": "Mensagens",
    "chat.tabOnline": "Online",
    "chat.tabsAria": "Seções do chat",
    "chat.onlineCount": "{count} online",
    "chat.onlineHint": "Visitantes ativos nos últimos 5 minutos.",
    "profile.linkedMembersShort": "Builders",
    "profile.linkedMembersAria": "Builders com Discord ou Telegram",
    "profile.linkedMembersTitle": "{count} Builders com Discord ou Telegram",
  },
  id: {
    "chat.tabMessages": "Pesan",
    "chat.tabOnline": "Online",
    "chat.tabsAria": "Bagian chat",
    "chat.onlineCount": "{count} online",
    "chat.onlineHint": "Pengunjung aktif dalam 5 menit terakhir.",
    "profile.linkedMembersShort": "Builders",
    "profile.linkedMembersAria": "Builder masuk dengan Discord atau Telegram",
    "profile.linkedMembersTitle": "{count} Builder dengan Discord atau Telegram",
  },
  vi: {
    "chat.tabMessages": "Tin nhắn",
    "chat.tabOnline": "Trực tuyến",
    "chat.tabsAria": "Phần chat",
    "chat.onlineCount": "{count} trực tuyến",
    "chat.onlineHint": "Người truy cập hoạt động trong 5 phút qua.",
    "profile.linkedMembersShort": "Builders",
    "profile.linkedMembersAria": "Builder đăng nhập bằng Discord hoặc Telegram",
    "profile.linkedMembersTitle": "{count} Builder qua Discord hoặc Telegram",
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
  Object.assign(data, patches[loc]);
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("patched", loc);
}
