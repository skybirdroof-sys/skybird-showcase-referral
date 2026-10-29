"""Render the holographic 10x10 roofing square onto the drone shot.

Everything on the roof is drawn top-down in roof feet (plane.json), then warped into each
frame with the tracked homography (track.json), so it sits on the shingles in perspective.
The read-out panel is drawn flat on screen and tied to the square by a leader line.

Usage: python3 render_square.py FRAMES_DIR OUT_DIR
Writes OUT_DIR/composite/ and OUT_DIR/overlay/ (RGBA) PNG frames at 1080x1920.
Set ONLY=60,120 to render just those frame numbers (for checking a look quickly).
"""
import json, os, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
FONTS = HERE.parent / "fonts"
frames_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
frames = sorted(frames_dir.glob("f*.png"))
track = json.loads((HERE / "track.json").read_text())
plane = json.loads((HERE / "plane.json").read_text())
Hs = [np.array(h) for h in track["H"]]
P = np.array(plane["plane_from_frame0"])            # frame-0 pixels -> roof feet
SRC_W, SRC_H = track["size"]
OUT_W, OUT_H = 1080, 1920
FPS = 29.97

# ---- the square, in roof feet: x along the ridge, y down-slope from the ridge ----
GABLE_X = 25.3                                       # where the rake (gable edge) is
SQ_X1 = GABLE_X - 0.9                                # keep just inside the rake
SQ_X0, SQ_Y0 = SQ_X1 - 10, 0.55                      # top edge just below the ridge cap
SQ_X1, SQ_Y1 = SQ_X0 + 10, SQ_Y0 + 10

# Plane canvas: D px per foot, covering the square plus room for dimension labels.
D = 100
CX0, CY0 = SQ_X0 - 2.4, SQ_Y0 - 1.0
CW, CH = int(14.0 * D), int(13.6 * D)
def cpt(x, y):                                       # roof feet -> canvas px
    return ((x - CX0) * D, (y - CY0) * D)
canvas_from_feet = np.array([[D, 0, -CX0 * D], [0, D, -CY0 * D], [0, 0, 1.0]])

CYAN = np.array([255, 232, 140]) / 255               # BGR of #8CE8FF, holographic light blue
WHITE = np.array([255, 250, 235]) / 255
font = lambda w, s: ImageFont.truetype(str(FONTS / f"Rajdhani-{w}.ttf"), s)

# ---- timing helpers ----
clamp = lambda v, a=0.0, b=1.0: min(b, max(a, v))
span = lambda t, t0, t1: clamp((t - t0) / (t1 - t0))
out_cubic = lambda k: 1 - (1 - k) ** 3
in_out = lambda k: 4 * k ** 3 if k < 0.5 else 1 - (-2 * k + 2) ** 3 / 2

