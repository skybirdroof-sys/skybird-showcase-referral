# Talon sheet sync (Apps Script)

`talon-sync.gs` runs **inside the Talon Board spreadsheet** and keeps the tabs
the TV board reads. It runs as whoever installs it, so if you install it while
signed in as the account that owns Morning Runway, it reads that sheet with your
own access — no sharing, service accounts or API keys.

What it does:

| Function | Job |
|---|---|
| `ensureTabs()` | Creates `KPI`, `Daily Top-Five Progress`, `Rest Index`, `Meta` and `Top-Five Entry` with the exact headers in `SHEET_SCHEMA.md`, and seeds the eight KPI metric rows |
| `syncRestIndex()` | Reads Morning Runway, averages each owner's open-project days at rest, writes the `Rest Index` tab plus the company summary row |
| `syncTopFive()` | Reads `Top-Five Entry`, scores each person (items done × 20%), writes today's % and the ~5-day average |
| `addTodaysEntryRows()` | Drops six blank check-off rows with checkboxes each weekday morning |
| `installTriggers()` | 6am rows · 7am Rest Index · 4pm Top Five, weekdays |

It writes **blank** for anything unknown — never a 0 standing in for missing
data — which is what the board renders as `—`. It never writes to Morning Runway.

## Install (5 minutes)

1. Open the Talon Board spreadsheet → **Extensions → Apps Script**.
2. Delete the placeholder `Code.gs` contents, paste all of `talon-sync.gs`, save.
3. Set `CONFIG.runwayId` to the Morning Runway spreadsheet id (the long string in
   its URL) if it differs from the default.
4. Run `ensureTabs` once. Google will ask you to authorize — it needs Sheets
   access for this spreadsheet and read access to Morning Runway.
5. Run `syncRestIndex`. If it throws "No owner column" or "No days-at-rest
   column", fix the mapping in `CONFIG.runway` (below) and run it again.
6. Run `installTriggers` once. Reload the spreadsheet and you'll also get a
   **Talon** menu for running any of it by hand.

## Mapping Morning Runway

The script finds columns by header text, and falls back to a column letter:

```js
runway: {
  ownerHeader: 'Owner',          // whatever your header actually says
  daysHeader:  'Days at rest',
  statusHeader: 'Status',

  daysLetter: 'A',               // used only if the header isn't found
  closedStatuses: ['closed', 'complete', ...],   // these rows are skipped
}
```

Header matching ignores case, spaces and punctuation, and will take a partial
match (`Days at Rest (wd)` matches `Days at rest`). If Morning Runway has no
status column, leave `statusHeader`/`statusLetter` empty and every row counts as
open.

The company Rest Index is the unweighted mean of the four owners' averages —
"average of each owner's open-project days at rest". A person with no open
projects is blank and sits out of the mean; swap to a project-weighted mean by
averaging the raw rows instead if you'd rather.

## The Top-Five Entry tab

One row per person per weekday:

```
Date       | Person   | Item 1 | Item 2 | Item 3 | Item 4 | Item 5 | Done (0-5)
2026-09-17 | Margaret |   ✓    |   ✓    |   ✓    |        |        |
```

Tick the boxes as the day goes, or type a count in `Done (0-5)` (that column
wins if both are filled). A person with **no row at all** for today shows `—` on
the TV; a row with boxes all unticked is a real `0%`. The `~5-day avg` averages
that person's most recent 5 scored rows.

If your Top Five check-offs already happen somewhere else (ProLine tasks, a
different sheet, an app), point `syncTopFive()` at that source instead — it only
needs a person, a date and a count of items done.

## The eight KPI tiles

`syncRestIndex`/`syncTopFive` don't touch the `KPI` tab — those eight numbers
come from GHL and ProLine and get written by Talon or by hand. The board reads
whatever is in `KPI!B`, and shows `—` for any blank.
