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

**Close rates are four rows, not one.** `Close Rates` holds the company figure
and `Close Rate - John` / `Close Rate - Anas` / `Close Rate - Henry` hold the
closers, each with a `monthly` and a `weekly` Period row like every other metric
here. The board shows the company rate as the tile's big number and the three
closers as chips beneath it, and any that is blank shows `—`.

**ProLine owns that definition — the board never computes a close rate.**
Whatever ProLine reports is transcribed verbatim, including its window, which is
recorded in the row's `Notes` so the tile can be labelled honestly rather than
re-cut to match the other tiles. See
[`docs/TALON_CLOSE_RATES_REQUEST.md`](docs/TALON_CLOSE_RATES_REQUEST.md).

Percent values are stored as written: `42` means 42%. A `0.42` would render as
`0.4%`.

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

This tab also feeds the **sparklines on the eight TV tiles**, which is why the
`Measurable` strings matter beyond the L10 page. `assets/js/config.js` maps each
tile to the measurable that draws its line — the names differ because the two
tabs were written by different hands (`Cost per Appt` on `KPI` is
`Cost per Appointment Set` here). Two tiles have no line and get none rather
than an invented one: `Close Rates` has no company-wide series, only the three
per-closer measurables, and `Sent CoC cash sitting` is not in this tab at all.

---

## Tab: `Sales YTD`

Feeds the large top-left card on the TV: year-to-date signed contracts by
closer. **This tab does not exist yet** — the card renders its frame with `—`
until the ops bot ships it. See
[`docs/TALON_SALES_YTD_REQUEST.md`](docs/TALON_SALES_YTD_REQUEST.md) for the
request as sent.

Row 1 headers:

```
Closer | Contract $$ | Contracts Count | Updated ET
```

Five rows: `John`, `Anas`, `Henry`, `Other`, `Total`.

| Column | Notes |
|---|---|
| `Closer` | one of the five above. A closer the Sheet omits still gets a row on the card, showing `—` — dropping a person silently is worse than admitting there is nothing for them. |
| `Contract $$` | plain number, no `$` or commas. The board formats it and drops the cents. |
| `Contracts Count` | integer. |
| `Month $$` / `Month Count` | optional, for the card's "This month" view. Absent means that view shows `—`; the board never derives a month from the year or borrows the monthly `Contracts Signed $$` tile. |
| `Notes` | optional. On the `Other` row it should list who was folded in, which the card marks with `···` and surfaces on hover. |
| `Updated ET` | ISO with offset. |

- **`Total` is the Sheet's own figure, always.** The board never sums the closer
  rows and substitutes its own. If the total disagrees with the parts, the card
  footnotes it — *"total differs from the closer rows"* — rather than correcting
  one of them, because a total that quietly disagrees is worse than one that
  says so.
- A closer with no contracts this year is `0`. Blank means "could not read",
  renders `—`. They are not interchangeable.
- This card ignores the Monthly/Weekly toggle. It is year-to-date either way.

---

## Tab: `Sales YTD Detail`

The job list behind each closer on the sales card — one row per signed job.
Clicking a closer's name opens it.

Row 1 headers:

```
Closer | Project Number | Customer | Won Date | Won Month | Contract $$ | Updated ET
```

| Column | Notes |
|---|---|
| `Closer` | the same four labels as `Sales YTD`: `John`, `Anas`, `Henry`, `Other`. |
| `Project Number` | ProLine project #. Not shown on the row — it rides on the customer's tooltip, because it settles arguments rather than being read across a room. |
| `Customer` | homeowner or project name. |
| `Won Date` | `YYYY-MM-DD`, the America/New_York calendar day. |
| `Won Month` | `YYYY-MM`, for grouping. Optional — the board falls back to the first seven characters of `Won Date`. |
| `Contract $$` | plain number. A blank leaves that month's subtotal unknown (`—`) rather than producing a sum nobody can reconcile; the job count stays true. |

- **The board regroups and re-sorts regardless of the Sheet's row order** —
  month descending, then date descending, then customer. Row order is a
  convenience, not a contract.
- Dates are never parsed through `Date`. `new Date('2026-10-01')` is read as UTC
  and comes back as September 30th west of Greenwich, which would file a job
  under the wrong month on a panel whose whole point is which month it was
  signed.
- A job whose month cannot be read sorts last rather than being dropped — it is
  a real signed job, and hiding it would make the panel disagree with its own
  footer.
- **The footer total is what the detail rows add up to.** If the `Sales YTD`
  summary disagrees, both figures are shown and the difference is named in
  amber. No row is invented or dropped to make them match.
- An empty tab, or a closer with no rows in it, says *"No YTD jobs in Sheet"*.
  A missing tab says *"Detail tab not ready"*. Neither invents a job.

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
| `ytd_label` | `2026 YTD` | Period chip on the sales card. Falls back to the calendar year — a label is not a KPI, so naming the window from the clock is safe where inventing a figure is not. |
| `ytd_basis` | `ProLine Won Date, Jan 1 2026 to date` | Printed small under the sales card, so nobody has to ask what the number counts. |

Unknown keys are ignored, so the tab is safe to extend.

---

## What happens when a tab is missing

Each tab is fetched independently. A missing, renamed or empty tab blanks only
its own zone — the board reports a data-source failure just when all three data
tabs (`KPI`, `Daily Top-Five Progress`, `Rest Index`) fail. So the Top 5 strip
lights up the moment it is wired, even before the `Rest Index` tab exists.

This tab is also the one Talon polls fastest — every 12 seconds — because an
increase in `Today %` fires the celebration ding and turns that person's name
green (README §10). Nothing about the schema changes for it: the board watches
the same `Person` / `Today %` columns it always has, and only an increase
between two polls counts. A decrease reads as the bot correcting itself, and a
blank cell reads as a write in progress, so neither celebrates.

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

## Changing a tab's shape

Adding a column is safe for the board — unknown columns are ignored — but it is
not silent any more. `/api/health` compares every tab's headers against the
contract in `netlify/lib/tabs.js` and reports an undocumented column as drift,
because a `Period` column appearing on `L10 Scorecard` unannounced is what made
the L10 page render eighteen cards instead of nine. So: add the column, then add
it to that file's `known` list for the tab. Removing a column the board reads is
reported as an error.

The same endpoint reports a tab whose newest `Updated ET` has fallen behind its
limit, which is the case the amber **feed stale** badge cannot cover — that badge
means the fetch failed, not that the numbers are old. See README §10.

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