class Layer:
    """A float BGR + alpha canvas we draw anti-aliased marks into, with opacity per mark."""
    def __init__(self, w, h):
        self.rgb = np.zeros((h, w, 3), np.float32)
        self.a = np.zeros((h, w), np.float32)
    def _mix(self, mask, color, opacity):
        m = mask.astype(np.float32) / 255 * opacity
        self.rgb = self.rgb * (1 - m[..., None]) + color * m[..., None]
        self.a = self.a * (1 - m) + m
    def lines(self, segs, width, color=CYAN, opacity=1.0):
        if opacity <= 0 or not segs:
            return
        mask = np.zeros(self.a.shape, np.uint8)
        for (x0, y0), (x1, y1) in segs:
            cv2.line(mask, (int(x0 * 16), int(y0 * 16)), (int(x1 * 16), int(y1 * 16)), 255, width, cv2.LINE_AA, 4)
        self._mix(mask, color, opacity)
    def poly(self, pts, color=CYAN, opacity=1.0):
        if opacity <= 0:
            return
        mask = np.zeros(self.a.shape, np.uint8)
        cv2.fillPoly(mask, [np.int32(np.round(np.float32(pts) * 16))], 255, cv2.LINE_AA, 4)
        self._mix(mask, color, opacity)
    def circle(self, c, r, width, color=CYAN, opacity=1.0, arc=(0, 360)):
        if opacity <= 0:
            return
        mask = np.zeros(self.a.shape, np.uint8)
        cv2.ellipse(mask, (int(c[0] * 16), int(c[1] * 16)), (int(r * 16), int(r * 16)), 0, arc[0], arc[1], 255, width, cv2.LINE_AA, 4)
        self._mix(mask, color, opacity)
    def text(self, xy, s, size, weight=600, color=CYAN, opacity=1.0, anchor="mm", spacing=0):
        if opacity <= 0 or not s:
            return
        img = Image.new("L", (self.a.shape[1], self.a.shape[0]), 0)
        d = ImageDraw.Draw(img)
        f = font(weight, size)
        if spacing:                                  # letter-spaced: draw glyph by glyph
            widths = [d.textlength(ch, font=f) + spacing for ch in s]
            total = sum(widths) - spacing
            x = xy[0] - (total / 2 if anchor[0] == "m" else total if anchor[0] == "r" else 0)
            for ch, w in zip(s, widths):
                d.text((x, xy[1]), ch, font=f, fill=255, anchor="l" + anchor[1])
                x += w
        else:
            d.text(xy, s, font=f, fill=255, anchor=anchor)
        self._mix(np.array(img), color, opacity)

def glow(layer, radius, strength):
    """Premultiplied colour of the layer plus a soft bloom around it."""
    pre = layer.rgb * layer.a[..., None]
    k = int(radius * 3) | 1
    bloom = cv2.GaussianBlur(pre, (k, k), radius)
    bloom_a = cv2.GaussianBlur(layer.a, (k, k), radius)
    return pre + bloom * strength, np.clip(layer.a + bloom_a * strength * 0.6, 0, 1)

