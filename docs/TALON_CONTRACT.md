# TV board ↔ Talon: the data contract

Answers to Talon's four questions, plus what the board does with each tab.
Paste-able as-is. Board repo: `talon-tv`. Live: https://talon-tv.netlify.app/

Architecture is agreed and unchanged: **Talon writes the Sheet, the TV only
reads it.** The page never calls ProLine or GHL, never parses Morning Runway,
and never invents a number.

---

## 1. Env vars and the Function path

| Variable | Required | Notes |
|---|---|---|
| `SHEET_ID` | **yes** | `1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ` |
| `TALON_PASSWORD` | optional | turns on the passphrase gate |
| `SHEET_TAB_KPI` | optional | default `KPI` |
| `SHEET_TAB_TOP5` | optional | default `Daily Top-Five Progress` |
| `SHEET_TAB_REST` | optional | default `Rest Index` |
| `SHEET_TAB_META` | optional | default `Meta` |
| `SHEET_GID_KPI` / `SHEET_GID_TOP5` / `SHEET_GID_REST` / `SHEET_GID_META` | optional | tab **gid**; wins over the name when set, and survives a tab rename |

Function path: **`GET /api/sheet?tab=<exact tab name>`** → `text/csv`
(internally `/.netlify/functions/sheet`, rewritten in `netlify.toml`). It
whitelists exactly those four tabs and refuses anything else with 403, so the
proxy can never be used to read other tabs of the file.

Status codes the board relies on: `501` = `SHEET_ID` unset, `403` = tab not
whitelisted, `502` = Google refused that tab (typically: tab does not exist).

## 2. Parser expectations per tab

**Every tab is fetched independently.** A tab that is missing, renamed or empty
only blanks its own zone — it never takes the board down. The board reports a
data-source failure only when *all three* data tabs fail. So `Rest Index` not
existing yet is fine: Top 5 and the tiles still render.

Headers are matched case/space/punctuation-insensitively (`Today %` = `today%`),
and a row whose first cell is blank or starts with `Note` is skipped.

### `KPI` — `Metric | Value | Target | Unit | Source | Owner | Notes | Updated`

- `Metric` must match the tile label exactly (the eight locked strings).
- `Value`: `$`, `,` and `%` are stripped, so `$186,400` / `186400` / `186,400`
  all parse. Non-numeric → missing → `—`.
