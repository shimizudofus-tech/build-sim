import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const patches = {
  en: {
    "recentBuilds.aria": "Latest community builds",
    "recentBuilds.title": "Latest builds",
    "recentBuilds.empty": "No builds yet.",
    "recentBuilds.missing": "This build is no longer available.",
    "recentBuilds.open": "Open in Community",
  },
  fr: {
    "recentBuilds.aria": "Derniers builds communauté",
    "recentBuilds.title": "Derniers builds",
    "recentBuilds.empty": "Aucun build pour le moment.",
    "recentBuilds.missing": "Ce build n'est plus disponible.",
    "recentBuilds.open": "Ouvrir dans Communauté",
  },
  "pt-BR": {
    "recentBuilds.aria": "Últimos builds da comunidade",
    "recentBuilds.title": "Últimos builds",
    "recentBuilds.empty": "Nenhum build ainda.",
    "recentBuilds.missing": "Este build não está mais disponível.",
    "recentBuilds.open": "Abrir na Comunidade",
  },
  id: {
    "recentBuilds.aria": "Build komunitas terbaru",
    "recentBuilds.title": "Build terbaru",
    "recentBuilds.empty": "Belum ada build.",
    "recentBuilds.missing": "Build ini tidak tersedia lagi.",
    "recentBuilds.open": "Buka di Komunitas",
  },
  vi: {
    "recentBuilds.aria": "Build cộng đồng mới nhất",
    "recentBuilds.title": "Build mới nhất",
    "recentBuilds.empty": "Chưa có build.",
    "recentBuilds.missing": "Build này không còn.",
    "recentBuilds.open": "Mở trong Cộng đồng",
  },
};

for (const [loc, rel] of Object.entries({
  en: "locales/en.json",
  fr: "locales/fr.json",
  "pt-BR": "locales/pt-BR.json",
  id: "locales/id.json",
  vi: "locales/vi.json",
})) {
  const file = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(data, patches[loc]);
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("patched", loc);
}