# ---------------------------------------------------------------------------------------
def draw_roof(t):
    """Everything that lies on the roof, top-down, at time t (seconds)."""
    L = Layer(CW, CH)
    fill = Layer(CW, CH)
    corners = [cpt(SQ_X0, SQ_Y0), cpt(SQ_X1, SQ_Y0), cpt(SQ_X1, SQ_Y1), cpt(SQ_X0, SQ_Y1)]
    tl, tr, br, bl = corners
    cen = cpt((SQ_X0 + SQ_X1) / 2, (SQ_Y0 + SQ_Y1) / 2)
    pulse = 0.5 + 0.5 * np.sin(2 * np.pi * t / 1.6)

    # 1.0-1.6  corner brackets lock on: fly in from 2x, staggered.
    arm = 1.25 * D
    for i, (c, sx, sy) in enumerate([(tl, 1, 1), (tr, -1, 1), (br, -1, -1), (bl, 1, -1)]):
        k = out_cubic(span(t, 1.0 + i * 0.07, 1.45 + i * 0.07))
        if k <= 0:
            continue
        off = (1 - k) * 1.2 * D
        o = (c[0] - sx * off, c[1] - sy * off)
        L.lines([(o, (o[0] + sx * arm, o[1])), (o, (o[0], o[1] + sy * arm))], 9, WHITE, k)
        L.lines([(o, (o[0] + sx * arm, o[1])), (o, (o[0], o[1] + sy * arm))], 16, CYAN, k * 0.55)

    # 1.0-2.6  centre reticle: spins up, then gives way to the fill.
    kr = out_cubic(span(t, 1.0, 1.5)) * (1 - span(t, 2.3, 2.7))
    if kr > 0:
        rot = t * 140
        L.circle(cen, 0.9 * D, 5, CYAN, kr * 0.9, (rot, rot + 250))
        L.circle(cen, 0.55 * D, 4, WHITE, kr * 0.8, (-rot * 1.6, -rot * 1.6 + 120))
        L.lines([((cen[0] - 0.25 * D, cen[1]), (cen[0] + 0.25 * D, cen[1])),
                 ((cen[0], cen[1] - 0.25 * D), (cen[0], cen[1] + 0.25 * D))], 4, WHITE, kr)

    # 1.4-2.3  edges draw from the bottom-left corner: up the left side and along the bottom,
    # then across the top and down the right side. Feet tick past as they go.
    ke = in_out(span(t, 1.4, 2.3))
    if ke > 0:
        def partial(a, b, k):
            return (a, (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k))
        k1, k2 = clamp(ke * 2), clamp(ke * 2 - 1)
        segs = [partial(bl, tl, k1), partial(bl, br, k1)]
        if k2 > 0:
            segs += [partial(tl, tr, k2), partial(br, tr, k2)]
        L.lines(segs, 7, WHITE, 1.0)
        L.lines(segs, 14, CYAN, 0.6)
        # 1-ft ticks, pointing into the square, as each edge passes them.
        ticks = []
        for f in range(1, 10):
            g = f / 10
            if k1 >= g:
                ticks += [((bl[0], bl[1] - g * 10 * D), (bl[0] + 0.28 * D, bl[1] - g * 10 * D)),
                          ((bl[0] + g * 10 * D, bl[1]), (bl[0] + g * 10 * D, bl[1] - 0.28 * D))]
            if k2 >= g:
                ticks += [((tl[0] + g * 10 * D, tl[1]), (tl[0] + g * 10 * D, tl[1] + 0.28 * D)),
                          ((br[0], br[1] - g * 10 * D), (br[0] - 0.28 * D, br[1] - g * 10 * D))]
        L.lines(ticks, 4, CYAN, 0.9)

        # Dimension lines outside the left and bottom edges, with running counters.
        off = 0.75 * D
        dl = ((bl[0] - off, bl[1]), (bl[0] - off, bl[1] - k1 * 10 * D))
        db = ((bl[0], bl[1] + off), (bl[0] + k1 * 10 * D, bl[1] + off))
        L.lines([dl, db], 4, CYAN, 0.85)
        L.lines([((bl[0] - off - 0.2 * D, bl[1]), (bl[0] - off + 0.2 * D, bl[1])),
                 ((bl[0], bl[1] + off - 0.2 * D), (bl[0], bl[1] + off + 0.2 * D))], 4, CYAN, 0.85)
        if k1 >= 1:
            L.lines([((tl[0] - off - 0.2 * D, tl[1]), (tl[0] - off + 0.2 * D, tl[1])),
                     ((br[0], br[1] + off - 0.2 * D), (br[0], br[1] + off + 0.2 * D))], 4, CYAN, 0.85)
        feet = 10 * k1
        label = f"{feet:4.1f} FT" if k1 < 1 else "10 FT"
        # Bottom label rides the draw head, then settles mid-edge.
        bx = bl[0] + (k1 * 10 * D) / 2
        show = span(k1, 0.12, 0.25)                  # counters appear once there's some length
        L.text((bx, bl[1] + off + 0.62 * D), label, 88, 700, WHITE, show)
        # Left label: drawn rotated, so render into its own strip and paste.
        strip = Layer(int(4 * D), int(1.2 * D))
        strip.text((2 * D, 0.6 * D), label, 88, 700, WHITE, show)
        rot_rgb = cv2.rotate(strip.rgb, cv2.ROTATE_90_COUNTERCLOCKWISE)
        rot_a = cv2.rotate(strip.a, cv2.ROTATE_90_COUNTERCLOCKWISE)
        cy = bl[1] - (k1 * 10 * D) / 2
        x0, y0 = int(bl[0] - off - 0.62 * D - rot_a.shape[1] / 2), int(cy - rot_a.shape[0] / 2)
        sl = (slice(y0, y0 + rot_a.shape[0]), slice(x0, x0 + rot_a.shape[1]))
        m = rot_a[..., None]
        L.rgb[sl] = L.rgb[sl] * (1 - m) + rot_rgb * m
        L.a[sl] = L.a[sl] * (1 - rot_a) + rot_a

    # 2.3-3.1  scan bar sweeps down from the ridge, laying in the grid and the glass fill.
    ks = in_out(span(t, 2.3, 3.1))
    if ks > 0:
        yscan = tl[1] + ks * 10 * D
        grid = []
        for f in range(1, 10):
            x = tl[0] + f * D
            grid.append(((x, tl[1]), (x, min(yscan, bl[1]))))
            y = tl[1] + f * D
            if y <= yscan:
                grid.append(((tl[0], y), (tr[0], y)))
        L.lines(grid, 3, CYAN, 0.42 + 0.08 * pulse)
        fill.poly([tl, tr, (tr[0], yscan), (tl[0], yscan)], CYAN, 0.30 + 0.05 * pulse)
        if ks < 1:
            L.lines([((tl[0] - 0.3 * D, yscan), (tr[0] + 0.3 * D, yscan))], 8, WHITE, 1.0)
            fill.poly([(tl[0], yscan - 0.9 * D), (tr[0], yscan - 0.9 * D), (tr[0], yscan), (tl[0], yscan)], CYAN, 0.18)

    # 2.7-3.9  the 100 one-foot cells light up in turn (the panel counts them).
    kc = span(t, 2.7, 3.9)
    if kc > 0:
        lit = kc * 100
        for n in range(min(100, int(lit) + 1)):
            age = lit - n                            # cells flash, then settle
            flash = max(0.0, 1 - age / 6)
            if flash <= 0:
                continue
            r, c = divmod(n, 10)
            x, y = tl[0] + c * D, tl[1] + r * D
            fill.poly([(x + 3, y + 3), (x + D - 3, y + 3), (x + D - 3, y + D - 3), (x + 3, y + D - 3)], WHITE, 0.55 * flash)

    # Hold: a slow scan line loops down the square.
    if t > 3.9:
        ph = ((t - 3.9) / 2.2) % 1
        y = tl[1] + ph * 10 * D
        L.lines([((tl[0], y), (tr[0], y))], 5, WHITE, 0.5 * np.sin(np.pi * ph))

    rgb, a = glow(L, 9, 0.9)
    frgb, fa = fill.rgb * fill.a[..., None], fill.a
    return rgb + frgb * (1 - a[..., None]), np.clip(a + fa * (1 - a), 0, 1), corners

