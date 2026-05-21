"""Export stream overlay with a real alpha hole (OBS) and optional in-frame QR."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
import qrcode
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OVERLAY_IN = ROOT / "assets" / "stream-overlay-source.png"
OVERLAY_OUT = ROOT / "assets" / "stream-overlay.png"
SITE_QR_OUT = ROOT / "assets" / "build-sim-site-qr.png"
URL = "https://build-sim.pages.dev/"

QR_INNER = (886, 382, 1010, 508)
QR_QUIET = 8
QR_SIZE_RATIO = 0.72

PHONE_ASPECT = 10 / 16
HOLE_INSET_Y = 12
HOLE_INSET_X = 0
HOLE_SCALE = 1.06
HOLE_FEATHER = 4
# Zone d'encadrement intérieur (au-delà du damier détecté).
GUTTER_EXPAND_X = 58
GUTTER_EXPAND_Y = 22
SIDEBAR_LEFT_MAX = 212
SIDEBAR_RIGHT_MIN = 812
# Fond neutre de l'encadrement intérieur.
GUTTER_FILL_INNER = np.array([54, 52, 60], dtype=np.float32)
GUTTER_FILL_OUTER = np.array([46, 44, 52], dtype=np.float32)
LIGHTNING_MIN_SAT = 42


def checker_like_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    sat = np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])
    lum = (r + g + b) // 3
    return (sat <= 18) & (lum >= 12) & (lum <= 48)


def video_hole_mask(rgb: np.ndarray) -> np.ndarray:
    chk = checker_like_mask(rgb)
    h, w = chk.shape
    seeds = [(h // 2, w // 2), (h // 2, w // 3), (h // 2, 2 * w // 3)]
    best: set[tuple[int, int]] = set()
    for sy, sx in seeds:
        if not chk[sy, sx]:
            continue
        seen: set[tuple[int, int]] = set()
        q: deque[tuple[int, int]] = deque([(sy, sx)])
        while q:
            y, x = q.popleft()
            if (y, x) in seen or not chk[y, x]:
                continue
            seen.add((y, x))
            if y:
                q.append((y - 1, x))
            if y + 1 < h:
                q.append((y + 1, x))
            if x:
                q.append((y, x - 1))
            if x + 1 < w:
                q.append((y, x + 1))
        if len(seen) > len(best):
            best = seen
    mask = np.zeros(chk.shape, dtype=bool)
    for y, x in best:
        mask[y, x] = True
    return mask


def phone_hole_rect(full_hole: np.ndarray, aspect: float = PHONE_ASPECT) -> np.ndarray:
    ys, xs = np.where(full_hole)
    if len(xs) == 0:
        return np.zeros_like(full_hole)
    x0, x1 = int(xs.min()) + HOLE_INSET_X, int(xs.max()) - HOLE_INSET_X
    y0, y1 = int(ys.min()) + HOLE_INSET_Y, int(ys.max()) - HOLE_INSET_Y
    if x1 <= x0 or y1 <= y0:
        return full_hole.copy()
    avail_w = x1 - x0 + 1
    h = y1 - y0 + 1
    w = min(avail_w, max(1, int(h * aspect * HOLE_SCALE)))
    cx = (x0 + x1) // 2
    nx0 = max(x0, cx - w // 2)
    nx1 = min(x1, nx0 + w - 1)
    phone = np.zeros_like(full_hole)
    phone[y0 : y1 + 1, nx0 : nx1 + 1] = True
    return phone


def inner_gutter_mask(full_hole: np.ndarray, phone_rect: np.ndarray) -> np.ndarray:
    """Encadrement intérieur complet : bbox du damier élargi, moins le trou vidéo."""
    ys, xs = np.where(full_hole)
    if len(xs) == 0:
        return np.zeros_like(full_hole)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    h, w = full_hole.shape
    frame = np.zeros((h, w), dtype=bool)
    frame[
        max(0, y0 - GUTTER_EXPAND_Y) : min(h, y1 + GUTTER_EXPAND_Y + 1),
        max(0, x0 - GUTTER_EXPAND_X) : min(w, x1 + GUTTER_EXPAND_X + 1),
    ] = True
    gutter = frame & ~phone_rect
    gutter[:, :SIDEBAR_LEFT_MAX] = False
    gutter[:, SIDEBAR_RIGHT_MIN:] = False
    return gutter


def gutter_fill_colors(phone_rect: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    ys, xs = np.where(phone_rect)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    h, w = shape
    yy, xx = np.ogrid[:h, :w]
    dx = np.where(xx < x0, x0 - xx, np.where(xx > x1, xx - x1, 0)).astype(np.float32)
    dy = np.where(yy < y0, y0 - yy, np.where(yy > y1, yy - y1, 0)).astype(np.float32)
    dist = np.maximum(dx, dy)
    max_d = float(max(1.0, dist.max()))
    t = np.clip(dist / max_d, 0.0, 1.0)
    return GUTTER_FILL_INNER[None, None, :] * (1.0 - t[..., None]) + GUTTER_FILL_OUTER[None, None, :] * t[..., None]


def lightning_mask(arr: np.ndarray, region: np.ndarray) -> np.ndarray:
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    sat = np.maximum.reduce([r, g, b]) - np.minimum.reduce([r, g, b])
    lum = r + g + b
    return (
        region
        & (sat >= LIGHTNING_MIN_SAT)
        & (lum >= 120)
        & (b >= 70)
        & (b > g + 12)
    )


def paint_inner_gutter(rgba: np.ndarray, arr: np.ndarray, gutter: np.ndarray, fill: np.ndarray) -> None:
    """Recouvre tout l'encadrement puis ne garde que les gros éclairs violets."""
    rgba[gutter, :3] = fill[gutter].astype(np.uint8)
    rgba[gutter, 3] = 255
    bolts = lightning_mask(arr, gutter)
    rgba[bolts, :3] = arr[bolts]


