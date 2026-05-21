"""Replace the stream overlay QR with https://build-sim.pages.dev/ (run after updating overlay art)."""
from __future__ import annotations

import sys
from pathlib import Path

import qrcode
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OVERLAY_IN = ROOT / "assets" / "stream-overlay-source.png"
OVERLAY_OUT = ROOT / "assets" / "stream-overlay.png"
SITE_QR_OUT = ROOT / "assets" / "build-sim-site-qr.png"
URL = "https://build-sim.pages.dev/"

# Inner white QR panel on 1024×576 overlay (above URL pills)
QR_BOX = (892, 368, 1018, 494)


def main() -> None:
    src = OVERLAY_IN if OVERLAY_IN.is_file() else None
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
    if not src or not src.is_file():
        print("Usage: python tools/compose-stream-overlay-qr.py [path/to/overlay-source.png]")
        print(f"Or place source at {OVERLAY_IN}")
        sys.exit(1)

    x0, y0, x1, y1 = QR_BOX
    inner_w, inner_h = x1 - x0, y1 - y0

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=8,
        border=2,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#120818", back_color="#ffffff").convert("RGBA")
    qr_img = qr_img.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    qr_img.save(SITE_QR_OUT, optimize=True)

    base = Image.open(src).convert("RGBA")
    white = Image.new("RGBA", (inner_w, inner_h), (255, 255, 255, 255))
    base.paste(white, (x0, y0))
    base.paste(qr_img, (x0, y0), qr_img)
    base.convert("RGB").save(OVERLAY_OUT, format="PNG", optimize=True)
    print(f"Wrote {SITE_QR_OUT.name} and {OVERLAY_OUT.name}")


if __name__ == "__main__":
    main()