def draw_panel(t, anchor):
    """Screen-space read-out, tied to the square's corner by a leader line."""
    S = Layer(OUT_W, OUT_H)
    k = out_cubic(span(t, 2.45, 2.95))
    if k <= 0:
        return S
    px, py, pw, ph = 470, 1280, 560, 300           # panel box on the 1080x1920 frame
    float_y = 6 * np.sin(2 * np.pi * t / 3.0)
    py += float_y
    # Leader: from the square's corner, a dot, an elbow, into the panel.
    ax, ay = anchor
    elbow = (px - 40, py + 40)
    kl = out_cubic(span(t, 2.45, 2.75))
    S.circle((ax, ay), 9, -1, WHITE, kl)
    S.circle((ax, ay), 18, 3, CYAN, kl * 0.8)
    seg1 = ((ax, ay), (ax + (elbow[0] - ax) * kl, ay + (elbow[1] - ay) * kl))
    S.lines([seg1], 4, CYAN, 0.9 * kl)
    if kl >= 1:
        S.lines([(elbow, (px, py + 40))], 4, CYAN, 0.9)
    # Glass panel with bracketed corners, opening from its left edge.
    w = pw * k
    S.poly([(px, py), (px + w, py), (px + w, py + ph), (px, py + ph)], (0.13, 0.09, 0.03), 0.55 * k)
    S.lines([((px, py), (px + w, py)), ((px, py + ph), (px + w, py + ph))], 3, CYAN, 0.6 * k)
    c = 26
    S.lines([((px, py + c), (px, py)), ((px, py + ph - c), (px, py + ph)),
             ((px + w, py + c), (px + w, py)), ((px + w, py + ph - c), (px + w, py + ph))], 6, CYAN, k)
    kt = span(t, 2.75, 3.1)
    head = "1 ROOFING SQUARE"
    S.text((px + 34, py + 52), head[: int(len(head) * kt + 0.999)], 44, 700, CYAN, 1.0, "lm", 6)
    S.lines([((px + 34, py + 84), (px + 34 + 160 * kt, py + 84))], 3, CYAN, 0.8)
    count = int(round(100 * span(t, 2.7, 3.9)))
    if t >= 2.7:
        S.text((px + 30, py + 170), f"{count}", 128, 700, WHITE, 1.0, "lm")
        S.text((px + 30 + font(700, 128).getlength(f"{count}") + 16, py + 192), "SQ FT", 50, 600, CYAN, 1.0, "lm", 4)
    k3 = span(t, 3.9, 4.3)
    S.text((px + 34, py + 258), "10 FT  ×  10 FT", 46, 600, WHITE, out_cubic(k3) * 0.95, "lm", 3)
    return S

