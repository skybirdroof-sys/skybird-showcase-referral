"""Recover true (metric) roof-plane coordinates from the tracked homographies.

A plane seen from a moving camera: if x0 is where the plane's circular points land in
frame 0, then H_t x0 must lie on the image of the absolute conic in every frame t,
w = K^-T K^-1, with K = [[f,0,cx],[0,f,cy],[0,0,1]]. Solving for x0 and f over all frames
gives a rectifying map from frame 0 to a top-down view of the roof (up to scale).
Then it turns the plane so the ridge runs along +x and down-slope is +y, and sets the scale
from the shingle courses (5-5/8" exposure, standard for architectural shingles), so plane
units are feet. Writes plane.json: frame-0 pixels -> roof feet, plus the focal length.

Usage: python3 solve_plane.py FRAMES_DIR
"""
import json, sys
from pathlib import Path
import cv2
import numpy as np
from scipy.optimize import least_squares

d = json.load(open("track.json"))
Hs = [np.array(h) for h in d["H"]]
W, H_ = d["size"]
cx, cy = W / 2, H_ / 2

def residuals(p):
    a, b, c, e, f = p
    x0 = np.array([a + 1j * b, c + 1j * e, 1.0])
    Kinv = np.linalg.inv(np.array([[f, 0, cx], [0, f, cy], [0, 0, 1.0]]))
    out = []
    for Ht in Hs[::2]:
        y = Kinv @ (Ht @ x0)
        y = y / np.linalg.norm(y)
        v = y @ y                       # complex; zero when y is a circular point
        out += [v.real, v.imag]
    return np.array(out)

best = None
for f0 in (400, 600, 900, 1300, 2000):
    for b0 in (300, 1000, 3000):
        r = least_squares(residuals, [cx, b0, cy, 0.0, f0], x_scale=[300, 300, 300, 300, 300])
        if best is None or r.cost < best.cost:
            best = r
a, b, c, e, f = best.x
print(f"focal {f:.0f}px (horizontal FOV {np.degrees(2 * np.arctan(W / 2 / f)):.0f} deg), cost {best.cost:.2e}")

# Rectifying homography for frame 0 from the circular-point image I = (a+ib, c+ie, 1).
I = np.array([a + 1j * b, c + 1j * e, 1.0])
C = np.real(np.outer(I, I.conj()) + np.outer(I.conj(), I))     # dual conic C*_inf (rank 2)
U, S, Vt = np.linalg.svd(C)
Hr = np.diag([1 / np.sqrt(S[0]), 1 / np.sqrt(S[1]), 1]) @ U.T   # maps C to diag(1,1,0) => metric
if np.linalg.det(Hr) < 0:
    Hr = np.diag([1, -1, 1]) @ Hr
Hr /= Hr[2, 2]

# Axes: ridge along +x (frame-0 ridge points), down-slope +y.
tp = lambda M, pts: cv2.perspectiveTransform(np.float32(pts)[None], M)[0]
r0, r1 = tp(Hr, [[0, 215], [608, 248]])
ang = np.arctan2(*(r1 - r0)[::-1])
rot = np.array([[np.cos(ang), np.sin(ang), 0], [-np.sin(ang), np.cos(ang), 0], [0, 0, 1]])
N = rot @ np.array([[1, 0, -r0[0]], [0, 1, -r0[1]], [0, 0, 1]])
if tp(N @ Hr, [[300, 900]])[0, 1] < 0:          # eave must be down-slope
    N = np.diag([1, -1, 1]) @ N
P = N @ Hr

# Scale: shingle course spacing, measured in several frames on the top-down view.
EXPOSURE_FT = 5.625 / 12
frames = sorted(Path(sys.argv[1]).glob("f*.png"))
periods = []
for i in range(0, len(Hs), 30):
    im = cv2.cvtColor(cv2.imread(str(frames[i])), cv2.COLOR_BGR2GRAY)
    span = np.linalg.norm(r1 - r0)
    M = np.diag([2400 / span, 2400 / span, 1]) @ P @ np.linalg.inv(Hs[i])   # ~4 px per ridge px
    top = cv2.warpPerspective(im, M, (3600, 2400)).astype(float)
    valid = cv2.warpPerspective(np.full_like(im, 255), M, (3600, 2400)) == 255
    rows = slice(240, 2160)
    cols = [x for x in range(0, 3600, 8) if valid[rows, x].all()]
    prof = np.diff(top[rows][:, cols].mean(axis=1))
    prof -= prof.mean()
    n = len(prof) * 32
    spec = np.abs(np.fft.rfft(prof * np.hanning(len(prof)), n))
    freq = np.fft.rfftfreq(n)
    band = (freq > 1 / 160) & (freq < 1 / 32)
    periods.append(1 / freq[np.argmax(spec * band)] * span / 2400)   # back to P units
course = float(np.median(periods))
P = np.diag([EXPOSURE_FT / course, EXPOSURE_FT / course, 1]) @ P
P /= P[2, 2]
eave = tp(P, [[0, 815], [608, 990]])
print(f"course spacing {course:.3f} units (spread {np.ptp(periods) / course:.1%}); ridge-to-eave {eave[:, 1].mean():.1f} ft")
json.dump({"focal": f, "plane_from_frame0": P.tolist(), "units": "feet"}, open("plane.json", "w"))
