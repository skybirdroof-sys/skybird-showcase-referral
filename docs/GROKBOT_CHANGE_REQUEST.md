# Change request for the ops bot (Talon) — TV board data quality

Paste target: the ops bot that writes the Skybird KPI Board Sheet.
Source of truth for the read side: `docs/TALON_CONTRACT.md` in the `talon-tv` repo.

---

## Context

The office TV board is live at https://talon-tv.netlify.app/ and reads exactly
one Google Sheet (file id `1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ`), tabs
`KPI`, `Daily Top-Five Progress`, `Rest Index`, `Meta`. It is read-only: it never
calls ProLine or GHL, never parses Morning Runway, and never invents a number.
You remain the writer of record for `Rest Index` and `Daily Top-Five Progress`.

## Already handled on the board side — please don't work around these

1. **Tabs are fetched independently.** A missing, renamed or empty tab blanks
   only its own zone. `Rest Index` not existing yet costs nothing elsewhere.
2. **`Today %` is validated** against the locked count-based set
   {0, 20, 40, 60, 80, 100}. Out-of-range values render as `—`, never as a score.
3. **Either `Rest Index` layout works** — a person-style `Rest Index` row, or a
   `Key | Value` summary block lower down. `snake_case` keys in that block
   (`period_label`, `last_updated_et`, `refresh_seconds`) are read as Meta.
4. **Timestamps**: the board shows the newest stamp it can parse across Meta
   `last_updated_et` and every tab's `Updated` / `Updated ET` column.
5. **Staleness**: the amber "feed stale" badge means *the fetch failed*, not
   *the data is old*. Friday's numbers sitting there all weekend is correct and
   raises nothing.
6. Blank cell → `—`. A literal `0` → `0`. These are deliberately different and
   the board depends on you preserving the distinction.

## Requested changes, highest value first

### 1. Blank `Today %` at the ~7:30 AM send

**What:** when the Daily Top Fives go out, write blank (not 0) into `Today %`
for all six people. The 4:00 PM pass then fills the real score.

**Why:** right now Monday at 9 AM displays Friday's 80% and nothing downstream
can tell it isn't today's. Blank makes the TV read `—` = "not scored yet".
Same on holidays or any day the 4 PM pass won't run.

**Accept when:** between the morning send and the 4 PM write, `Today %` is
empty and `~5-day avg` still holds the prior mean.

### 2. One timestamp convention: ISO 8601 with offset

**What:** every tab gets a column named `Updated ET` containing e.g.
`2026-09-17T16:00:00-04:00`. Same form in Meta `last_updated_et`.

**Why:** it is the only form a consumer can order or compare. A zone-less human
stamp (`Wed Sep 17 7:10 AM`) has to be displayed verbatim, because guessing its
zone would invent precision the data doesn't carry.

**Accept when:** all four tabs carry offset-bearing ISO stamps and the board's
"Last updated" reformats to `Thu Sep 17 · 4:00 PM ET`.

### 3. Write the Top Five block atomically, and validate before writing

**What:** write all six rows in one ordered `setValues` call (or match on the
`Person` column), with `Today %` as a **number** from the locked set. Reject and
log anything else instead of writing it.

**Why:** one `Today %` cell was corrupted into a timestamp string while its
neighbour was correct — the signature of a Date landing in a percent column or a
shifted range. The board now defends against it, but that's a seatbelt, not a
fix; bad data should never reach the Sheet.

**Accept when:** a deliberate bad value (a Date, `45`, text) is refused and
logged rather than written.

### 4. Revisit "blank clock = 0" in the Rest Index math

**What:** decide explicitly whether a project with a blank column-A clock is
excluded from that owner's average, rather than counted as 0 days. Keep writing
`Project count` either way.

**Why:** counting an unknown clock as zero means an untouched project with no
clock reads as "touched today" and pulls the company number **down**. For a
metric where lower is better, the current rule biases it optimistic — the number
flatters us precisely when data is missing. Excluding blanks, with
`Project count` visible as the denominator, is more honest.

**Accept when:** the rule is stated in the tab (or in Meta) and matches what the
code does. Either choice is fine; the accident isn't.

### 5. Publish a flat `runway_flat` tab as a byproduct of the 8:30 rebuild

**What:** while rebuilding Morning Runway, also write
`owner | project | days | status | updated_et` to a flat tab.

**Why:** Rest Index then becomes a trivial aggregation over a flat table instead
of a parse of a sectioned sheet with header rows, blank clocks and notes. The
fragile parse happens once, where the data is freshest, and when the index moves
a human can see which projects moved it.

**Accept when:** `Rest Index` can be recomputed from `runway_flat` alone.

### 6. Add a `run_log` tab

**What:** one row per routine run — `routine | started_et | finished_et |
rows_written | error`.

**Why:** "did the 4 PM pass run?" becomes a lookup instead of an inference, and
it lets the TV show genuine data age rather than only "fetch failed". If you add
it, name the staleness threshold you want and the board will surface it.

### 7. Two small ones

- **Rename the Sheet file** to `Talon KPI Board`. The current file name still
  carries the retired product name in Drive, share dialogs and search. The CSV
  endpoint keys off the file id, so a rename breaks nothing.
- **Address tabs by gid, or create-if-missing**, rather than trusting tab names.
  The board now supports `SHEET_GID_*` env vars for the same reason.

## Please keep these invariants

- You are the only writer of `Rest Index` and `Daily Top-Five Progress`.
- Blank means unknown; never write 0 to stand in for missing data.
- `KPI` metric strings must stay exactly: Appointments Set, Cost per Appt,
  Contracts Signed $$, Close Rates, Jobs Completed, Sent CoC cash sitting,
  Total AR Over 60 Days, Cash Collected.
- Top Five scoring stays count-based, 20% per item; people stay Margaret,
  Travis, John, Henry, Anas, Jacob.
- Rest Index stays Jacob, John, Henry, Anas, lower is better.
- No homeowner PII, no P&L, no bank or QuickBooks detail in these tabs.

## Please answer

1. Does the 4 PM pass read Slack replies and score autonomously, or does someone
   confirm before you write? Where does that gate live?
2. ETA on creating and first-filling the `Rest Index` tab.
3. Are #5 (`runway_flat`) and #6 (`run_log`) cheap for you, or do they need
   their own build?
4. Which of these do you disagree with, and what would you do instead?

---

Challenge anything that you see here. Do not run right away unless you have any
issues with anything that Claude Code has suggested. Make your suggestions or
problematic items known before running anything.
