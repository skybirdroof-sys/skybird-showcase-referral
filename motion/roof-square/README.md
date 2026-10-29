# Roofing square: holographic 10x10 on the drone shot

`out/roof-square-1080x1920.mp4`: the Back Right drone shot with a light-blue holographic
10 ft x 10 ft square locked onto the roof. Corner brackets lock on, the edges draw with
running foot counters, a scan lays in a 1-ft grid, the 100 cells light up, and a panel counts
to 100 SQ FT. `out/roof-square-overlay-alpha-1080x1920.mov` (ProRes 4444 with alpha, not
in git) is the same graphic alone, for layering in an editor over this same shot.

## How it works

1. `track_roof.py` follows the near roof plane through every frame (optical flow on the
   shingles, solved as a homography) and writes `track.json`.
2. `solve_plane.py` recovers the roof's true shape from how that plane moves (camera
   self-calibration) and sets the scale from the shingle courses, assuming the standard 5-5/8"
   exposure, so roof coordinates are in feet (`plane.json`). Check: ridge to eave is 16.7 ft
   and the gable edge meets the ridge at a right angle.
3. `render_square.py` draws the square top-down in roof feet, warps it into each frame, adds
   the on-screen panel, and writes composite and alpha frames.

```
ffmpeg -i Back_Right_Shot.mp4 -vsync 0 frames/f%04d.png
python3 track_roof.py frames
python3 solve_plane.py frames
python3 render_square.py frames render          # ONLY=60,120 renders just those frames
ffmpeg -framerate 30000/1001 -i render/composite/c%04d.png -c:v libx264 -pix_fmt yuv420p -crf 16 out/roof-square-1080x1920.mp4
```

Placement, colours and timing are constants near the top of `render_square.py`
(`GABLE_X`, `SQ_*`, `CYAN`, and the time spans in `draw_roof` / `draw_panel`).
