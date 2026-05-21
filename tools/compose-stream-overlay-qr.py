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

# Purple-framed QR zone on 1024×576 overlay (above URL pills)
QR_FRAME = (892, 368, 1018, 494)
QR_PAD = 4


def qr_box_half_centered(frame: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    fx0, fy0, fx1, fy1 = frame
    fw, fh = fx1 - fx0, fy1 - fy0
    qw, qh = fw // 2, fh // 2
    cx, cy = (fx0 + fx1) // 2, (fy0 + fy1) // 2
    return (cx - qw // 2, cy - qh // 2, cx + qw // 2, cy + qh // 2)


def make_site_qr(size: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#120818", back_color="#ffffff").convert("RGBA")
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    src = OVERLAY_IN if OVERLAY_IN.is_file() else None
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
    if not src or not src.is_file():
        print("Usage: python tools/compose-stream-overlay-qr.py [path/to/overlay-source.png]")
        print(f"Or place source at {OVERLAY_IN}")
        sys.exit(1)

    fx0, fy0, fx1, fy1 = QR_FRAME
    frame_w, frame_h = fx1 - fx0, fy1 - fy0
    x0, y0, x1, y1 = qr_box_half_centered(QR_FRAME)
    qw, qh = x1 - x0, y1 - y0

    qr_hi = make_site_qr(256)
    qr_hi.save(SITE_QR_OUT, optimize=True)
    qr_img = qr_hi.resize((qw, qh), Image.Resampling.LANCZOS)

    base = Image.open(src).convert("RGBA")
    sample = base.getpixel((fx0 + 4, fy0 + 8))
    if not isinstance(sample, tuple):
        sample = (40, 20, 55, 255)
    elif len(sample) == 3:
        sample = (*sample, 255)
    backdrop = Image.new("RGBA", (frame_w, frame_h), sample)
    base.paste(backdrop, (fx0, fy0))

    white = Image.new("RGBA", (qw + QR_PAD * 2, qh + QR_PAD * 2), (255, 255, 255, 255))
    base.paste(white, (x0 - QR_PAD, y0 - QR_PAD))
    base.paste(qr_img, (x0, y0), qr_img)
    base.convert("RGB").save(OVERLAY_OUT, format="PNG", optimize=True)
    print(f"Wrote {SITE_QR_OUT.name} and {OVERLAY_OUT.name} ({qw}×{qh} px QR)")


if __name__ == "__main__":
    main()
