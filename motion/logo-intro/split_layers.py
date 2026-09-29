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
from scipy import ndimage
greenzone = ndimage.binary_dilation(green, iterations=3)   # green shapes plus their soft edges
hawk = ink & greenzone & (cols > 735) & (rows < 640)
parts.append(save("hawk", hawk, (740, 405, 1250, 640)))
# Script "Skybird": the near-black ink.
script = ink & ~greenzone
parts.append(save("script", script, (60, 440, 1150, 900)))
# ROOFING: one layer per letter, split on the column gaps.
letters = ink & greenzone & (rows > 800)
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

# Hawk rig: far wing (light green, behind), body, near wing (in front), so the wings can beat.
# These layers overlap while moving, so each is its solid brand colour with coverage as alpha
# (an un-mixed layer would be see-through). A pixel goes to whichever green explains it best.
LIGHT, DARK, WHITE = np.array([102, 188, 116.]), np.array([46, 134, 76.]), np.array([255, 255, 255.])
def coverage(C):
    d = WHITE - C
    a = np.clip(((WHITE - src) @ d) / (d @ d), 0, 1)
    resid = np.linalg.norm(WHITE - a[..., None] * d - src, axis=2)
    return a, resid
a_l, r_l = coverage(LIGHT)
a_d, r_d = coverage(DARK)
region = (cols > 735) & (rows < 640) & hawk
light = region & (r_l < r_d) & (a_l > 0.02)
dark = region & ~light & (a_d > 0.02)
far_wing = light & (rows < 545) & (cols < 975)
# Cut the dark shape along the shoulder, then keep the piece holding the wing tip.
cut = np.zeros_like(dark)
for k in np.linspace(0, 1, 400):
    x, y = int(985 + 90 * k), int(482 + 57 * k)
    cut[y - 1:y + 2, x - 1:x + 2] = True
lab, _ = ndimage.label(dark & ~cut)
near_wing = lab == lab[445, 1173]
near_wing |= ndimage.binary_dilation(near_wing, iterations=2) & dark & cut
body = (dark | light) & ~far_wing & ~near_wing
# Body keeps a copy of the wing root so no gap opens at the shoulder when the wing turns.
# That copy is the solid inside of the wing near the shoulder and along the whole cut line,
# kept off the wing's outer edge (painting that edge twice would darken it).
near_cut = ndimage.distance_transform_edt(~cut) < 14
root = ((np.hypot(cols - 1030, rows - 512) < 42) | near_cut) & ndimage.binary_erosion(near_wing | (cut & dark), iterations=2)
body_solid = ndimage.binary_fill_holes(ndimage.binary_closing(body | root, iterations=3))
# The white gap between far wing and body is part of the design: keep it as an opaque white rim,
# along with the eye, so the far wing tucks behind the head instead of filling that gap.
rim = ndimage.binary_dilation(body | root, iterations=5) & ~(body | root) & (ndimage.distance_transform_edt(~far_wing) < 10)
paint = body_solid | rim

def save_solid(name, layers, box):
    x0, y0, x1, y1 = box
    out = np.zeros(src.shape[:2] + (4,), float)
    for mask, a, C in layers:            # painted in order, "over" compositing
        a = np.where(mask, a, 0)[..., None]
        out[..., :3] = out[..., :3] * (1 - a) + C * a
        out[..., 3:] = out[..., 3:] * (1 - a) + a
    rgbout = np.where(out[..., 3:] > 0, out[..., :3] / np.maximum(out[..., 3:], 1e-6), 0)
    img = np.dstack([rgbout, out[..., 3] * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img[y0:y1, x0:x1]).save(HERE / "layers" / f"{name}.png")
    return {"name": name, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}

ones = np.ones(alpha.shape)
rig = [save_solid("hawk_farwing", [(far_wing, a_l, LIGHT)], (740, 405, 1000, 545)),
       save_solid("hawk_body", [(paint, ones, WHITE), (body & light, a_l, LIGHT), (dark & body, a_d, DARK), (root, ones, DARK)], (740, 405, 1250, 640)),
       save_solid("hawk_nearwing", [(near_wing, a_d, DARK)], (980, 405, 1250, 565))]
print("hawk rig px:", [(r["name"], int(m.sum())) for r, m in zip(rig, [far_wing, body, near_wing])])

# Check: the rig at rest over white rebuilds the hawk.
chk = np.full_like(src, 255.0)
for r in rig:
    L = np.array(Image.open(HERE / "layers" / f"{r['name']}.png")).astype(float)
    a = L[..., 3:] / 255
    reg = chk[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"]]
    reg[:] = reg * (1 - a) + L[..., :3] * a
print("hawk rig max diff:", np.abs(chk - src)[region].max(), "mean:", np.abs(chk - src)[region].mean().round(3))

(HERE / "layers" / "layers.json").write_text(json.dumps({"canvas": [1310, 1309], "parts": parts, "rig": rig}, indent=1))

# Sanity check: all layers composited back over white must match the original.
out = np.full_like(src, 255.0)
for p in parts:
    L = np.array(Image.open(HERE / "layers" / f"{p['name']}.png")).astype(float)
    a = L[..., 3:] / 255
    region = out[p["y"]:p["y"] + p["h"], p["x"]:p["x"] + p["w"]]
    region[:] = region * (1 - a) + L[..., :3] * a
print("parts:", [p["name"] for p in parts])
print("max diff vs original:", np.abs(out - src).max(), "| ink px in no layer:", int((ink & ~hawk & ~script & ~letters).sum()))
