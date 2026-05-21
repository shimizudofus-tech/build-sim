"""Generate a scannable QR for https://build-sim.pages.dev/"""
from __future__ import annotations

from pathlib import Path

import qrcode
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "build-sim-site-qr.png"
URL = "https://build-sim.pages.dev"
# Taille overlay (généré en haute résolution puis réduit pour garder des modules nets)
OVERLAY_PX = 120


def make_qr(size: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=4,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size, size), Image.Resampling.NEAREST)


def main() -> None:
    # Rendu net : génération large puis downscale NEAREST
    hi = make_qr(320)
    hi.resize((OVERLAY_PX, OVERLAY_PX), Image.Resampling.NEAREST).save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({OVERLAY_PX}px) -> {URL}")


if __name__ == "__main__":
    main()
