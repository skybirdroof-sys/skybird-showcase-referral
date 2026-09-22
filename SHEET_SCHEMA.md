# Talon board — Google Sheet schema

The TV board is read-only. This file is the contract: if Talon writes these tabs
and headers, the board renders. Anything else is ignored rather than guessed at.

- Header text matters (see [Header matching](#header-matching) for the tolerance).
- Row order does not matter; the board orders people itself.
- A row whose first cell is empty or starts with `Note` is skipped, so a notes
  row at the bottom of a tab is fine.
- **Blank cell = unknown.** It renders as `—`. Never write `0` to mean "no data";
  a literal `0` is rendered as `0`.
- No homeowner PII, no P&L, no bank or QuickBooks account detail in these tabs.

Sheet sharing: **Anyone with the link → Viewer**. The board reads each tab as CSV
via `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<TAB>`.

---

## Tab: `KPI`

Row 1 headers:

```
Metric | Value | Target | Unit | Source | Owner | Notes | Updated
```

Rows — the `Metric` text must match these strings exactly, because they are the
labels on the TV:

| Metric | Unit | Written from |
|---|---|---|
| `Appointments Set` | count | GHL |
| `Cost per Appt` | USD | GHL |
| `Contracts Signed $$` | USD | ProLine |
| `Close Rates` | pct | ProLine (Anas · John · Henry combined) |
| `Jobs Completed` | count | ProLine |
| `Sent CoC cash sitting` | USD | ProLine |
| `Total AR Over 60 Days` | USD | ProLine |
| `Cash Collected` | USD | ProLine |

Optional column: **`Period`** — `monthly` or `weekly`.

The TV defaults to the monthly set; a **Weekly** toggle in the header switches
the eight tiles to the weekly (L10) set. To provide both, write the eight metric
rows twice — one set `Period = monthly`, one set `Period = weekly`.

- A **blank** `Period` counts as `monthly`, so a KPI tab without this column
  renders exactly as it does today. Adding the column is optional and
  backwards-compatible.
- Accepted spellings: `monthly` / `month` / `mtd`, and `weekly` / `week` / `wtd`
  / `l10`. Case and punctuation are ignored.
- Anything else (`quarterly`, `ytd`) is **dropped with a console warning** —
  better a missing tile than a quarter displayed as the month.
- Metric strings stay identical across both sets; the Period column is what
  separates them.

Column notes:

- **Value** — may be blank. `$`, `,` and `%` are stripped, so `$186,400`, `186400`
  and `186,400` all work. Anything non-numeric is treated as blank.
- **Target** — optional. When present it renders as small amber `target …` text
  under the value. Leave blank for no target.
- **Unit** — `count`, `USD` (or `$`), `pct` (or `%`). Drives formatting. If blank,
  the board falls back to the unit in the table above.
- **Source**, **Owner**, **Notes** — for humans working in the Sheet. The board
  reads them but does not display them (notes could carry detail that shouldn't
  be on a wall).
- **Updated** — ISO (`2026-09-17T16:05:00-04:00`) or human ET text, whenever Talon
  last wrote the row. Informational; the board's clock comes from `Meta`.

Close Rates is **one combined number** on the TV. Per-closer detail can live in
extra rows or another tab — the board ignores rows it doesn't have a tile for.

---

## Tab: `Daily Top-Five Progress`

Row 1 headers:

```
Person | Today % | ~5-day avg | Updated ET
```

Rows: `Margaret`, `Travis`, `John`, `Henry`, `Anas`, `Jacob`.

- **Today %** — count-based scoring, locked: each of the 5 items done = 20%, so
  the value is one of `0`, `20`, `40`, `60`, `80`, `100`.
- **~5-day avg** — the rolling weekday average, same scale.
- Either may be blank (person off, day not scored yet) → `—` and an empty bar.
- Percent parsing: `80%` and `80` both read as 80. A value between 0 and 1
  (`0.8`) is read as a Sheets percent-formatted fraction → 80%. Count-based
  scoring never produces a legitimate `1`, so there is no ambiguous case.
- Extra people are rendered after the six above, so adding a name is safe.
- A trailing notes row (e.g. `Notes: count-based scoring`) is ignored.

---

## Tab: `Rest Index`

Row 1 headers:

```
Person | Days at rest avg | Project count | Updated ET
```

Rows, at minimum: `Jacob`, `John`, `Henry`, `Anas` — each person's average
**days at rest** across their open projects, from Morning Runway column A
(weekday stale clock: days since last touch). Lower is better.

Plus one summary row so the math lives in the Sheet, not in the browser:

```
Rest Index | <company avg> |  | Updated ET
```

- The board reads the hero number from that `Rest Index` row (cell `B` of it —
  `Rest Index!B2` if you keep it as row 2; naming that cell `RestIndex` is
  recommended so Talon always writes the same target).
- **If the summary row is missing**, the board computes the hero number
  client-side as the mean of Jacob / John / Henry / Anas (only the ones that have
  a number). Prefer the Sheet-provided row — Talon owns the math.
- `Project count` is not on the TV in v1; keep writing it, it's useful context
  in the Sheet and is already parsed.
- Margaret and Travis are intentionally out of Rest Index for v1. If rows for
  them appear, they render as extra chips and (only when the summary row is
  absent) are still excluded from the client-side average.

---

## Tab: `L10 Scorecard`

Feeds the separate [Level 10 scorecard page](l10.html) at `/l10.html` — the nine
measurables Jacob types into Ninety → Leadership Team → Weekly every Tuesday.
The TV board does not read this tab.

Row 1 headers:

```
Sort | Group | Measurable | Owner | GoalOp | Goal | Value | Unit | WeekLabel | Source | Notes | Updated ET
```

Exactly nine rows, `Sort` 1–9. The `Measurable` text is the join key to
`L10 History`, so it must match character for character:

| Sort | Group | Measurable | Unit |
|---|---|---|---|
| 1 | Sales | `Appointments Set` | `count` |
| 2 | Sales | `Cost per Appointment Set` | `usd` |
| 3 | Sales | `Contracts Signed - $$` | `usd` |
| 4 | Sales | `Close Rate - John` | `percent` |
| 5 | Sales | `Close Rate - Anas` | `percent` |
| 6 | Sales | `Close Rate - Henry` | `percent` |
| 7 | Production | `Jobs Completed` | `count` |
| 8 | Cash | `Total AR Over 60 Days` | `usd` |
| 9 | Cash | `Cash Collected` | `usd` |

**`Appointments Set`, not `Appoinments Set`.** Ninety's own measurable carries
that typo; the sheet and the page both spell it correctly.

- `GoalOp` is one of `>=`, `>`, `<=`, `<`, `=` (the glyphs `≥` and `≤` are also
  accepted). The Hit/Miss pill compares `Value` to `Goal` with that operator and
  no invented scaling.
- A blank `Value` shows `—` and **no pill at all** — unknown is not a miss. A
  literal `0` is judged normally.
- `Unit` picks the formatter: `usd` → `$1,234.56`, `percent` → `42%`,
  anything else → an integer count. This page keeps cents, unlike the TV board,
  because these figures are transcribed rather than read across a room.
- `Owner` may be blank; it renders as `—`.

## Tab: `L10 History`

The 13-week trend behind each card. One row per measurable per visible week.

Row 1 headers:

```
WeekStart | WeekEnd | WeekLabel | Sort | Group | Measurable | Owner | GoalOp | Goal | Value | Unit | Source | SourceDetail | Updated ET
```

- `WeekStart` is an ISO date (`2026-09-14`) and is what the chart sorts on, so
  rows may be appended in any order.
- `WeekLabel` (`Sep 14–20`) is the axis tick and tooltip text.
- **A blank `Value` is a gap, not a zero.** The chart ends one line and starts
  another across it — a run of one surviving week draws as a lone dot. A literal
  `0` is plotted at zero.
- Rows whose `Measurable` matches no card are ignored; a measurable with no rows
  at all gets an honest "No weekly history yet" back face.

---

## Tab: `Meta` (optional, recommended)

Row 1 headers:

```
Key | Value
```

| Key | Example | Effect |
|---|---|---|
| `last_updated_et` | `2026-09-17T16:05:00-04:00` | Drives the board's **Last updated** clock. ISO or human ET text. Falls back to the board's own fetch time when absent. |
| `period_label` | `September MTD` | Describes the **default** view only. Never reused to label the other period. |
| `period_label_monthly` | `September MTD` | Shown when the board is on Monthly. Preferred over `period_label`. |
| `period_label_weekly` | `Week of Sep 14–20` | Shown when the board is on Weekly. |
| `default_period` | `monthly` | Which view a fresh browser opens on. Defaults to `monthly`. |
| `site_title` | `Talon` | Documented for Talon's own use; the page title is hard-coded to Talon. |
| `refresh_seconds` | `180` | Client refresh cadence, clamped to 120–300. |
| `l10_week_label` | `Week of Sep 14–20` | Header on the L10 page. Falls back to the first card's `WeekLabel`. |
| `l10_page` | `L10 Scorecard` | Name of the current-week L10 tab, for Talon's own reference. |
| `l10_history_tab` | `L10 History` | Name of the trend tab, likewise. |
| `l10_trend_weeks` | `13` | How many week positions the trend charts show. |

Unknown keys are ignored, so the tab is safe to extend.

---

## What happens when a tab is missing

Each tab is fetched independently. A missing, renamed or empty tab blanks only
its own zone — the board reports a data-source failure just when all three data
tabs (`KPI`, `Daily Top-Five Progress`, `Rest Index`) fail. So the Top 5 strip
lights up the moment it is wired, even before the `Rest Index` tab exists.

`Today %` is validated against the locked count-based set
**{0, 20, 40, 60, 80, 100}**. A value outside it — text, a stray `45`, a cell
corrupted into a timestamp — is treated as missing and drawn as `—` rather than
rendered as a score nobody earned. `~5-day avg` is a mean, so it takes any
number 0–100.

The L10 page is independent of the board: if `L10 Scorecard` is missing the
page says so and the TV board is unaffected, and if only `L10 History` is
missing the nine cards still render with an empty back face.

`Last updated` shows the newest stamp the board can parse across Meta
`last_updated_et` and every tab's `Updated` / `Updated ET` column. ISO 8601 with
an offset (`2026-09-17T16:00:00-04:00`) is parsed, ordered and reformatted in
ET; a human stamp with no zone is shown exactly as written, because guessing its
zone would invent precision. The amber **feed stale** badge means the fetch
failed — not that the numbers are old, so Friday's scores sitting there all
weekend is correct and shows no badge.

The full board ↔ Talon contract, including sample JSON and the write-path
recommendations, is in [`docs/TALON_CONTRACT.md`](docs/TALON_CONTRACT.md).

## Header matching

Headers are compared after lowercasing and stripping everything that isn't a
letter or digit, so `Today %`, `today%` and `Today  %` are the same column. The
aliases the board accepts:

| Field | Accepted headers |
|---|---|
| Person | `Person`, `Name`, `Crew`, `Owner` (Rest Index) |
| Today % | `Today %`, `Today`, `Today Pct`, `Today Percent` |
| ~5-day avg | `~5-day avg`, `5 day avg`, `Weekly avg`, `Week avg`, `Avg` |
| Days at rest | `Days at rest avg`, `Days at rest`, `Avg days at rest`, `Rest days`, `Days` |
| Project count | `Project count`, `Projects`, `Open projects`, `Count` |
| Metric | `Metric`, `KPI`, `Name` |
| Value | `Value` |
| Target | `Target`, `Goal` |
| Unit | `Unit`, `Units` |
| Updated | `Updated`, `Updated ET`, `Last updated` |
| Meta key/value | `Key`/`Value`, `Name`/`Value`, `Setting`/`Val` |
| Measurable | `Measurable`, `Metric`, `Name` |
| Goal operator | `GoalOp`, `Op`, `Operator` |
| Week label | `WeekLabel`, `Week` |
| Week start | `WeekStart`, `Start` |
| Sort | `Sort`, `Order` |

Renaming a **tab** needs a matching env var (`SHEET_TAB_KPI`, `SHEET_TAB_TOP5`,
`SHEET_TAB_REST`, `SHEET_TAB_META`, `SHEET_TAB_L10`, `SHEET_TAB_L10_HISTORY`) —
the Function only proxies the six tabs it knows about, so an unlisted tab name
is refused rather than fetched.

---

## Worked example (CSV as the board sees it)

`KPI`

```csv
Metric,Value,Target,Unit,Source,Owner,Notes,Updated
Appointments Set,37,50,count,GHL,Jacob,,2026-09-17T16:05:00-04:00
Cost per Appt,$198,,USD,GHL,Jacob,,2026-09-17T16:05:00-04:00
Contracts Signed $$,"$204,775",,USD,ProLine,John,,2026-09-17T16:05:00-04:00
Close Rates,41%,45%,pct,ProLine,Anas,,2026-09-17T16:05:00-04:00
Jobs Completed,0,,count,ProLine,Henry,,2026-09-17T16:05:00-04:00
Sent CoC cash sitting,,,USD,ProLine,John,,
Total AR Over 60 Days,"$31,004",,USD,ProLine,Margaret,,2026-09-17T16:05:00-04:00
Cash Collected,"$88,240",,USD,ProLine,Margaret,,2026-09-17T16:05:00-04:00
```

renders `37`, `$198`, `$204,775`, `41%`, `0`, `—`, `$31,004`, `$88,240`.

`Rest Index`

```csv
Person,Days at rest avg,Project count,Updated ET
Jacob,2.6,10,Wed Sep 17 7:10 AM
John,4.4,16,Wed Sep 17 7:10 AM
Henry,1.9,12,Wed Sep 17 7:10 AM
Anas,3.2,15,Wed Sep 17 7:10 AM
Rest Index,3.0,,Wed Sep 17 7:10 AM
```

renders a hero `3.0` with chips `2.6 / 4.4 / 1.9 / 3.2`.
