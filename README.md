# Talon — Skybird Roofing office TV board

A single-page, read-only wall display for the Skybird Roofing office TV. It shows
three things at a glance, in giant type, on a dark HUD:

- **Rest Index** — average open-project days at rest across Jacob / John / Henry / Anas (lower is better)
- **Top 5 Daily** — today's count-based Daily Top Five % and the ~5-day average per person
- **Eight cash/ops tiles** — Appointments Set, Cost per Appt, Contracts Signed $$, Close Rates, Jobs Completed, Sent CoC cash sitting, Total AR Over 60 Days, Cash Collected

**Values are written by Talon / humans into Google Sheets; this site only
displays them.** It never computes a KPI from a source system, never caches
numbers server-side, and never invents a value: a blank Sheet cell renders as
`—`, and a literal `0` in the Sheet renders as `0`.

Product name is **Talon**. Site name suggestion: `talon-tv`.

---

## Stack

Static HTML + CSS + vanilla ES modules, plus two tiny Netlify Functions (Sheet
CSV proxy, passphrase check). No build step, no framework, no bundler — the page
a browser loads is the code in this repo.

```
index.html                  board markup (three zones + centre orb)
assets/css/talon.css        all styling; design tokens at the top
assets/js/config.js         tile list, people, refresh window, tab names  <- tune here first
assets/js/main.js           bootstrap: gate -> first paint -> refresh loop
assets/js/sheet.js          CSV fetch + tab parsers -> normalized model
assets/js/csv.js            RFC4180-ish CSV parser
assets/js/format.js         number/date formatting (em dash rules live here)
assets/js/render.js         model -> DOM
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
   `Rest Index`, and optionally `Meta`. Header spelling matters; row order does not.
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

---

## 9. Tuning it (Jacob)

Everything cosmetic is in `assets/css/talon.css`:

- **Type scale and spacing** hang off `--u` at the top of the file
  (`--u: min(1vw, 1.78vh)` — one unit ≈ 19px on a 1080p TV). Bump a number like
  `13` in `.rest__value` to resize the hero, `3.9` in `.tile__value` for tiles.
- **Palette** — `--cyan`, `--amber`, `--bg`, `--ink*` tokens under `:root`.
- **Orb intensity** — `.orb__mist--a/b/c` (blur, alpha, animation duration) and
  `.orb__core`. Slow everything down by raising the `spin` durations; calm it
  further by lowering the alphas. `.orb__ring` is a disabled hook if you want a
  HUD ring back.
- **Layout** — `.zones` column ratios, `.tiles` grid, `--gap`.
- Metric labels, people and the refresh window live in `assets/js/config.js`.

Check changes against `/?mode=example` (full) and `/?mode=empty` (empty states)
before deploying, then `npm test && npm run check`.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **no data source** badge | `SHEET_ID` unset in Netlify (or `CONFIG.sheetId` empty in static mode). Set it and redeploy. |
| **feed stale** badge | A fetch failed; hover the badge for the message. Usually Sheet sharing was revoked, a tab was renamed, or Google hiccupped. Last good numbers stay up. |
| A tile shows `—` but the Sheet has a value | The `Metric` cell must match the tile label exactly (see `SHEET_SCHEMA.md`); a renamed row won't match. |
| A person is missing from Top 5 | Their `Person` cell must match `config.js` `top5Order` spelling; unknown names are appended at the bottom instead. |
| Board asks for the passphrase every morning | The TV browser clears localStorage on exit (incognito/guest mode). Use a normal profile, or switch to the secret URL only. |
| Whole board blank | Open devtools: a 403 from `/api/sheet` means the requested tab isn't whitelisted in `netlify/functions/sheet.js`. |
