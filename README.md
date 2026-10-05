# Talon — Skybird Roofing office TV board

A single-page, read-only wall display for the Skybird Roofing office TV. It shows
three things at a glance, in giant type, on a dark HUD:

- **Sales** (top left, large) — year-to-date signed contracts by closer: company total dominant, then John / Anas / Henry / Other. Five buttons switch the period: **Year to date · This month · Last month · This quarter · Last quarter**. Only YTD has Sheet columns today; the rest keep their button and show `—` rather than deriving one period from another. **Click a closer for the job list** — a centred panel of every signed job in the active period, grouped by month, with the total at the bottom.
- **Top 5 Daily** — today's count-based Daily Top Five % and the ~5-day average per person, with a ding and a green name when somebody closes one
- **Eight cash/ops tiles** — Close Rates, Appointments Set, Contracts Signed $$, Rest Index, Jobs Completed, Sent CoC cash sitting, Total AR Over 60 Days, Cash Collected, most with a 12-week sparkline where `L10 History` has a series for it

Rest Index is the one tile that reads its own tab rather than a `KPI` Period
row, so the Monthly/Weekly toggle does not touch it. **Cost per Appt is not on the main board** — it lives
on the L10 page, where it is one of the nine measurables.

In the middle sits the Talon HUD: concentric instrument rings — graticules, arc
brackets, radial bar readouts, a hex core and a radar sweep — in blues and
greens, moving continuously at rates that drift, burst and reverse. Amber is
reserved for alerts (stale feed, example mode, the AR-over-60 tile) so it always
means "look here".

**Values are written by Talon / humans into Google Sheets; this site only
displays them.** It never computes a KPI from a source system, never caches
numbers server-side, and never invents a value: a blank Sheet cell renders as
`—`, and a literal `0` in the Sheet renders as `0`.

There is one other page: **`/l10.html`**, the Level 10 scorecard. Nine flip
cards, one per Ninety measurable — front is the current L10 week, back is the
13-week trend. It is a desk page for Tuesday's Level 10 meeting, not a wall
page, and it reads its own two Sheet tabs. The **L10** button in the board's
top-right (or the `L` key) opens it; **Back to board** or `Esc` returns.

Product name is **Talon**. Site name suggestion: `talon-tv`.

---

## Stack

Static HTML + CSS + vanilla ES modules, plus three tiny Netlify Functions (Sheet
CSV proxy, passphrase check, Sheet watchdog). No build step, no framework, no
bundler — the page a browser loads is the code in this repo.

```
index.html                  board markup (three zones + centre orb)
assets/css/talon.css        all styling; design tokens at the top
assets/js/config.js         tile list, people, refresh window, tab names  <- tune here first
assets/js/main.js           bootstrap: gate -> first paint -> refresh loop
assets/js/sheet.js          CSV fetch + tab parsers -> normalized model
assets/js/csv.js            RFC4180-ish CSV parser
assets/js/format.js         number/date formatting (em dash rules live here)
assets/js/render.js         model -> DOM
assets/js/hud.js            centre HUD: ring layers + motion engine
assets/js/gate.js           passphrase overlay
netlify/functions/sheet.js  GET /api/sheet?tab=KPI -> text/csv (server-side, no CORS)
netlify/functions/gate.js   GET/POST /api/gate -> passphrase check
fixtures/example.json       EXAMPLE ONLY layout data (not live Skybird numbers)
fixtures/empty.json         EXAMPLE ONLY all-blank data, for empty states
SHEET_SCHEMA.md             exact tabs and column headers Talon must write
```

---

## 1. Google Sheet setup

1. Create one Sheet (suggested name: **Talon Board**) with the tabs and headers
   in [`SHEET_SCHEMA.md`](SHEET_SCHEMA.md) — `KPI`, `Daily Top-Five Progress`,
   `Rest Index`, and optionally `Meta`. For the L10 page also add
   `L10 Scorecard` and `L10 History`. Header spelling matters; row order does not.
2. **Share → Anyone with the link → Viewer.** The board reads the published
   CSV view; it never authenticates as a user.
3. Copy the Sheet id out of the URL:
   `docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`
