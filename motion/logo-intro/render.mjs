// Record logo.html to MP4, one exact frame at a time (no screen-capture timing drift).
// Usage: [THEME=dark] node render.mjs [intro|outro|cta] [WIDTHxHEIGHT] [fps] [blur subframes]
// Each output frame averages `blur` sub-frames spread across it, for natural motion blur.
import { createRequire } from "node:module";
import { execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFile } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const globalRoot = execSync("npm root -g").toString().trim();
const { chromium } = require(path.join(globalRoot, "playwright"));

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = "intro", size = "1080x1920", fpsArg = "30", blurArg = "4"] = process.argv.slice(2);
const [w, h] = size.split("x").map(Number);
const fps = Number(fpsArg), blur = Number(blurArg);
const ffmpeg = process.env.FFMPEG || "ffmpeg";
mkdirSync(path.join(here, "out"), { recursive: true });
const theme = process.env.THEME || "light";
const out = path.join(here, "out", `skybird-${mode}${theme === "dark" ? "-dark" : ""}-${w}x${h}.mp4`);

const root = path.dirname(here);   // serve motion/ so the page can reach ../fonts
// The page reads its layers' pixels, which browsers only allow over http, so serve motion/.
const types = { ".html": "text/html", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  readFile(file, (err, data) => err ? res.writeHead(404).end()
    : res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(data));
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on("pageerror", e => { console.error(e); process.exit(1); });
await page.goto(`http://127.0.0.1:${server.address().port}/logo-intro/logo.html?mode=${mode}&theme=${theme}&record=1`);
await page.waitForFunction(() => window.ready === true);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * fps);

// Sub-frames go in at fps*blur; tmix averages each group and framestep keeps one per group.
const enc = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps * blur), "-i", "-",
  "-vf", `tmix=frames=${blur},framestep=${blur}`, "-r", String(fps),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", out],
  { stdio: ["pipe", "inherit", "inherit"] });
for (let i = 0; i < frames; i++) {
  for (let j = 0; j < blur; j++) {
    // Sub-frames cover the half-frame before each frame time (a 180-degree shutter).
    const t = Math.max(0, (i - 0.5 + (j + 1) / (2 * blur)) / fps);
    await page.evaluate(t => window.render(t), blur > 1 ? t : i / fps);
    const png = await page.screenshot({ type: "png" });
    if (!enc.stdin.write(png)) await new Promise(r => enc.stdin.once("drain", r));
  }
}
enc.stdin.end();
await new Promise(r => enc.on("close", r));
await browser.close();
server.close();
console.log(`${out}  (${frames} frames @ ${fps}fps, ${blur}x motion blur)`);
