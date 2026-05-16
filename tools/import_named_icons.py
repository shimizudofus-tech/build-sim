#!/usr/bin/env python3
"""
Copie des icônes déjà nommées vers assets/png/.

Dossiers sources (dans l'ordre, le premier avec des images gagne si pas d'argument) :
  assets/icone/   ← dossier « icone » (vrais noms)
  assets/icones/
  assets/import/

Noms attendus : passive-*.png, skill-*.png, evo-*.png, mythic-*.png
(voir tools/ORDER.txt). Variantes acceptées : tirets/underscores, majuscules.

Usage:
  python tools/import_named_icons.py
  python tools/import_named_icons.py "C:\\chemin\\vers\\icone"
"""

from __future__ import annotations

import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "png"
IMPORT = ROOT / "assets" / "import"
ORDER_FILE = Path(__file__).resolve().parent / "ORDER.txt"
LOG_FILE = Path(__file__).resolve().parent / "last_copy.log"
INVENTORY_FILE = Path(__file__).resolve().parent / "inventaire-icones.txt"
VERSION_FILE = ROOT / "assets" / "icon-version.txt"

SOURCE_DIRS = [
    ROOT / "assets" / "icone",
    ROOT / "assets" / "icones",
    ROOT / "assets" / "import",
]

_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

# Anciens noms → nom officiel (ORDER.txt)
ALIASES: dict[str, str] = {
    "skill-purple_eye.png": "skill-binding_chain.png",
    "skill-purple-eye.png": "skill-binding_chain.png",
    "skill-binding-chain.png": "skill-binding_chain.png",
    "mythic-vortex_aegis.png": "mythic-buldak-red.png",
    "vortex_aegis.png": "mythic-buldak-red.png",
    "buldak-red.png": "mythic-buldak-red.png",
    "fire-field-purple.png": "evo-fire-field-mauve.png",
}


def log(msg: str) -> None:
    print(msg)
    with LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(msg + "\n")


def load_targets() -> list[str]:
    text = ORDER_FILE.read_text(encoding="utf-8")
    return [ln.strip() for ln in text.splitlines() if ln.strip().endswith(".png")]


def canonical_png_name(stem: str) -> str:
    """passive_sword / Passive-Sword → passive-sword.png"""
    s = stem.strip().lower().replace(" ", "_")
    s = re.sub(r"_+", "_", s)
    for prefix in ("passive", "skill", "evo", "mythic"):
        if s.startswith(prefix + "_"):
            s = prefix + "-" + s[len(prefix) + 1 :]
            break
    s = s.replace("_", "-")
    if not s.endswith(".png"):
        s += ".png"
    return s


def target_index(targets: list[str]) -> dict[str, str]:
    """suffix (sans préfixe type) → nom officiel."""
    idx: dict[str, str] = {}
    for name in targets:
        for prefix in ("passive-", "skill-", "evo-", "mythic-"):
            if name.startswith(prefix):
                suffix = name[len(prefix) :]
                idx[suffix] = name
                stem = suffix.removesuffix(".png")
                idx[stem.replace("-", "_")] = name
                break
    return idx


def collect_files(dirs: list[Path]) -> tuple[dict[str, Path], list[Path], Path | None]:
    """Retourne (found officiel→path, fichiers non mappés, dossier principal utilisé)."""
    found: dict[str, Path] = {}
    unmapped: list[Path] = []
    used_dir: Path | None = None
    targets = load_targets()
    by_suffix = target_index(targets)
    official = {t.lower() for t in targets}

    def register(key: str, path: Path) -> None:
        key = key.lower()
        key = ALIASES.get(key, key)
        if key not in official:
            return
        prev = found.get(key)
        if prev is None or path.suffix.lower() == ".png":
            found[key] = path

    for d in dirs:
        if not d.is_dir():
            continue
        has_images = False
        for p in sorted(d.iterdir()):
            if not p.is_file() or p.suffix.lower() not in _EXTS:
                continue
            has_images = True
            if used_dir is None:
                used_dir = d

            stem = p.stem
            keys_to_try: list[str] = []

            # Nom déjà complet
            keys_to_try.append(canonical_png_name(stem))

            # Préfixe manquant : sword.png → passive-sword si unique
            bare = canonical_png_name(stem)
            if not any(
                bare.startswith(p + "-")
                for p in ("passive", "skill", "evo", "mythic")
            ):
                bare_stem = bare.removesuffix(".png")
                for prefix in ("passive", "skill", "evo", "mythic"):
                    keys_to_try.append(f"{prefix}-{bare_stem}.png")
                if bare_stem in by_suffix:
                    keys_to_try.append(by_suffix[bare_stem])

            matched = False
            for k in keys_to_try:
                k = ALIASES.get(k.lower(), k.lower())
                if k in official:
                    register(k, p)
                    matched = True
                    break
            if not matched:
                unmapped.append(p)

    return found, unmapped, used_dir


