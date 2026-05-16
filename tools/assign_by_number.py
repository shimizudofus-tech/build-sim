#!/usr/bin/env python3
"""
Copie assets/import/<numéro> vers assets/png/<nom officiel>.png
Ordre : tools/ORDER.txt (57 fichiers : 9 passifs, 16 sorts, 16 EVO, 16 mythiques).

Noms source acceptés par numéro n : 1.png, 01.png, 001.png (idem .jpg / .webp).
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORT = ROOT / "assets" / "import"
OUT = ROOT / "assets" / "png"
ORDER_FILE = Path(__file__).resolve().parent / "ORDER.txt"
LOG_FILE = Path(__file__).resolve().parent / "last_copy.log"

_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def log(msg: str) -> None:
    print(msg)
    with LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(msg + "\n")


def load_targets() -> list[str]:
    text = ORDER_FILE.read_text(encoding="utf-8")
    lines: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("Numérote") or line.startswith("01–"):
            continue
        if line.startswith("Liste"):
            continue
        if line.endswith(".png"):
            lines.append(line)
    return lines


def _stem_candidates(n: int) -> list[str]:
    stems = [f"{n:03d}", f"{n:02d}", str(n)]
    out: list[str] = []
    seen: set[str] = set()
    for s in stems:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def build_import_index() -> dict[int, Path]:
    """Tous les fichiers image dont le nom (sans extension) est un entier."""
    index: dict[int, Path] = {}
    if not IMPORT.is_dir():
        return index
    for p in IMPORT.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in _EXTS:
            continue
        stem = p.stem.strip()
        if stem.isdigit():
            num = int(stem)
            if num not in index:
                index[num] = p
    return index


def find_numbered_file(n: int, index: dict[int, Path]) -> Path | None:
    if n in index:
        return index[n]
    for stem in _stem_candidates(n):
        for ext in _EXTS:
            p = IMPORT / f"{stem}{ext}"
            if p.is_file():
                return p
    return None


def list_import_images() -> list[Path]:
    if not IMPORT.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(IMPORT.iterdir()):
        if p.is_file() and p.suffix.lower() in _EXTS:
            out.append(p)
    return out


def list_unused_numbered(index: dict[int, Path], max_used: int) -> list[Path]:
    return [index[k] for k in sorted(index) if k > max_used]


def copy_prefixed_from_import(targets: set[str]) -> int:
    """Fichiers déjà nommés skill-*.png etc. dans import/."""
    n = 0
    for p in list_import_images():
        name = p.name.lower()
        if name not in targets:
            continue
        shutil.copy2(p, OUT / name)
        log(f"     {p.name}  ->  assets/png/{name} (nom déjà correct)")
        n += 1
    return n


def main() -> int:
    LOG_FILE.write_text("", encoding="utf-8")
    log(f"Dossier import : {IMPORT.resolve()}")
    log(f"Dossier sortie  : {OUT.resolve()}")

    images = list_import_images()
    log(f"Images trouvées dans import/ : {len(images)}")
    for p in images[:20]:
        log(f"  - {p.name}")
    if len(images) > 20:
        log(f"  ... et {len(images) - 20} autres")

    if not images:
        log("\nAucune image dans assets/import/.")
        log("Place tes fichiers 1.png … 57.png (ou .jpg) dans ce dossier, puis relance.")
        return 1

    targets = load_targets()
    if not targets:
        log("ORDER.txt invalide ou vide.")
        return 1

    target_set = {t.lower() for t in targets}
    OUT.mkdir(parents=True, exist_ok=True)
    copied = copy_prefixed_from_import(target_set)
    if copied >= len(targets):
        log(f"\nOK : {copied} fichiers (noms déjà officiels) dans assets/png/")
        log("Recharge index.html dans le navigateur (Ctrl+F5).")
        return 0

    index = build_import_index()
    missing: list[int] = []

    for i, target in enumerate(targets, start=1):
        src = find_numbered_file(i, index)
        if not src:
            missing.append(i)
            continue
        dst = OUT / target
        shutil.copy2(src, dst)
        copied += 1
        log(f"{i:02d}  {src.name}  ->  assets/png/{target}")

    if missing:
        log(f"\nManquants (numéros attendus) : {missing}")
        log("Noms acceptés : 1.png, 01.png, 001.png (même chose en .jpg / .webp).")
        log(f"Copiés quand même : {copied}/{len(targets)}")
        return 1

    extra = list_unused_numbered(index, len(targets))
    if extra:
        log("\nFichiers numérotés non utilisés (>57) : " + ", ".join(p.name for p in extra))

    log(f"\nOK : {copied} fichiers dans assets/png/")
    log("Recharge index.html dans le navigateur (Ctrl+F5).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
