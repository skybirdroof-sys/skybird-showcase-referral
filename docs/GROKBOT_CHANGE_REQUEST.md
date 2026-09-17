# Change request for the ops bot (Talon) — TV board data quality

Paste target: the ops bot that writes the Skybird KPI Board Sheet.
Source of truth for the read side: `docs/TALON_CONTRACT.md` in the `talon-tv` repo.

---

## Context

The office TV board is live at https://talon-tv.netlify.app/ and reads exactly
one Google Sheet — the **KPI Board** file, id
`1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ` — tabs `KPI`,
`Daily Top-Five Progress`, `Rest Index`, `Meta`. It is read-only: it never calls
ProLine or GHL, never parses Morning Runway, and never invents a number. You
remain the writer of record for `Rest Index` and `Daily Top-Five Progress`.

---

## HARD CONSTRAINT — Morning Runway belongs to Margaret

Morning Runway (file id `1qpAJYkdxByPNPynUMcXJZQ5EWFF3UVxjnlgKDJkUdj0`) is
Margaret's working sheet. She built it, she works in it every morning, and her
job depends on it being exactly where she left it. **This constraint overrides
everything else in this document, including any suggestion below.** If any
requested change here would require altering Morning Runway's structure, do not
do it — come back and say so instead.

**Do not, under any circumstances:**

- Restructure, "clean up", re-sort, re-group or reformat it.
- Move, rename, delete or re-create the file, or any tab in it.
- Change column positions or insert/remove columns. Column A is the clock and
  stays column A.
- Remove or rewrite her section headers (`JACOB` / `JOHN` / `ANAS` / `HENRY`),
  notes, comments, formulas, conditional formatting, colors, frozen panes,
  filters or named ranges. The colors are decoration to the TV board; they are
  not decoration to Margaret.
- Delete blank rows or blank clocks. A blank clock is meaningful data, not a gap
  to tidy.
- Overwrite any cell a human edited by hand.
- Change its sharing or permissions. She must never lose access or edit rights.
- Add tabs to it for the TV board's benefit. Derived data goes in the KPI Board
  file (see item 6).

**Must remain true after every run:** Margaret opens Morning Runway the next
morning and it looks and behaves exactly as it did before — same layout, same
sections, same formatting, same workflow, nothing new for her to learn or
undo. Her morning does not change because of this work.

**For computing Rest Index, treat Morning Runway as read-only input.** Read it,
aggregate it, write the result into the KPI Board file.

---

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

---

## Requested changes, highest value first

### 1. Put safeguards around the existing 8:30 Morning Runway rebuild

**What:** you already rebuild Morning Runway from ProLine each weekday around
8:30 AM ET. Before that routine writes anything, it should:

- **Snapshot first.** Save a timestamped copy to a backup folder and keep at
  least 30 days, so any bad run is one click to recover.
- **Verify structure, then abort on drift.** Confirm the expected tab, the owner
  sections and the column-A clock are where they belong. If anything is
  unexpected — a section renamed, a column inserted, a tab added — **stop, write
  nothing, and alert.** Never "repair" the sheet to match your expectations;
  Margaret may have changed it deliberately.
- **Write values into designated ranges only**, never whole-sheet clears,
  `clear()`, sort, dedupe or row deletion.
- **Preserve everything non-value**: formatting, notes, comments, formulas,
  colors, merges, filters, frozen panes.
- **Respect a write window.** A rebuild landing mid-edit can clobber what she is
  typing. Confirm the hours she works and keep writes outside them.

**Why:** this is the routine with the most destructive potential in the whole
system, and it runs unattended every weekday against someone's live working
file. Everything else on this list is a display nicety by comparison.

**Accept when:** a dry run shows the snapshot created, the structure check
passing, and a deliberately altered structure causing a clean abort with an
alert and zero writes.

### 2. Blank `Today %` at the ~7:30 AM send

**What:** when the Daily Top Fives go out, write blank (not 0) into `Today %`
for all six people. The 4:00 PM pass then fills the real score.

**Why:** right now Monday at 9 AM displays Friday's 80% and nothing downstream
can tell it isn't today's. Blank makes the TV read `—` = "not scored yet".
Same on holidays or any day the 4 PM pass won't run.

**Accept when:** between the morning send and the 4 PM write, `Today %` is
empty and `~5-day avg` still holds the prior mean.

### 3. One timestamp convention: ISO 8601 with offset

**What:** every KPI Board tab gets a column named `Updated ET` containing e.g.
`2026-09-17T16:00:00-04:00`. Same form in Meta `last_updated_et`.