4. Keep homeowner PII, P&L, bank and QuickBooks detail **out** of these tabs.
   Only the eight ops metrics, Top 5 progress and Rest Index belong here.

### How the board reads it

Preferred (default): the browser calls the Netlify Function, which fetches

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<TAB>
```

server-side. The Sheet id stays out of the page source and there are no CORS
surprises on a TV that stays open for weeks.

Fallback (no Functions): set `sheetId` in `assets/js/config.js` and the browser
fetches those CSV URLs directly. The board tries the Function first and falls
back automatically if it answers 404 (not deployed) or 501 (`SHEET_ID` unset).

---

## 2. Local development

```bash
# static only — fixtures work, Functions do not
npm run dev:static           # http://localhost:5173/?mode=example

# full stack (Functions + env vars), needs network on first run
cp .env.example .env         # fill in SHEET_ID, optionally TALON_PASSWORD
npm run dev                  # netlify dev, http://localhost:8888

npm test                     # parser/formatter smoke tests (no network)
npm run check                # naming guard: repo must say Talon, nothing else
```

URL switches (work locally and in production):

| URL | Effect |
|---|---|
| `/` | live mode — reads the Sheet |
| `/?mode=example` | example fixture, badge reads **example data** |
| `/?mode=empty` | all-blank fixture, to check empty states |
| `/?refresh=240` | override refresh seconds (clamped to 120–300) |
| press `r` | force an immediate refresh (handy while tuning) |
| press `m` / `w` | switch the tiles between Monthly and Weekly (L10) |

The eight tiles carry two sets of numbers: **Monthly** (the wall's default) and
**Weekly** for the Tuesday L10 scorecard. The header toggle switches between
them with no refetch — both sets arrive in the same `KPI` tab, separated by a
`Period` column (see `SHEET_SCHEMA.md`). The choice is remembered per browser,
nothing auto-reverts, and Weekly lights amber so a board left on it reads as
"not the usual view" from across the room. A KPI tab with no `Period` column
behaves exactly as before: everything counts as monthly.

---

## 3. Deploy to Netlify

```bash
npx netlify-cli deploy --prod    # or connect the repo in the Netlify UI
```

`netlify.toml` already sets publish dir `.`, functions dir `netlify/functions`,
and the `/api/*` and `/t/*` redirects. No build command.

Then in **Site settings → Environment variables**:

| Variable | Required | Notes |
|---|---|---|
| `SHEET_ID` | yes | the Sheet id from step 1 |
| `TALON_PASSWORD` | optional | set it to turn on the passphrase gate |
| `SHEET_TAB_KPI` / `SHEET_TAB_TOP5` / `SHEET_TAB_REST` / `SHEET_TAB_META` | optional | only if you rename tabs |
| `SHEET_TAB_L10` / `SHEET_TAB_L10_HISTORY` | optional | only if you rename the L10 tabs |
| `SHEET_TAB_SALES_YTD` | optional | only if you rename the sales tab |
| `ALERT_WEBHOOK_URL` | optional | where the Sheet watchdog posts when a tab needs a look — see below |
| `HEALTH_MAX_AGE_HOURS` | optional | overrides every tab's staleness limit (hours) |
| `SHEET_GID_L10` / `SHEET_GID_L10_HISTORY` | optional | numeric gids, if you would rather address the L10 tabs by id than by name |

Redeploy after changing env vars — Functions read them at runtime, but the
deploy is what picks up new values.

---

## 4. Access control

The board is internal. Pick one, or stack two:

1. **Secret URL (good enough for the office TV).** Any path under `/t/` serves
   the board: bookmark e.g. `https://talon-tv.netlify.app/t/8fb2c1d4e9`. Generate
   a path segment with `openssl rand -hex 5` and keep it off public pages.
   Nothing links to it and the page is `noindex, nofollow`.
2. **Passphrase gate (this repo).** Set `TALON_PASSWORD`. The board asks once,
   verifies it in `/api/gate` (constant-time compare, never in the bundle), and
   remembers it in that browser's localStorage so the TV survives a reboot.
   Leave `TALON_PASSWORD` blank and the gate stays off.
3. **Netlify site-wide password** (hardest wall, needs a paid plan):
   Site settings → Access control → Visitor access → Password protection.

The passphrase gate is a "keep the lobby out" measure, not authentication. For
anything stronger use option 3.

---

## 5. TV setup (1920×1080)

- Chrome on a Chromebox / mini PC, fullscreen (`F11`), pointed at the secret URL.
- Kiosk mode if you want it locked down:
  `chrome --kiosk --incognito=off "https://talon-tv.netlify.app/t/<secret>"`
  (don't use incognito — the gate's saved passphrase would be wiped each boot).
- Casting from a laptop tab to a Chromecast works, but a wired mini PC is what
  survives overnight.
- Sleep/screensaver off; the page pauses its refresh loop when the tab is hidden
  and refreshes immediately when it becomes visible again.

---

## 6. Refresh and freshness

- Auto-refresh every **180s** by default. Change it in the Sheet (`Meta` →
  `refresh_seconds`) or in `assets/js/config.js`. Values are clamped to 120–300s.
- **Last updated** (top right) shows `Meta → last_updated_et` when Talon writes
  it, formatted `Thu Sep 17 · 4:05 PM ET`; otherwise it shows this board's own
  fetch time. Always America/New_York, regardless of the TV's clock.
- If a refresh fails, the last good numbers stay on screen and an amber
  **feed stale** badge appears (hover for the reason). The board never wipes to
  zeros. An unconfigured data source shows **no data source** instead.
- Any fixture mode shows an amber **example data** badge — live mode can never
  display fixture numbers.

---

## 7. How Talon keeps the Sheet current

Talon already owns the inputs; this board only reads what Talon writes:

- **Rest Index** — from the Morning Runway sheet's weekday stale clock (column A:
  days since last touch). Drive id for humans:
  `1qpAJYkdxByPNPynUMcXJZQ5EWFF3UVxjnlgKDJkUdj0`. Talon writes each owner's
  average and, preferably, the company `Rest Index` summary row so the math lives
  in one place. If that row is missing, the board averages the four owners
  client-side.
- **Daily Top-Five Progress** — weekday 4pm updates, count-based: each of 5 items
  done = 20%, so Today % ∈ {0, 20, 40, 60, 80, 100}, plus a ~5-day average.
- **The eight KPIs** — Appointments Set and Cost per Appt from Go High Level;
  Contracts Signed $$, Close Rates (Anas · John · Henry combined), Jobs Completed,
  Sent CoC cash sitting, Total AR Over 60 Days and Cash Collected from ProLine.

Nothing in this repo calls ProLine or GHL, and the TV page cannot edit the Sheet.

### The sync script

`apps-script/talon-sync.gs` is the piece that fills two of those tabs without
anyone typing: pasted into the Talon Board spreadsheet (Extensions → Apps
Script) it builds every tab to spec, reads Morning Runway to produce the
`Rest Index` tab, scores a `Top-Five Entry` check-off tab into
`Daily Top-Five Progress`, and installs weekday triggers (6am rows, 7am Rest
Index, 4pm Top Five). It runs as whoever installs it, so it needs no keys and no
extra sharing. Install steps and the Morning Runway column mapping are in
[`apps-script/README.md`](apps-script/README.md). The eight KPI values stay
hand/Talon-written.

---

## 8. Number formatting rules

| Kind | Rendered |
|---|---|
| USD | `$1,234` / `$186,400` (full commas, no decimals) |
| Percent | `42%`, one decimal when the Sheet has one (`38.5%`) |
| Count | `12` (integer, commas above 999) |
| Rest Index | one decimal (`2.4`) |
| Blank cell | `—` |
| Literal `0` | `0` |

The TV board drops cents on purpose — nobody reads `$186,432.19` from across the
room. The **L10 page keeps them** (`$22,039.40`), because those figures get typed
into Ninety and the cents have to match. Inside the small trend charts the goal
label alone is shortened to `goal ≥ $40,000`, to keep it from crowding the plot.

---

## 9. Tuning it (Jacob)

### Type, palette, layout — `assets/css/talon.css`

- **Type scale and spacing** hang off `--u` at the top of the file
  (`--u: min(1vw, 1.78vh)` — one unit ≈ 19px on a 1080p TV). Bump a number like
  `13` in `.rest__value` to resize the hero, `3.9` in `.tile__value` for tiles.
- **Palette** — `--cyan`, `--amber`, `--bg`, `--ink*` tokens under `:root`, plus
  `--hud-blue`, `--hud-blue-deep`, `--hud-green`, `--hud-green-deep` for the centre.
- **Layout** — `.zones` column ratios, `.tiles` grid, `--gap`. Cluster size is
  the `25` in `.hud`.
- Metric labels, people and the refresh window live in `assets/js/config.js`.

### The centre HUD — `assets/js/hud.js`

Each ring is one masked div; the only animated property is `transform`, so the
whole cluster stays on the compositor. Rotation runs through the Web Animations
API rather than CSS keyframes, because changing a playback rate re-speeds a ring
without making it jump.

`RINGS` is the composition — one entry per ring, listed outside in:

| Field | Meaning |
|---|---|
| `kind` | `ticks`, `bars`, `arcs` or `sweep` (picks the gradient style) |
| `in` / `out` | annulus edges as a % of the cluster radius — the ring's thickness |
| `period` / `duty` | tick pitch and tick width in degrees (`ticks`, `bars`) |
| `from` | angular offset of the tick pattern, for interleaving bar layers |
| `win` | `[fromDeg, spanDeg]` makes the ring a partial band instead of a full circle |
| `arcs` | `[[fromDeg, spanDeg], …]` arc segments (`arcs`) |
| `color` | use the `C.blue / blueDeep / green / greenDeep / ice(alpha)` helpers |
| `spin` | seconds per rotation at rate 1 — bigger is slower |
| `dir` | `1` clockwise, `-1` counter-clockwise |

The bar readout is three layers (`barsA/B/C`) sharing one pitch, speed and
angular window at different depths — that overlap is what produces uneven bar
heights. `barsD` is the short counter-band opposite it.

Motion:

- `VARIANT_GAP` (ms) is how often a variant fires. Widen it for a calmer board.
- Variants are plain functions in one array — `drift`, `burst`, `reverse`
  (ramps through zero, so the ring stalls then unwinds), `barSync`, `scan`,
  `blink`, `counterSwing`. Delete one to retire it or add your own; each just
  ramps a layer with `layer.rampTo(rate, ms)` or blinks it with
  `layer.flicker(n)`.
- Rates ramp instead of snapping, so "slow then quick" is a ramp duration, not a
  duration swap. Roughly: `0.15–0.7` = lazy drift, `1` = the ring's `spin` value,
  `2.5–5.5` = burst.
- The cluster pauses when the tab is hidden and resumes on return, and
  `prefers-reduced-motion` gives one constant slow rotation with no variants.

Check changes against `/?mode=example` (full) and `/?mode=empty` (empty states)
before deploying, then `npm test && npm run check`.

## 10. Sheet metrics Talon still owes us

The board renders honestly around these, but they are blank or stale until the
ops bot fills them. Written up in full as
[`docs/TALON_SALES_YTD_REQUEST.md`](docs/TALON_SALES_YTD_REQUEST.md).

| Missing | Effect on the board |
|---|---|
| **Non-YTD period columns** (`Sales YTD`) | This month / Last month / This quarter / Last quarter show `—`. The board reads `Month $$`, `Last Month $$`, `Quarter $$`, `Last Quarter $$` (and their `… Count` partners) when Talon writes them, and never derives a period from another. The **pop-up** already narrows by those windows, because every detail row carries its own Won Date — filtering is not deriving. |
| **`Close Rates` Value** (`KPI`) | Tile 1 shows `—` for the company figure and all three closers. ProLine owns the definition and Talon transcribes it — the board never derives a close rate. Four rows needed: `Close Rates`, `Close Rate - John`, `Close Rate - Anas`, `Close Rate - Henry`, monthly and weekly. See [`docs/TALON_CLOSE_RATES_REQUEST.md`](docs/TALON_CLOSE_RATES_REQUEST.md). |
| **`Cash Sitting` / `Sent CoC`** | Has a value but no `L10 History` series, so that tile gets no sparkline. |
| **`KPI` freshness** | As of Oct 5 the whole tab was last written Sep 18, so seven tiles show September under a "September MTD" label. |
| **`Target` column** (`KPI`) | Empty on every row, so no tile can show a goal or a hit/miss. |

`Sales YTD` landed Oct 5 and the card is live with real numbers.

`/api/health` reports all of this per tab — see §12.

---

## 11. Top Five celebrations

Somebody finishes an item on their Daily Top Five, the ops bot writes the new
percentage, and within a few seconds the board dings once and turns that
person's name bright green. That is the whole feature.

The Top Five strip polls **its own tab every 12 seconds**, separate from the
board refresh — a ding four minutes after the fact is a puzzle, not a
celebration. The KPI tiles, Rest Index and HUD stay on the Meta
`refresh_seconds` cadence, because none of those move minute to minute. The
proxy caches that one tab at the edge for 8s rather than 30s, so several
screens in the office don't multiply the load on Google while still seeing a
close within seconds.

Three rules stop it lying or nagging (all in `assets/js/celebrate.js`, all unit
tested):

- **The first successful poll is a baseline and never celebrates.** A TV that
  boots at 8am must not ding six times for yesterday's work.
- **Only an increase celebrates.** A decrease is the bot correcting itself; a
  blank cell is a write in progress. A blank holds the last known value, so a
  mid-write gap can't manufacture an increase when the number comes back. An
  invalid `Today %` — anything outside {0, 20, 40, 60, 80, 100} — is a broken
  cell, not a smaller win, and never fires anything. A person who was blank at
  baseline and reaches 20 *is* a real first close, and does.
- **One at a time.** The 4pm write can move three people at once; three dings
  on top of each other tell you nothing about who they were for. They queue
  and play ~1.8s apart.

Colours: **bright green + a dot** for whoever closed most recently, **soft
green** for anyone else at 20% or more, default white for blank or 0. The dot
is always in the layout and only changes opacity, so the state is never carried
by colour alone and switching it on can't nudge the row. An increase that lands
on 100% pulses that name for ~2.6s — `transform` and opacity only, so the strip
never reflows. Under `prefers-reduced-motion` the pulse is a fade, not a scale.

### Sound

Browsers refuse to play audio until the page has been interacted with, and a
wall display never is. So:

- The **SOUND ON / SOUND OFF** control in the top bar persists to
  `localStorage` (`talon.sound`). Off means visual only — greens and pulses
  still happen. `S` toggles it from a keyboard.
- Unlocking the board with the passphrase counts as the gesture, so on the
  normal path sound just works. Where it doesn't, the control reads **SOUND —
  TAP** in amber and one click fixes it — it never fails silently.
- For a kiosk nobody ever touches, launch Chrome with
  `--autoplay-policy=no-user-gesture-required` and it needs no tap at all.

The ding is `public/sounds/ding.wav` — 53 KB, 0.62s, mono. It is **synthesised,
not sampled**: `npm run sound` regenerates it from `scripts/make-ding.mjs`, so
there is no third-party licence attached to anything in this repo. Replacing it
is just dropping another file at that path.

---

## 12. The Sheet watchdog

Both ways the Sheet goes wrong are invisible from the board:

- **Schema drift.** A column is added and the fetch still succeeds, so no badge
  lights up. A `Period` column appeared on the `L10 Scorecard` tab and the L10
  page rendered eighteen cards instead of nine for a day before anyone noticed.
- **Staleness.** A tab stops being written but keeps serving its last values.
  The fetch succeeds, so the amber **feed stale** badge — which only ever means
  the fetch *failed* — stays dark. The `KPI` tab sat four days old showing
  Friday's numbers as though they were today's.

There is a third, nastier case. **gviz does not 404 an unknown tab name — it
serves the first sheet of the workbook**, at HTTP 200, as perfectly valid CSV.
Asking for a tab that does not exist returns `KPI`, which parses cleanly and is
completely wrong: the Sales YTD drill-down read KPI rows for a day and reported
*"no jobs for this closer"* rather than *"that tab does not exist"*. The
not-CSV guard cannot catch it, because the body **is** CSV.

So the contract doubles as proof of identity. Every tab declares columns only it
has, and the proxy rejects a response that does not carry them — a tab's
`required` set may never be satisfiable by `KPI`'s own columns (`Metric`,
`Value`, `Target`, `Owner`), which a test enforces.

The checks live in `netlify/lib/health.js` with two entry points:

| | |
|---|---|
| `GET /api/health` (`functions/health.js`) | the report, any time, no side effects, never notifies |
| `functions/health-cron.js` | the daily run, scheduled in `netlify.toml`, the only one that notifies |

They are separate because **Netlify will not serve a scheduled function over
HTTP** — it answers 403. The first version put the schedule on `health`, which
made the one documented verification command the one command that could not
work.

```bash
curl -s https://talon-tv.netlify.app/api/health | jq .status
```

Per tab it reports: whether it resolved (and by gid or by name), how many rows
and columns came back, any **required column missing** (that breaks a zone →
`error`), any **undocumented column** (drift → `warn`), and how old the newest
**and oldest** timestamps are against that tab's limit.

Both ends matter. A tab that is only **partly** rewritten reads as perfectly
fresh if you look at the newest stamp alone — eight new close-rate rows on the
`KPI` tab made it report `ok` while fourteen cash rows sat seventeen days old
underneath them, which is the exact failure this thing exists to catch. So a tab
whose oldest row is past the limit while its newest is not is reported as *"only
partly refreshed"*. `L10 History` is exempt (`appendOnly`): it is a record of
past weeks, and rows written once keep their stamp forever. A tab is only judged stale on a stamp
that carries its own timezone offset; a human stamp like `Mon Sep 21 · 9:01 PM
ET` is displayable but not comparable, so it is skipped rather than guessed at.

Limits are 30h for the daily tabs, 48h for `KPI` and `Meta`, and 192h (a week
and a day) for the two weekly L10 tabs. Override with `HEALTH_MAX_AGE_HOURS`
for all of them or `HEALTH_MAX_AGE_KPI`, `HEALTH_MAX_AGE_TOP5`,
`HEALTH_MAX_AGE_REST`, `HEALTH_MAX_AGE_META`, `HEALTH_MAX_AGE_L10`,
`HEALTH_MAX_AGE_L10_HISTORY` for one.

**Getting told about it.** `netlify.toml` schedules `health-cron` for 13:05 UTC
daily — 9:05am ET in summer, 8:05am in winter — early enough that a tab which
stopped being written overnight is reported before the day starts. Only that
function notifies; `GET /api/health` never sends anything, so checking by hand
is free.

To actually receive the message, set **`ALERT_WEBHOOK_URL`** to anything that
accepts `{"text": "..."}` — a Slack or Discord incoming webhook, a Zapier or
Make catch hook. Unset, the function is report-only and the verdict still lands
in the Netlify function log every run, so the log is a usable history either
way.

Adding a tab means adding it to `DEFAULT_TABS` **and** `CONTRACT` in
`netlify/lib/tabs.js`; a test fails if the two disagree, because a tab with no
contract entry is a tab the watchdog cannot check.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **no data source** badge | `SHEET_ID` unset in Netlify (or `CONFIG.sheetId` empty in static mode). Set it and redeploy. |
| **feed stale** badge | A fetch failed; hover the badge for the message. Usually Sheet sharing was revoked, a tab was renamed, or Google hiccupped. Last good numbers stay up. |
| A tile shows `—` but the Sheet has a value | The `Metric` cell must match the tile label exactly (see `SHEET_SCHEMA.md`); a renamed row won't match. |
| A person is missing from Top 5 | Their `Person` cell must match `config.js` `top5Order` spelling; unknown names are appended at the bottom instead. |
| Board asks for the passphrase every morning | The TV browser clears localStorage on exit (incognito/guest mode). Use a normal profile, or switch to the secret URL only. |
| Whole board blank | Open devtools: a 403 from `/api/sheet` means the requested tab isn't whitelisted in `netlify/functions/sheet.js`. |
