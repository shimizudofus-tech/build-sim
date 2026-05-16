#!/usr/bin/env python3
"""Supprime les PNG dans assets/png/ qui ne sont pas listés dans ORDER.txt."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = Path(__file__).resolve().parent / "ORDER.txt"
PNG = ROOT / "assets" / "png"

keep = {
    ln.strip().lower()
    for ln in ORDER.read_text(encoding="utf-8").splitlines()
    if ln.strip().endswith(".png")
}
removed = []
for p in PNG.glob("*.png"):
    if p.name.lower() not in keep:
        p.unlink()
        removed.append(p.name)

print(f"Conservés : {len(keep)} | Supprimés : {len(removed)} | Restants : {len(list(PNG.glob('*.png')))}")
