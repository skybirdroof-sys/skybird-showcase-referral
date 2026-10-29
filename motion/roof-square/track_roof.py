"""Track the near roof plane through the drone shot.

Writes track.json: for every frame, the 3x3 homography H_t mapping frame-0 pixel
coordinates on the roof plane to frame-t pixel coordinates. Anything drawn on the roof
in frame-0 coordinates can then be warped into each frame and stays stuck to the shingles.

Usage: python3 track_roof.py FRAMES_DIR
"""
import json, sys
from pathlib import Path
import cv2
import numpy as np

frames = sorted(Path(sys.argv[1]).glob("f*.png"))
# Near roof plane in frame 0: ridge across the top, eave across the bottom.
ROOF0 = np.float32([[0, 215], [608, 248], [608, 990], [0, 815]])

def roof_mask(shape, H, inset=14):
    poly = cv2.perspectiveTransform(ROOF0[None], H)[0]
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [poly.astype(np.int32)], 255)
    return cv2.erode(m, np.ones((inset * 2 + 1,) * 2, np.uint8))   # keep clear of ridge/eave/rake edges

prev = cv2.cvtColor(cv2.imread(str(frames[0])), cv2.COLOR_BGR2GRAY)
H = np.eye(3)
Hs, inliers = [H.tolist()], []
lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
for f in frames[1:]:
    cur = cv2.cvtColor(cv2.imread(str(f)), cv2.COLOR_BGR2GRAY)
    p0 = cv2.goodFeaturesToTrack(prev, 1500, 0.01, 6, mask=roof_mask(prev.shape, H))
    p1, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, p0, None, **lk)
    back, st2, _ = cv2.calcOpticalFlowPyrLK(cur, prev, p1, None, **lk)       # forward-backward check
    good = (st[:, 0] == 1) & (st2[:, 0] == 1) & (np.linalg.norm(back - p0, axis=2)[:, 0] < 0.5)
    step, inl = cv2.findHomography(p0[good], p1[good], cv2.RANSAC, 1.0)
    H = step @ H
    H /= H[2, 2]
    Hs.append(H.tolist())
    inliers.append(int(inl.sum()))
    prev = cur

Path("track.json").write_text(json.dumps({"size": [608, 1080], "frames": len(Hs), "H": Hs}))
print(f"{len(Hs)} frames, inliers per step: min {min(inliers)}, median {int(np.median(inliers))}")