def pick_source_dirs(extra: Path | None) -> list[Path]:
    if extra and extra.is_dir():
        return [extra.resolve()]
    for d in SOURCE_DIRS:
        if d.is_dir():
            n = sum(
                1
                for p in d.iterdir()
                if p.is_file() and p.suffix.lower() in _EXTS
            )
            if n > 0:
                return [d]
    return [d for d in SOURCE_DIRS if d.is_dir()]


def write_inventory(
    dirs: list[Path],
    found: dict[str, Path],
    unmapped: list[Path],
    targets: list[str],
) -> None:
    lines: list[str] = []
    lines.append("Inventaire icônes — généré par import_named_icons.py")
    lines.append("")
    for d in dirs:
        lines.append(f"Dossier scanné : {d}")
        if d.is_dir():
            imgs = [
                p.name
                for p in sorted(d.iterdir())
                if p.is_file() and p.suffix.lower() in _EXTS
            ]
            lines.append(f"  Fichiers image : {len(imgs)}")
            for name in imgs:
                lines.append(f"    {name}")
        else:
            lines.append("  (absent)")
        lines.append("")

    lines.append(f"Placés dans assets/png/ : {len(found)}/{len(targets)}")
    missing = [t for t in targets if t.lower() not in found]
    if missing:
        lines.append("")
        lines.append("Manquants (nom attendu → numéro import) :")
        for i, name in enumerate(targets, start=1):
            if name in missing:
                lines.append(f"  #{i:02d}  {name}")

    if unmapped:
        lines.append("")
        lines.append("Fichiers non reconnus (vérifie le nom ou donne le numéro #) :")
        for p in unmapped:
            lines.append(f"  ?  {p.name}")

    INVENTORY_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_import_index() -> dict[int, Path]:
    """Fichiers assets/import/ dont le nom est un numéro (1, 01, 001…)."""
    index: dict[int, Path] = {}
    if not IMPORT.is_dir():
        return index
    for p in IMPORT.iterdir():
        if not p.is_file() or p.suffix.lower() not in _EXTS:
            continue
        stem = p.stem.strip()
        if stem.isdigit():
            num = int(stem)
            if num not in index:
                index[num] = p
    return index


def find_numbered_import(n: int, index: dict[int, Path]) -> Path | None:
    if n in index:
        return index[n]
    for stem in (f"{n:03d}", f"{n:02d}", str(n)):
        for ext in _EXTS:
            p = IMPORT / f"{stem}{ext}"
            if p.is_file():
                return p
    return None


def fill_missing_from_import(targets: list[str], missing: list[str]) -> int:
    """Complète assets/png/ avec import/01.png… pour les noms absents de icone/."""
    if not missing:
        return 0
    index = build_import_index()
    filled = 0
    for i, name in enumerate(targets, start=1):
        if name not in missing:
            continue
        src = find_numbered_import(i, index)
        if not src:
            continue
        shutil.copy2(src, OUT / name)
        log(f"  {src.name}  ->  assets/png/{name} (import #{i:02d}, icone manquant)")
        filled += 1
    return filled


def main() -> int:
    LOG_FILE.write_text("", encoding="utf-8")
    extra = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
    dirs = pick_source_dirs(extra)
    targets = load_targets()
    if not targets:
        log("ORDER.txt : aucun nom .png trouvé.")
        return 1

    found, unmapped, used_dir = collect_files(dirs)
    write_inventory(dirs, found, unmapped, targets)

    log(f"Dossiers : {', '.join(str(d) for d in dirs)}")
    log(f"Fichiers reconnus : {len(found)}")
    if unmapped:
        log(f"Non reconnus : {len(unmapped)} (voir inventaire-icones.txt)")

    OUT.mkdir(parents=True, exist_ok=True)
    copied = 0
    missing: list[str] = []

    for name in targets:
        src = found.get(name.lower())
        if not src:
            missing.append(name)
            continue
        dst = OUT / name
        shutil.copy2(src, dst)
        copied += 1
        log(f"  {src.name}  ->  assets/png/{name}")

    if missing:
        log(f"\nManquants dans icone/ ({len(missing)}) — complément import/ :")
        for i, name in enumerate(targets, start=1):
            if name in missing:
                log(f"  #{i:02d}  {name}")
        filled = fill_missing_from_import(targets, missing)
        copied += filled
        still = [t for t in missing if not (OUT / t).is_file()]
        if still:
            log(f"\nToujours manquants ({len(still)}) :")
            for name in still:
                log(f"  - {name}")

    log(f"\n{copied}/{len(targets)} icônes dans assets/png/")
    log(f"Inventaire : tools/inventaire-icones.txt")

    if copied == len(targets):
        VERSION_FILE.write_text(str(int(time.time())), encoding="utf-8")
        log(f"Version cache : {VERSION_FILE.name}")
        log("OK — icone/ + import/ (anciennes images pour les manquants). Recharge BUILDER (Ctrl+F5).")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
