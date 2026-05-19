import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const patches = {
  en: {
    "builder.powerCp": "Power (CP)",
    "builder.powerCpAria": "Power (CP)",
    "community.power": "Power (CP)",
    "community.powerAria": "Power (CP)",
    "community.powerLabel": "Power (CP)",
    "community.allPower": "All Power (CP)",
    "community.selectCp": "Select Power (CP)",
    "community.powerRequired": "Power (CP) is required.",
    "community.powerInvalid": "Select a Power (CP) from the list.",
    "community.cpFilterMax": "Power (CP) <= {cap}",
    "community.bossSortTag":
      "Boss builds for {character} ({power}) are sorted by votes, then lower Power (CP), then Boss damage.",
    "api.cpRequired": "Power (CP) is required.",
    "api.cpInvalid": "Invalid Power (CP) value.",
  },
  fr: {
    "builder.powerCp": "Puissance (CP)",
    "builder.powerCpAria": "Puissance (CP)",
    "community.power": "Puissance (CP)",
    "community.powerAria": "Puissance (CP)",
    "community.powerLabel": "Puissance (CP)",
    "community.allPower": "Toute puissance (CP)",
    "community.selectCp": "Choisir la puissance (CP)",
    "community.powerRequired": "La puissance (CP) est obligatoire.",
    "community.powerInvalid": "Choisissez une puissance (CP) dans la liste.",
    "community.cpFilterMax": "Puissance (CP) <= {cap}",
    "community.bossSortTag":
      "Les builds boss pour {character} ({power}) sont triés par votes, puis puissance (CP) la plus basse, puis dégâts boss.",
    "api.cpRequired": "La puissance (CP) est obligatoire.",
    "api.cpInvalid": "Valeur de puissance (CP) invalide.",
  },
  "pt-BR": {
    "builder.powerCp": "Power (CP)",
    "builder.powerCpAria": "Power (CP)",
    "community.power": "Power (CP)",
    "community.powerAria": "Power (CP)",
    "community.powerLabel": "Power (CP)",
    "community.allPower": "Todo Power (CP)",
    "community.selectCp": "Selecionar Power (CP)",
    "community.powerRequired": "Power (CP) é obrigatório.",
    "community.powerInvalid": "Selecione um Power (CP) na lista.",
    "community.cpFilterMax": "Power (CP) <= {cap}",
    "community.bossSortTag":
      "Builds de Boss para {character} ({power}) são ordenados por votos, depois menor Power (CP), depois dano ao Boss.",
    "api.cpRequired": "Power (CP) é obrigatório.",
    "api.cpInvalid": "Valor de Power (CP) inválido.",
  },
  id: {
    "builder.powerCp": "Power (CP)",
    "builder.powerCpAria": "Power (CP)",
    "community.power": "Power (CP)",
    "community.powerAria": "Power (CP)",
    "community.powerLabel": "Power (CP)",
    "community.allPower": "Semua Power (CP)",
    "community.selectCp": "Pilih Power (CP)",
    "community.powerRequired": "Power (CP) wajib diisi.",
    "community.powerInvalid": "Pilih Power (CP) dari daftar.",
    "community.cpFilterMax": "Power (CP) <= {cap}",
    "community.bossSortTag":
      "Build Boss untuk {character} ({power}) diurutkan menurut suara, lalu Power (CP) lebih rendah, lalu damage Boss.",
    "api.cpRequired": "Power (CP) wajib diisi.",
    "api.cpInvalid": "Nilai Power (CP) tidak valid.",
  },
  vi: {
    "builder.powerCp": "Sức mạnh (CP)",
    "builder.powerCpAria": "Sức mạnh (CP)",
    "community.power": "Sức mạnh (CP)",
    "community.powerAria": "Sức mạnh (CP)",
    "community.powerLabel": "Sức mạnh (CP)",
    "community.allPower": "Mọi sức mạnh (CP)",
    "community.selectCp": "Chọn sức mạnh (CP)",
    "community.powerRequired": "Bắt buộc chọn sức mạnh (CP).",
    "community.powerInvalid": "Chọn sức mạnh (CP) trong danh sách.",
    "community.cpFilterMax": "Sức mạnh (CP) <= {cap}",
    "community.bossSortTag":
      "Build Boss cho {character} ({power}) được sắp theo bình chọn, rồi sức mạnh (CP) thấp hơn, rồi sát thương Boss.",
    "api.cpRequired": "Bắt buộc chọn sức mạnh (CP).",
    "api.cpInvalid": "Giá trị sức mạnh (CP) không hợp lệ.",
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
  delete data["builder.cp"];
  delete data["builder.cpAria"];
  delete data["builder.cpPlaceholder"];
  Object.assign(data, patches[loc]);
  const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("patched", loc);
}
