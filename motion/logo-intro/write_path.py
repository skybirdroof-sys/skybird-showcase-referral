"""Work out when a pen would reach each pixel of "Skybird", so the script can be written on.

1. Thin the script to its centreline and break that into segments between junctions.
2. Follow the segments in handwriting order (STROKES below), with the pen easing in and
   out of each stroke and lifting briefly between strokes.
3. Give every ink pixel the time the pen passes its nearest centreline point.

Writes layers/script-time.png: 0 = no ink, 1..255 = when that pixel appears (0..1 of the
writing time). Coordinates are in the script layer (layers/script.png).
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize

HERE = Path(__file__).parent
layer = np.array(Image.open(HERE / "layers" / "script.png"))
ink = layer[..., 3] > 128
shape = ndimage.binary_closing(ink, iterations=2)
skel = skeletonize(shape)

# ---- centreline graph: chains of pixels between endpoints / junctions ----
H, W = skel.shape
def nbrs(y, x):
    return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
            if (dy or dx) and 0 <= y + dy < H and 0 <= x + dx < W and skel[y + dy, x + dx]]
pts = list(zip(*np.nonzero(skel)))
nodes = {p for p in pts if len(nbrs(*p)) != 2}
seen, edges = set(), []
for n in sorted(nodes):
    for q in nbrs(*n):
        if (n, q) in seen:
            continue
        path, prev, cur = [n, q], n, q
        while cur not in nodes:
            nxt = [r for r in nbrs(*cur) if r != prev and r not in path[-3:]]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            path.append(cur)
        seen.update({(n, q), (path[-1], path[-2])})
        if len(path) > 4:
            edges.append(np.array(path, float))

def edge_near(x, y):
    """The segment passing closest to (x, y)."""
    return min(range(len(edges)), key=lambda i: np.hypot(edges[i][:, 1] - x, edges[i][:, 0] - y).min())

# ---- handwriting order: (pen-down point, [a point on each segment in order]) ----
STROKES = [
    ((226, 128), [(184, 216)]),                                   # S, from its top terminal
    ((327, 130), [(291, 196), (252, 312)]),                       # k stem, top to bottom
    ((272, 268), [(285, 269)]),                                   # k: out from the stem
    ((364, 216), [(337, 250), (331, 344), (418, 258)]),           # k arm, leg, into y's first stroke
    ((409, 309), [(439, 328), (499, 262)]),                       # y: round the bottom, up to the top
    ((476, 318), [(474, 337), (467, 361), (373, 433), (467, 361), (517, 337)]),  # y descender loop, on to b
    ((559, 307), [(567, 272), (598, 180)]),                       # b: up the stem
    ((583, 237), [(637, 223), (612, 340)]),                       # b bowl
    ((659, 275), [(687, 277), (731, 243)]),                       # join to i, up the i
    ((715, 277), [(758, 331), (820, 213)]),                       # i down and round, up into r
    ((819, 226), [(844, 229), (880, 228)]),                       # r shoulder
    ((869, 234), [(844, 322)]),                                   # r down, join to d
    ((1021, 239), [(947, 237), (955, 343), (1012, 282), (1038, 205)]),  # d bowl, up the ascender
    ((1061, 175), [(1038, 205), (1012, 282), (1031, 342), (1073, 310), (1066, 304)]),  # d stem down, exit
    ((753, 172), [(753, 172)]),                                   # dot the i last
]

SPEED = 1.0          # centreline px per time unit (normalised later)
RETRACE = 2.5        # retracing ink already down goes faster
LIFT = 40.0          # pause for each pen lift, in px-equivalents, plus the travel distance / 4

def oriented(e, start):
    d0 = np.hypot(*(e[0] - start)); d1 = np.hypot(*(e[-1] - start))
    return e if d0 <= d1 else e[::-1]

t_skel = np.full(skel.shape, np.inf)
t = 0.0
pen = None
for start, anchors in STROKES:
    start = np.array([start[1], start[0]], float)       # (y, x)
    if pen is not None:
        t += LIFT + np.hypot(*(pen - start)) / 4
    chain, cur = [], start
    for i, (ax, ay) in enumerate(anchors):
        e = edges[edge_near(ax, ay)]
        if np.allclose(e[0], e[-1]):                    # a closed loop: go the way that heads down first
            e = e if e[min(10, len(e) - 1), 0] >= e[len(e) - 1 - min(10, len(e) - 1), 0] else e[::-1]
        else:
            e = oriented(e, cur)
        chain.append(e)
        cur = e[-1]
    path = np.concatenate(chain)
    # Arc length, slowed where the pen retraces ink it already laid.
    steps = np.hypot(*np.diff(path, axis=0).T)
    fresh = np.array([np.isinf(t_skel[int(y), int(x)]) for y, x in path[1:]])
    cost = np.concatenate([[0], np.cumsum(steps * np.where(fresh, 1, 1 / RETRACE))]) / SPEED
    dur = max(cost[-1], 12)
    # Ease in/out: the pen reaches arc position s at time t + dur * inv_ease(s/dur).
    s = cost / dur
    k = np.where(s < 0.5, np.cbrt(s / 4), 1 - np.cbrt((1 - s) / 4))   # inverse of inOutCubic
    for (y, x), tk in zip(path, t + dur * k):
        y, x = int(y), int(x)
        t_skel[y, x] = min(t_skel[y, x], tk)
    t += dur
    pen = path[-1]
total = t

# Every ink pixel takes the time of its nearest timed centreline point.
timed = np.isfinite(t_skel)
_, (iy, ix) = ndimage.distance_transform_edt(~timed, return_indices=True)
t_px = t_skel[iy, ix] / total
out = np.where(layer[..., 3] > 0, 1 + np.round(t_px * 254), 0).astype(np.uint8)
Image.fromarray(out).save(HERE / "layers" / "script-time.png")
print(f"{len(edges)} segments, {len(STROKES)} strokes, total {total:.0f} units; "
      f"untimed ink px: {int((layer[..., 3] > 0).sum() - (out > 0).sum())}")
