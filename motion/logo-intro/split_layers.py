"""Cut the Core Logo PNG (on white) into transparent layers for animation.

Each pixel is un-mixed from white, so a layer composited back onto white is
pixel-identical to the original. Coordinates are in the 1310x1309 source.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
src = np.array(Image.open(HERE / "core-logo.png").convert("RGB")).astype(float)

# Un-mix from white: alpha = how far the pixel is from white, colour = what it was over white.
alpha = (255 - src).max(axis=2) / 255
safe = np.where(alpha > 0, alpha, 1)[..., None]
rgb = np.clip((src - 255 * (1 - alpha[..., None])) / safe, 0, 255)
rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)

green = (src[..., 1] - src[..., 0]) > 25
ink = alpha > 0.02

def save(name, mask, box):
    x0, y0, x1, y1 = box
    layer = rgba.copy()
    layer[..., 3] = np.where(mask, layer[..., 3], 0)
    Image.fromarray(layer[y0:y1, x0:x1]).save(HERE / "layers" / f"{name}.png")
    return {"name": name, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}

rows, cols = np.indices(alpha.shape)
parts = []
# Hawk: everything inked up in the top-right (the script has no pixels there).
hawk = ink & (cols > 735) & (rows < 640) & ~((src.max(axis=2) < 90))
parts.append(save("hawk", hawk, (740, 405, 1250, 640)))
# Script "Skybird": the near-black ink.
script = ink & ~green & ~hawk
parts.append(save("script", script, (60, 440, 1150, 900)))
# ROOFING: one layer per letter, split on the column gaps.
letters = ink & green & (rows > 800)
colhit = letters.any(axis=0)
runs, start = [], None
for x, on in enumerate(colhit):
    if on and start is None:
        start = x
    if not on and start is not None:
        runs.append((start, x)); start = None
for i, (a, b) in enumerate(runs):
    m = letters & (cols >= a) & (cols < b)
    parts.append(save(f"roofing_{i}", m, (a - 4, 820, b + 4, 900)))

(HERE / "layers" / "layers.json").write_text(json.dumps({"canvas": [1310, 1309], "parts": parts}, indent=1))

# Sanity check: all layers composited back over white must match the original.
out = np.full_like(src, 255.0)
for p in parts:
    L = np.array(Image.open(HERE / "layers" / f"{p['name']}.png")).astype(float)
    a = L[..., 3:] / 255
    region = out[p["y"]:p["y"] + p["h"], p["x"]:p["x"] + p["w"]]
    region[:] = region * (1 - a) + L[..., :3] * a
print("parts:", [p["name"] for p in parts])
print("max diff vs original:", np.abs(out - src).max())
