#!/usr/bin/env python3
"""
Convertit / redimensionne des icônes vers assets/png/ au format attendu par index.html.

Usage:
  1. Copie tes images sources dans ../assets/import/ (n'importe quel nom).
  2. Édite mapping.csv : colonne source = nom fichier dans import/, colonne target = nom final (ex. skill-purple_bat.png).
  3. Depuis ce dossier tools/ :
       pip install pillow
       python convert_icons.py

  Si un fichier dans import/ porte déjà le bon nom (ex. skill-purple_bat.png), il sera pris en compte même sans ligne CSV.
"""

from __future__ import annotations

import csv
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Installe Pillow : pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
IMPORT_DIR = ROOT / "assets" / "import"
OUT_DIR = ROOT / "assets" / "png"
MAPPING = Path(__file__).resolve().parent / "mapping.csv"

# Taille cible (carré), conserve le ratio avec fond transparent
SIZE = 64
VALID_PREFIXES = ("skill-", "passive-", "evo-", "mythic-")


def resize_to_png(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    im.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    x = (SIZE - im.width) // 2
    y = (SIZE - im.height) // 2
    canvas.paste(im, (x, y), im)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "PNG")


def is_valid_target(name: str) -> bool:
    n = name.lower().strip()
    if not n.endswith(".png"):
        return False
    stem = n[:-4]
    return any(stem.startswith(p) for p in VALID_PREFIXES)


def main() -> None:
    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pairs: list[tuple[Path, str]] = []

    # 1) Fichiers déjà bien nommés dans import/
    if IMPORT_DIR.is_dir():
        for f in sorted(IMPORT_DIR.iterdir()):
            if f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                continue
            if is_valid_target(f.name):
                pairs.append((f, f.name.lower()))

    # 2) mapping.csv : source,target
    if MAPPING.is_file():
        with MAPPING.open(newline="", encoding="utf-8") as fp:
            for row in csv.DictReader(fp):
                src_name = (row.get("source") or row.get("Source") or "").strip()
                tgt_name = (row.get("target") or row.get("Target") or "").strip()
                if not src_name or not tgt_name:
                    continue
                if not tgt_name.lower().endswith(".png"):
                    tgt_name += ".png"
                if not is_valid_target(tgt_name):
                    print(f"Ignoré (target invalide): {tgt_name}", file=sys.stderr)
                    continue
                src_path = IMPORT_DIR / src_name
                if not src_path.is_file():
                    print(f"Manquant: {src_path}", file=sys.stderr)
                    continue
                pairs.append((src_path, tgt_name.lower()))

    if not pairs:
        print(f"Aucune paire à convertir. Mets des images dans :\n  {IMPORT_DIR}\n")
        print("Nomme-les comme skill-purple_bat.png, etc., ou remplis tools/mapping.csv (voir mapping.example.csv).")
        sys.exit(1)

    seen: set[str] = set()
    for src, target_name in pairs:
        if target_name in seen:
            continue
        seen.add(target_name)
        dst = OUT_DIR / target_name
        print(f"{src.name} -> {dst.relative_to(ROOT)}")
        resize_to_png(src, dst)

    print(f"\nTerminé : {len(seen)} fichier(s) dans {OUT_DIR}")


if __name__ == "__main__":
    main()
