# Skybird logo intro / outro

Short social clips built from the Core Logo, entirely in code.

- `out/skybird-intro-*.mp4` — hawk swoops in, "Skybird" writes on, ROOFING rises (3.6 s)
- `out/skybird-outro-*.mp4` — logo rests, hawk takes off, text clears to white (3.2 s)
- 1080x1920 for Reels / TikTok / Stories, 1080x1080 for feed posts

## How it works

1. `split_layers.py` cuts `core-logo.png` into transparent layers in `layers/`
   (hawk, script, one per ROOFING letter) and checks they rebuild the original exactly.
2. `logo.html` animates those layers. All motion lives in `render(t)`; open the
   file in a browser (`?mode=intro` or `?mode=outro`) to watch it live.
3. `render.mjs` opens the page in headless Chromium, steps `render(t)` one frame
   at a time, and pipes the frames to ffmpeg.

```
python3 split_layers.py
node render.mjs intro 1080x1920 30
node render.mjs outro 1080x1080 30
```

Needs Python 3 with Pillow + numpy, Node with Playwright, and ffmpeg (set `FFMPEG=` to its path if it isn't on PATH).