**Why:** it is the only form a consumer can order or compare. A zone-less human
stamp (`Wed Sep 17 7:10 AM`) has to be displayed verbatim, because guessing its
zone would invent precision the data doesn't carry.

**Accept when:** all four tabs carry offset-bearing ISO stamps and the board's
"Last updated" reformats to `Thu Sep 17 · 4:00 PM ET`.

### 4. Write the Top Five block atomically, and validate before writing

**What:** write all six rows in one ordered `setValues` call (or match on the
`Person` column), with `Today %` as a **number** from the locked set. Reject and
log anything else instead of writing it.

**Why:** one `Today %` cell was corrupted into a timestamp string while its
neighbour was correct — the signature of a Date landing in a percent column or a
shifted range. The board now defends against it, but that's a seatbelt, not a
fix; bad data should never reach the Sheet.

**Accept when:** a deliberate bad value (a Date, `45`, text) is refused and
logged rather than written.

### 5. Revisit "blank clock = 0" in the Rest Index math

**What:** decide explicitly whether a project with a blank column-A clock is
excluded from that owner's average, rather than counted as 0 days. Keep writing
`Project count` either way. This is a change to **your calculation**, not to
Morning Runway — the blank cells stay exactly as they are.

**Why:** counting an unknown clock as zero means an untouched project with no
clock reads as "touched today" and pulls the company number **down**. For a
metric where lower is better, the current rule biases it optimistic — the number
flatters us precisely when data is missing. Excluding blanks, with
`Project count` visible as the denominator, is more honest.

**Accept when:** the rule is stated in the `Rest Index` tab (or in Meta) and
matches what the code does. Either choice is fine; the accident isn't.

### 6. Publish a flat `runway_flat` tab — in the KPI Board file

**What:** as a byproduct of reading Morning Runway, write
`owner | project | days | status | updated_et` to a new tab **in the KPI Board
file**. Nothing is added to Morning Runway.

**Why:** Rest Index then becomes a trivial aggregation over a flat table instead
of a parse of a sectioned sheet with header rows, blank clocks and notes. The
fragile parse happens once, where the data is freshest; when the index moves a
human can see which projects moved it; and it means nothing downstream ever
needs to read Margaret's sheet again.

**Accept when:** `Rest Index` can be recomputed from `runway_flat` alone, and
Morning Runway is untouched by this item.

### 7. Add a `run_log` tab (KPI Board file)

**What:** one row per routine run — `routine | started_et | finished_et |
rows_written | error`. Include the Morning Runway rebuild, with its snapshot
location and structure-check result.

**Why:** "did the 4 PM pass run?" becomes a lookup instead of an inference, and
for the rebuild it gives an audit trail of what was written where. If you add
it, name the staleness threshold you want and the board will surface it.

### 8. Two small ones

- **Rename the KPI Board file** to `Talon KPI Board` — that file only, **not**
  Morning Runway. Its current name still carries the retired product name in
  Drive, share dialogs and search. The CSV endpoint keys off the file id, so a
  rename breaks nothing.
- **Address KPI Board tabs by gid, or create-if-missing**, rather than trusting
  tab names. The board now supports `SHEET_GID_*` env vars for the same reason.

---

## Please keep these invariants

- **Morning Runway keeps its fundamentals and structure. Read it, don't rewrite
  it.** (See the hard constraint above.)
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

1. **Exactly which ranges of Morning Runway do you write today**, and what does
   the rebuild do if the structure doesn't match what you expect?
2. Is there already a pre-rebuild backup? If so, where and how many days?
3. What hours does Margaret work in that sheet, and does the 8:30 rebuild
   overlap them?
4. Does the 4 PM pass read Slack replies and score autonomously, or does someone
   confirm before you write? Where does that gate live?
5. ETA on creating and first-filling the `Rest Index` tab.
6. Are #6 (`runway_flat`) and #7 (`run_log`) cheap for you, or do they need
   their own build?
7. Which of these do you disagree with, and what would you do instead?

---

Challenge anything that you see here. Do not run right away unless you have any
issues with anything that Claude Code has suggested. Make your suggestions or
problematic items known before running anything.

(One exception to that invitation: the Morning Runway constraint is not up for
negotiation. Challenge the engineering freely — if you think a safeguard is
unnecessary or a better approach exists, say so — but the requirement that
Margaret's sheet keeps its structure and her morning workflow is unchanged is
fixed. If you believe a change cannot be made without touching it, the answer is
that the change doesn't happen.)
