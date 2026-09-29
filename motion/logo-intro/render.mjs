// Record logo.html to MP4, one exact frame at a time (no screen-capture timing drift).
// Usage: node render.mjs [intro|outro] [WIDTHxHEIGHT] [fps]
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const globalRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(path.join(globalRoot, "playwright"));

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = "intro", size = "1080x1920", fpsArg = "30"] = process.argv.slice(2);
const [w, h] = size.split("x").map(Number);
const fps = Number(fpsArg);
const ffmpeg = process.env.FFMPEG || "ffmpeg";
mkdirSync(path.join(here, "out"), { recursive: true });
const out = path.join(here, "out", `skybird-${mode}-${w}x${h}.mp4`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto(pathToFileURL(path.join(here, "logo.html")).href + `?mode=${mode}&record=1`);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * fps);

const enc = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", out],
  { stdio: ["pipe", "inherit", "inherit"] });
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.render(t), i / fps);
  const png = await page.screenshot({ type: "png" });
  if (!enc.stdin.write(png)) await new Promise(r => enc.stdin.once("drain", r));
}
enc.stdin.end();
await new Promise(r => enc.on("close", r));
await browser.close();
console.log(`${out}  (${frames} frames @ ${fps}fps)`);
