"""Turn a black-matte and a white-matte render of the same animation into RGBA frames.

Over black a pixel is C*a; over white it is C*a + (1 - a). So a = 1 - (white - black) and
C = black / a. That recovers exact transparency, soft edges and motion blur included, and
lets cut-outs (like the hawk's eye) be truly see-through.

Usage: python3 make_alpha.py BLACK_DIR WHITE_DIR OUT_DIR
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

black_dir, white_dir, out_dir = map(Path, sys.argv[1:4])
out_dir.mkdir(parents=True, exist_ok=True)
worst = 0.0
for fb in sorted(black_dir.glob("*.png")):
    b = np.asarray(Image.open(fb).convert("RGB"), np.float32) / 255
    w = np.asarray(Image.open(white_dir / fb.name).convert("RGB"), np.float32) / 255
    a = np.clip(1 - (w - b).mean(axis=2), 0, 1)
    worst = max(worst, float(np.abs(np.ptp(w - b, axis=2)).max()))   # channels should agree
    rgb = np.where(a[..., None] > 1 / 255, np.clip(b / np.maximum(a[..., None], 1e-6), 0, 1), 0)
    Image.fromarray((np.dstack([rgb, a]) * 255 + 0.5).astype(np.uint8), "RGBA").save(out_dir / fb.name)
print(f"{len(list(out_dir.glob('*.png')))} RGBA frames; largest channel disagreement {worst:.3f}")
