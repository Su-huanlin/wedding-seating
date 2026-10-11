"""Fit hall artwork to sheet size. Keep marble/stage; do not paint seating washes."""
from __future__ import annotations

import os
from PIL import Image, ImageFilter

SRC_CN = r"C:\Users\10129\.cursor\projects\d-Marrige-wedding-seating\assets\c__Users_10129_AppData_Roaming_Cursor_User_workspaceStorage_939542372d55bc7994c8d6e38ff37d6d_images_image-1d47c96f-6b8a-4489-83f3-fa8c1d91d915.png"
SRC_WS = r"C:\Users\10129\.cursor\projects\d-Marrige-wedding-seating\assets\c__Users_10129_AppData_Roaming_Cursor_User_workspaceStorage_939542372d55bc7994c8d6e38ff37d6d_images_image-367afe2d-ba64-4104-8506-9371f0121d12.png"
OUT = r"D:\Marrige\wedding-seating\public\halls"
TARGET_W, TARGET_H = 2580, 2800


def fit_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    im = im.convert("RGBA")
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale + 0.5), int(im.height * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    # Bias crop upward so stage stays in frame.
    top = max(0, (nh - th) // 6)
    return im.crop((left, top, left + tw, top + th))


def soften_bright_gold(im: Image.Image) -> Image.Image:
    """
    Only mute neon-bright chandelier spikes / gold flecks (pixel mask).
    Never draw bands, squares, or large discs — those create ghost blobs.
    """
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    sy, ey = int(h * 0.33), int(h * 0.82)
    sx, ex = int(w * 0.20), int(w * 0.80)
    aisle = int(w * 0.12)
    cx = w // 2
    hits = 0
    for y in range(sy, ey):
        for x in range(sx, ex):
            if abs(x - cx) < aisle:
                continue
            r, g, b = px[x, y]
            # Hot gold / lamp glow only (high R+G, low B). Leave marble & faint rings.
            if r >= 215 and g >= 185 and b <= 130 and (r + g) > 2.6 * b + 80:
                mp[x, y] = 255
                hits += 1
    if hits < 80:
        return im
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(4))
    # Rebuild those pixels from a mild local blur of the same image (texture preserved).
    soft = rgb.filter(ImageFilter.GaussianBlur(10)).convert("RGBA")
    base = im.convert("RGBA")
    # Keep most of original; only ~70% of the soft fill so it doesn't stamp a disc.
    soft_a = soft.copy()
    soft_a.putalpha(mask.point(lambda a: int(a * 0.7)))
    return Image.alpha_composite(base, soft_a)


def process(src: str, out_name: str) -> None:
    im = fit_cover(Image.open(src), TARGET_W, TARGET_H)
    if out_name == "western.png":
        # Western chandelier blooms are loud; Chinese rings are thin lines — leave them.
        im = soften_bright_gold(im)
    path = os.path.join(OUT, out_name)
    im.convert("RGB").save(path, "PNG", optimize=True)
    print(out_name, im.size, os.path.getsize(path))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    process(SRC_CN, "chinese.png")
    process(SRC_WS, "western.png")
    print("done")


if __name__ == "__main__":
    main()
