/**
 * Build pt-BR, id, vi from fr.json (primary) with locale-specific overrides.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const fr = JSON.parse(fs.readFileSync(path.join(root, "locales/fr.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "locales/en.json"), "utf8"));

/** @param {Record<string,string>} base @param {Record<string,string>} overrides */
function merge(base, overrides) {
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) out[k] = v;
  return out;
}

// Portuguese (from French UI strings — readable PT)
const ptOverrides = {};
for (const [k, v] of Object.entries(fr)) {
  let s = v;
  s = s
    .replace(/Connexion/g, "Entrar")
    .replace(/Déconnexion/g, "Sair")
    .replace(/Communauté/g, "Comunidade")
    .replace(/Simulateur/g, "Simulador")
    .replace(/Classements/g, "Rankings")
    .replace(/Recettes/g, "Receitas")
    .replace(/Bientôt/g, "Em breve")
    .replace(/Langue/g, "Idioma")
    .replace(/Visites/g, "Visitas")
    .replace(/Personnage/g, "Personagem")
    .replace(/Mode de jeu/g, "Modo de jogo")
    .replace(/Réinitialiser le build/g, "Resetar build")
    .replace(/Annuler la dernière fusion/g, "Desfazer última fusão")
    .replace(/Niveau du build/g, "Nível do build")
    .replace(/Mythique disponible/g, "Mítico disponível")
    .replace(/Skill actif/g, "Skill ativo")
    .replace(/Passif/g, "Passivo")
    .replace(/Publier/g, "Publicar")
    .replace(/Difficulté/g, "Dificuldade")
    .replace(/Très facile/g, "Muito fácil")
    .replace(/Facile/g, "Fácil")
    .replace(/Moyen/g, "Médio")
    .replace(/Difficile/g, "Difícil")
    .replace(/Très difficile/g, "Muito difícil")
    .replace(/Non noté/g, "Sem nota")
    .replace(/Chargement/g, "Carregando")
    .replace(/Indisponible/g, "Indisponível")
    .replace(/Envoyer/g, "Enviar")
    .replace(/Actualiser/g, "Atualizar")
    .replace(/Copier/g, "Copiar")
    .replace(/Voter/g, "Votar")
    .replace(/Voté/g, "Votado")
    .replace(/Supprimer/g, "Excluir")
    .replace(/Appliquer ce build/g, "Aplicar este build")
    .replace(/Tous les personnages/g, "Todos os personagens")
    .replace(/Toute puissance/g, "Toda potência")
    .replace(/Puissance/g, "Potência")
    .replace(/Français/g, "Francês")
    .replace(/Anglais/g, "Inglês")
    .replace(/Portugais \(Brésil\)/g, "Português (Brasil)")
    .replace(/Indonésien/g, "Indonésio")
    .replace(/Vietnamien/g, "Vietnamita");
  ptOverrides[k] = s;
}

// Indonesian — start from en, overlay fr structure keys with ID translations for main UI
const idOverrides = {
  ...en,
  "seo.title": "Simulator Build Spekter Agency - EVO, Mythic & Komunitas",
  "seo.description":
    "Buat, uji, dan bagikan build Spekter Agency dengan skill, pasif, resep EVO, fusi mythic, dan peringkat komunitas.",
  "lang.label": "Bahasa",
  "nav.siteTitle": "Builder Spekter Agency",
  "nav.visits": "Kunjungan: {count}",
  "nav.buildMain": "Build",
  "nav.buildSub": "Simulator",
  "nav.communityMain": "Komunitas",
  "nav.communitySub": "Peringkat",
  "nav.bookMain": "Buku",
  "nav.bookSub": "Resep",
  "nav.miniGamesMain": "Mini game",
  "nav.miniGamesSub": "Segera",
  "profile.signIn": "Masuk",
  "profile.logout": "Keluar",
  "profile.notSignedIn": "Belum masuk",
  "builder.reset": "Reset build",
  "builder.publish": "Publikasi build saat ini",
  "community.title": "Build komunitas",
  "community.vote": "Pilih",
  "community.loading": "Memuat build online…",
  "chat.send": "Kirim",
  "chat.title": "Obrolan langsung",
};

// Vietnamese
const viOverrides = {
  ...en,
  "seo.title": "Mô phỏng build Spekter Agency - EVO, Huyền thoại & Cộng đồng",
  "seo.description":
    "Tạo, thử và chia sẻ build Spekter Agency với skill, passive, công thức EVO, hợp nhất huyền thoại và bảng xếp hạng cộng đồng.",
  "lang.label": "Ngôn ngữ",
  "nav.siteTitle": "Builder Spekter Agency",
  "nav.visits": "Lượt truy cập: {count}",
  "nav.buildSub": "Mô phỏng",
  "nav.communityMain": "Cộng đồng",
  "nav.communitySub": "Xếp hạng",
  "nav.bookSub": "Công thức",
  "nav.miniGamesSub": "Sắp ra",
  "profile.signIn": "Đăng nhập",
  "profile.logout": "Đăng xuất",
  "profile.notSignedIn": "Chưa đăng nhập",
  "builder.reset": "Đặt lại build",
  "builder.publish": "Đăng build hiện tại",
  "community.title": "Build cộng đồng",
  "community.vote": "Bình chọn",
  "community.loading": "Đang tải build trực tuyến…",
  "chat.send": "Gửi",
  "chat.title": "Chat trực tiếp",
};

// pt-BR: fr-based with PT word swaps, fallback en for untranslated-looking French
const ptBR = {};
for (const k of Object.keys(en)) {
  ptBR[k] = ptOverrides[k] ?? fr[k] ?? en[k];
}

// id/vi: merge overrides onto full en keys
const id = { ...en, ...idOverrides };
const vi = { ...en, ...viOverrides };

// Fill id/vi missing with fr where different from en (better than raw EN for some)
for (const k of Object.keys(en)) {
  if (fr[k] && fr[k] !== en[k]) {
    if (id[k] === en[k]) id[k] = fr[k];
    if (vi[k] === en[k]) vi[k] = fr[k];
  }
}

fs.writeFileSync(path.join(root, "locales/pt-BR.json"), JSON.stringify(ptBR, null, 2));
fs.writeFileSync(path.join(root, "locales/id.json"), JSON.stringify(id, null, 2));
fs.writeFileSync(path.join(root, "locales/vi.json"), JSON.stringify(vi, null, 2));
console.log("wrote pt-BR, id, vi");