# ---------------------------------------------------------------------------------------
(out_dir / "composite").mkdir(parents=True, exist_ok=True)
(out_dir / "overlay").mkdir(parents=True, exist_ok=True)
scale = np.diag([OUT_W / SRC_W, OUT_H / SRC_H, 1.0])
only = {int(n) for n in os.environ["ONLY"].split(",")} if os.environ.get("ONLY") else None
for i, f in enumerate(frames):
    if only is not None and i not in only:
        continue
    t = i / FPS
    bg = cv2.resize(cv2.imread(str(f)), (OUT_W, OUT_H), interpolation=cv2.INTER_LANCZOS4).astype(np.float32) / 255
    rgb, a, corners = draw_roof(t)
    M = scale @ Hs[i] @ np.linalg.inv(P) @ np.linalg.inv(canvas_from_feet)
    wr = cv2.warpPerspective(rgb, M, (OUT_W, OUT_H), flags=cv2.INTER_LINEAR)
    wa = cv2.warpPerspective(a, M, (OUT_W, OUT_H), flags=cv2.INTER_LINEAR)
    br = cv2.perspectiveTransform(np.float32([[corners[2]]]), M)[0, 0]
    panel = draw_panel(t, (br[0], br[1]))
    prgb, pa = glow(panel, 6, 0.6)
    # Hologram blend: light adds, and the glass slightly dims what's behind it.
    over = wr * (1 - pa[..., None]) + prgb
    over_a = np.clip(wa * (1 - pa) + pa, 0, 1)
    # Roof marks dim the shingles a little; the panel's dark glass dims what's behind it more,
    # so its text reads even over white siding.
    dim = 0.35 * wa * (1 - pa) + 0.8 * pa
    comp = bg * (1 - dim[..., None]) + over
    cv2.imwrite(str(out_dir / "composite" / f"c{i:04d}.png"), np.clip(comp * 255, 0, 255).astype(np.uint8))
    # Overlay with alpha for an editor: colour un-premultiplied.
    oa = np.clip(over_a, 0, 1)
    orgb = np.where(oa[..., None] > 1e-3, np.clip(over / np.maximum(oa[..., None], 1e-3), 0, 1), 0)
    cv2.imwrite(str(out_dir / "overlay" / f"o{i:04d}.png"), np.dstack([orgb, oa]).__mul__(255).astype(np.uint8))
print(f"rendered {len(frames)} frames to {out_dir}")