def feather_hole_alpha(rgba: np.ndarray, phone_rect: np.ndarray, fill: np.ndarray) -> None:
    if HOLE_FEATHER <= 0:
        return
    h, w = phone_rect.shape
    dist = np.full((h, w), HOLE_FEATHER + 1.0, dtype=np.float32)
    q: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            if phone_rect[y, x]:
                dist[y, x] = 0.0
                q.append((y, x))
    while q:
        y, x = q.popleft()
        d0 = dist[y, x]
        if d0 >= HOLE_FEATHER:
            continue
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dist[ny, nx] > d0 + 1:
                dist[ny, nx] = d0 + 1.0
                q.append((ny, nx))
    ring = (~phone_rect) & (dist <= HOLE_FEATHER)
    if not ring.any():
        return
    ramp = np.clip(dist[ring] / HOLE_FEATHER, 0.0, 1.0)
    rgba[ring, :3] = (fill[ring] * ramp[:, None]).astype(np.uint8)
    rgba[ring, 3] = (ramp * 255.0).astype(np.uint8)


def rgba_with_video_hole(rgb: Image.Image, aspect: float = PHONE_ASPECT) -> Image.Image:
    arr = np.array(rgb.convert("RGB"))
    full_hole = video_hole_mask(arr)
    phone_rect = phone_hole_rect(full_hole, aspect)
    gutter = inner_gutter_mask(full_hole, phone_rect)
    fill = gutter_fill_colors(phone_rect, arr.shape[:2])
    rgba = np.dstack([arr, np.full(arr.shape[:2], 255, dtype=np.uint8)])
    paint_inner_gutter(rgba, arr, gutter, fill)
    rgba[phone_rect, :3] = 0
    rgba[phone_rect, 3] = 0
    feather_hole_alpha(rgba, phone_rect, fill)
    return Image.fromarray(rgba, mode="RGBA")


def make_site_qr(size: int) -> Image.Image:
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


def paste_frame_qr(base: Image.Image) -> tuple[Image.Image, int]:
    x0, y0, x1, y1 = QR_INNER
    inner_w, inner_h = x1 - x0, y1 - y0
    max_side = min(inner_w, inner_h) - QR_QUIET * 2
    qr_side = max(64, int(max_side * QR_SIZE_RATIO))
    qx0 = x0 + (inner_w - qr_side) // 2
    free_y = inner_h - qr_side - QR_QUIET * 2
    qy0 = y0 + QR_QUIET + int(free_y * 0.55)

    qr_hi = make_site_qr(320)
    qr_hi.save(SITE_QR_OUT, optimize=True)
    qr_img = qr_hi.resize((qr_side, qr_side), Image.Resampling.NEAREST)

    white = Image.new("RGBA", (inner_w, inner_h), (255, 255, 255, 255))
    base.paste(white, (x0, y0))
    base.paste(qr_img.convert("RGBA"), (qx0, qy0))
    return base, qr_side


def main() -> None:
    no_qr = "--no-qr" in sys.argv
    paths = [Path(a) for a in sys.argv[1:] if not a.startswith("-")]
    src = paths[0] if paths else (OVERLAY_IN if OVERLAY_IN.is_file() else None)
    if not src or not src.is_file():
        print("Usage: python tools/compose-stream-overlay-qr.py [--no-qr] [overlay-source.png]")
        print(f"Default source: {OVERLAY_IN}")
        sys.exit(1)

    base = rgba_with_video_hole(Image.open(src))
    qr_side = 0
    if not no_qr:
        base, qr_side = paste_frame_qr(base)

    base.save(OVERLAY_OUT, format="PNG", optimize=True)
    ys, xs = np.where(np.array(base)[:, :, 3] == 0)
    if len(xs):
        w = int(xs.max() - xs.min() + 1)
        h = int(ys.max() - ys.min() + 1)
        print(
            f"Wrote {OVERLAY_OUT.name} (RGBA, trou alpha=0: "
            f"x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, {w}×{h}px)"
        )
    else:
        print(f"Wrote {OVERLAY_OUT.name} (RGBA, no hole detected)")
    if qr_side:
        print(f"  + {SITE_QR_OUT.name} ({qr_side}px in frame)")


if __name__ == "__main__":
    main()
