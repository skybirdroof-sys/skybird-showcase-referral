# Skybird logo intro / outro

Short social clips built from the Core Logo, entirely in code.

- `out/skybird-intro-*.mp4` — hawk flies in beating its wings and flares to land, "Skybird" is
  hand-written stroke by stroke (the i dotted last), ROOFING rises (3.8 s)
- `out/skybird-outro-*.mp4` — logo rests, hawk crouches and takes off up and left, text fades away (3.0 s)
- `out/skybird-cta-dark-*.mp4` — dark theme: the intro plays, the logo lifts, and an end card builds
  in: roofline, FREE ROOF INSPECTION, (984) 833-1223, skybirdroofing.net, GAF Master Elite (7.0 s)
- `out/transparent/skybird-signoff-{brand,reverse}-1080x1920.{mov,webm}` — the intro with a transparent
  background, for signing off other videos. `brand` = black script (light footage), `reverse` = white
  script (dark footage). `.mov` is ProRes 4444 with alpha (Premiere, Final Cut, DaVinci, CapCut
  desktop); `.webm` is VP9 with alpha (web, smaller). `preview-not-transparent.mp4` shows both over footage.
- 1080x1920 for Reels / TikTok / Stories, 1080x1080 for feed posts

## How it works

1. `split_layers.py` cuts `core-logo.png` into transparent layers in `layers/`: the script,
   one per ROOFING letter, the whole hawk, dark-theme recolours in `layers/dark/`, and a hawk rig (far wing, body, near wing) so the
   wings can beat from the shoulders. It checks the layers rebuild the original.
2. `write_path.py` thins the script to its centreline, follows it in handwriting order, and
   saves when the pen reaches each pixel (`layers/script-time.png`).
3. `logo.html` animates the layers. All motion lives in `render(t)`. To watch it live, serve
   `motion/` (`python3 -m http.server`) and open `logo-intro/logo.html?mode=intro|outro|cta`,
   adding `&theme=dark` for the dark version.
4. `render.mjs` opens the page in headless Chromium, steps `render(t)` frame by frame (with
   sub-frames averaged for motion blur), and pipes the frames to ffmpeg.

```
python3 split_layers.py
python3 write_path.py
node render.mjs intro 1080x1920 30 6
node render.mjs outro 1080x1080 30 6
THEME=dark node render.mjs cta 1080x1920 30 6
# transparent: render over black and over white, then recover alpha
THEME=clear VARIANT=brand MATTE=black FRAMES_OUT=/tmp/b node render.mjs intro 1080x1920 30 6
THEME=clear VARIANT=brand MATTE=white FRAMES_OUT=/tmp/w node render.mjs intro 1080x1920 30 6
python3 make_alpha.py /tmp/b /tmp/w /tmp/rgba
ffmpeg -framerate 30 -i /tmp/rgba/%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out/transparent/skybird-signoff-brand-1080x1920.mov
```

The end card's text lives in `logo.html` (`#cta`); edit it there and re-render. Fonts are in
`../fonts` (Montserrat, SIL Open Font License).

Needs Python 3 with Pillow + numpy, Node with Playwright, and ffmpeg (set `FFMPEG=` to its path if it isn't on PATH).