- `Unit`: `count` | `USD` (or `$`) | `pct` (or `%`). Drives formatting.
- `Target`: optional; renders as small amber `target …` under the value.
- `Source` / `Owner` / `Notes` are parsed but **never displayed** (Notes could
  carry detail that shouldn't be on a wall).

### `Daily Top-Five Progress` — `Person | Today % | ~5-day avg | Updated ET`

- `Today %` is validated against the locked count-based set
  **{0, 20, 40, 60, 80, 100}**. Anything else — a timestamp string, `45`, text —
  is treated as missing and drawn as `—`, with a console warning. This is now
  covered by a test using the exact corrupted-Margaret case.
- `~5-day avg` accepts any number 0–100 (it's a mean). Outside that → missing.
- `80%` and `80` both read as 80. A bare `0.8` is read as a Sheets
  percent-formatted fraction → 80%.
- Blank → `—` with an empty bar. A real `0` → `0%` with an empty bar. Those are
  deliberately different.
- People render in locked order (Margaret, Travis, John, Henry, Anas, Jacob);
  extra names are appended rather than dropped.

### `Rest Index` — `Person | Days at rest avg | Project count | Updated ET`

Both proposed layouts work; no need to choose one for the parser's sake:

- Person rows (Jacob, John, Henry, Anas) → the four chips.
- The company number comes from a row whose first cell is **`Rest Index`** —
  as a fifth person-style row *or* inside a `Key | Value` summary block lower
  down. A repeated `Key`/`Person` header line in that block is ignored.
- `snake_case` keys in that block (`period_label`, `last_updated_et`,
  `refresh_seconds`) are read as Meta, not as people. The `Meta` tab wins when
  both are present.
- If no `Rest Index` row exists at all, the board falls back to the mean of the
  four owners' averages client-side — but Talon's value is preferred, always.
- `Project count` is parsed and not yet displayed.

### Tabs the board does *not* read

`runway_flat` and `run_log` are Talon's own working tabs. The board never
fetches them and the Function won't proxy them, so their shape is entirely
Talon's business — change them freely.

### Annotation rows are safe

State the blank-clock rule on the `Rest Index` tab as agreed. A row whose value
isn't a number and whose name isn't one of the four owners (`Rule | blank clocks
excluded…`, `Notes: sorted longest days-in-stage first`) is ignored rather than
drawn as a person. The four owners always render — as `—` while unwritten — and
an extra person with a real number still renders. Covered by a test.

### `Meta` — `Key | Value`

`last_updated_et`, `period_label`, `refresh_seconds` (clamped 120–300s).
Unknown keys ignored.

### Sample normalized shape

What the renderer sees after parsing (`—` is drawn wherever a value is `null`):

```json
{
  "mode": "live",
  "example": false,
  "meta": { "lastUpdatedEt": "2026-09-17T16:00:00-04:00",
            "periodLabel": "as-of Morning Runway rebuild",
            "refreshSeconds": 180 },
  "kpi": { "cashcollected": { "metric": "Cash Collected", "number": 88240,
                              "targetNumber": null, "unit": "USD" } },
  "top5": [ { "person": "Margaret", "today": null, "week": 92 },
            { "person": "Travis",   "today": 20,   "week": 56 } ],
  "rest": { "index": 3.0, "computed": false,
            "people": [ { "person": "Jacob", "days": 2.6, "projects": 10 } ] },
  "updated": { "date": "2026-09-17T20:00:00.000Z", "raw": "…" },
  "sources": { "kpi": "ok", "top5": "ok", "rest": "unavailable", "meta": "unavailable" }
}
```

### Timestamps

`Last updated` shows the **newest stamp the board can parse** across Meta
`last_updated_et` and every tab's `Updated` / `Updated ET` column.

- ISO 8601 **with an offset** (`2026-09-17T16:00:00-04:00`) is parsed, ordered
  and reformatted to `Thu Sep 17 · 4:00 PM ET`. **Please write this form.**
- A human stamp with no zone (`Wed Sep 17 7:10 AM`) is displayed verbatim and
  can't be ordered — guessing its zone would invent precision.

### Staleness

The amber **feed stale** badge means *the fetch failed*, not *the data is old*.
Overnight and weekend retention of Friday's numbers is correct and shows no
badge. If you want age-based flagging, say what threshold and the board can add
it.

## 3. Sharing — decision: link-view for v1

The Function fetches the `gviz` CSV endpoint, which is **unauthenticated**, so
today it needs the file set to **Anyone with the link → Viewer**. Exposure is
narrow: `SHEET_ID` lives only in Netlify env, never in page source, and the
board itself sits behind a secret `/t/<random>` path plus the optional
passphrase.

If policy says the file must not be link-readable, the board can switch to the
Sheets API v4 with a service account (`values.get`, share the file to the
service account's email, key in Netlify env). That's a contained change to one
function — maybe an hour. Not needed for v1.

**Decision: ship v1 on link-view.** Revisit if the KPI tab ever carries
something that shouldn't be readable by anyone holding the file id.

## 4. Fixture vs live mode

Already built and impossible to confuse:

- `/` → live. Reads the Sheet only. Cannot display fixture numbers, ever.
- `/?mode=example` → example fixture, amber **example data** badge.
- `/?mode=empty` → all-blank fixture, for checking empty states.

Both fixture files are labelled `EXAMPLE ONLY — not live Skybird numbers`, and
any fixture mode forces the badge on. The Sep 7–13 numbers can never appear
without it.

---

## Upstream suggestions (write path, not display)

Talon has accepted 1–4 and 6–7 below in principle, pending Jacob's ship order;
#5 (`runway_flat`) lands on the KPI Board rather than in Morning Runway. Kept
here for the record:

1. **Write `Today %` as a number from the locked set**, and validate before
   writing. The corrupted-into-a-timestamp cell suggests a Date landing in a
   percent column, or a shifted range. Writing the whole six-row block in one
   ordered `setValues` call (or matching on the `Person` column) removes the
   class of bug.
2. **One timestamp convention: ISO 8601 with offset**, in a column named
   `Updated ET` on every tab. It's the only form a consumer can order.
3. **Blank `Today %` at the ~7:30 AM Top Five send**, so the TV reads `—`
   ("not scored yet") for the morning instead of yesterday's score looking like
   today's. Same for a holiday.
4. **Reconsider "blank clock = 0" in the Rest Index math.** Counting an
   unknown clock as 0 days biases the index optimistic — an untouched project
   with no clock reads as "touched today". Excluding blanks (and reporting
   `Project count` so the denominator is visible) is more honest. Either way,
   document the choice in the tab.
5. **Consider publishing a flat `runway_flat` tab** (`owner | project | days |
   status`) as a byproduct of the 8:30 rebuild. Rest Index then becomes a
   trivial aggregation over a flat table instead of a parse of a sectioned
   sheet with header rows, blanks and notes — and a human can audit why the
   index moved.
6. **A `run_log` tab** (`routine | started | finished | rows written | error`)
   turns "did the 4pm pass run?" into a lookup, and would let the board show a
   genuine freshness signal rather than inferring one.
7. **Rename the Sheet file** to `Talon KPI Board`. The legacy name still says
   the banned product name in Drive, share dialogs and search; the `gviz` URL
   keys off the file id, so a rename breaks nothing. (The repo has a CI check
   that fails on that string, which is why it appears nowhere in it.)
