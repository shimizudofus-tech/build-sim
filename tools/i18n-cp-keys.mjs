import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const patches = {
  en: {
    "builder.cp": "CP",
    "builder.cpAria": "CP",
    "builder.cpPlaceholder": "e.g. 1.5M",
    "community.allPower": "All CP",
    "community.power": "CP",
    "community.powerAria": "CP",
    "community.powerLabel": "CP",
    "community.powerRequired": "CP is required.",
    "community.powerInvalid": "Enter a valid CP (e.g. 1.5M).",
    "community.cpFilterMax": "CP <= {cap}",
    "community.bossSortTag":
      "Boss builds for {character} ({power}) are sorted by votes, then lower CP, then Boss damage.",
    "api.cpRequired": "CP is required.",
    "api.cpInvalid": "Invalid CP format. Use e.g. 1.5M.",
  },
  fr: {
    "builder.cp": "CP",
    "builder.cpAria": "CP",
    "builder.cpPlaceholder": "ex. 1,5M",
    "community.allPower": "Tous les CP",
    "community.power": "CP",
    "community.powerAria": "CP",
    "community.powerLabel": "CP",
    "community.powerRequired": "Le CP est obligatoire.",
    "community.powerInvalid": "Entrez un CP valide (ex. 1,5M).",
    "community.cpFilterMax": "CP <= {cap}",
    "community.bossSortTag":
      "Les builds boss pour {character} ({power}) sont triés par votes, puis CP le plus bas, puis dégâts boss.",
    "api.cpRequired": "Le CP est obligatoire.",
    "api.cpInvalid": "Format de CP invalide. Ex. 1,5M.",
  },
  "pt-BR": {
    "builder.cp": "CP",
    "builder.cpAria": "CP",
    "builder.cpPlaceholder": "ex. 1,5M",
    "community.allPower": "Todos os CP",
    "community.power": "CP",
    "community.powerAria": "CP",
    "community.powerLabel": "CP",
    "community.powerRequired": "CP é obrigatório.",
    "community.powerInvalid": "Informe um CP válido (ex. 1,5M).",
    "community.cpFilterMax": "CP <= {cap}",
    "community.bossSortTag":
      "Builds de Boss para {character} ({power}) são ordenados por votos, depois menor CP, depois dano ao Boss.",
    "api.cpRequired": "CP é obrigatório.",
    "api.cpInvalid": "Formato de CP inválido. Ex. 1,5M.",
  },
  id: {
    "builder.cp": "CP",
    "builder.cpAria": "CP",
    "builder.cpPlaceholder": "mis. 1,5M",
    "community.allPower": "Semua CP",
    "community.power": "CP",
    "community.powerAria": "CP",
    "community.powerLabel": "CP",
    "community.powerRequired": "CP wajib diisi.",
    "community.powerInvalid": "Masukkan CP yang valid (mis. 1,5M).",
    "community.cpFilterMax": "CP <= {cap}",
    "community.bossSortTag":
      "Build Boss untuk {character} ({power}) diurutkan menurut suara, lalu CP lebih rendah, lalu damage Boss.",
    "api.cpRequired": "CP wajib diisi.",
    "api.cpInvalid": "Format CP tidak valid. Mis. 1,5M.",
  },
  vi: {
    "builder.cp": "CP",
    "builder.cpAria": "CP",
    "builder.cpPlaceholder": "vd. 1,5M",
    "community.allPower": "Mọi CP",
    "community.power": "CP",
    "community.powerAria": "CP",
    "community.powerLabel": "CP",
    "community.powerRequired": "Bắt buộc nhập CP.",
    "community.powerInvalid": "Nhập CP hợp lệ (vd. 1,5M).",
    "community.cpFilterMax": "CP <= {cap}",
    "community.bossSortTag":
      "Build Boss cho {character} ({power}) được sắp theo bình chọn, rồi CP thấp hơn, rồi sát thương Boss.",
    "api.cpRequired": "Bắt buộc nhập CP.",
    "api.cpInvalid": "Định dạng CP không hợp lệ. Vd. 1,5M.",
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
  delete data["builder.powerOptional"];
  Object.assign(data, patches[loc]);
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("patched", loc);
}
