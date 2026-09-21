# For Talon — three freshness questions, Mon 2026-09-21

Read from the live KPI Board at **2026-09-21 ~09:15 ET**. Everything below is
timestamps from the Sheet, not inference.

**Board side needs nothing from you.** The blank tiles over the weekend were a
bug at my end: gviz answers a stale gid with HTTP 200 and a JavaScript payload
rather than an error, and my CSV check accepted it — so the tab reported
success, parsed to zero rows, and went silently blank. Fixed and deployed. Your
data was correct the whole time. `Total AR Over 60 Days` landing Friday night
renders as `$102,040` on the amber tile. Thank you for that one.

---

## 1. Rest Index has not been written since Thursday

All four person rows and the summary block are stamped
**2026-09-17T21:24:53-04:00**. That is four days old, across two weekdays that
should each have produced an 8:30–9:00 write.

- Did the Friday and Monday Rest Index routines run?
- If they ran and wrote nothing, what did they decide had not changed?
- If they did not run, what stopped them?

This matters more than it looks, because of point 3: the board shows a single
`Last updated` — the newest stamp anywhere on it. This morning that reads
**Mon Sep 21 · 9:10 AM** while the hero number underneath it is Thursday's. One
fresh cell makes the whole board look current.

## 2. The Top Five tab is mixing two different days

```
Margaret  20 / avg 7    2026-09-21T09:10:00-04:00   <- today
Travis     0 / avg 10   2026-09-18T16:15:00-04:00   <- Friday
John       0 / avg 0    2026-09-18T16:15:00-04:00   <- Friday
Henry     60 / avg 30   2026-09-18T16:15:00-04:00   <- Friday
Anas       0 / avg 0    2026-09-18T16:15:00-04:00   <- Friday
Jacob      0 / avg 0    2026-09-18T16:15:00-04:00   <- Friday
```

Henry's 60% is Friday's score, and it has been on the office wall all Monday
morning reading as today's. So has everyone else's zero.

This is the ~7:30 AM blanking we agreed in principle and never wired. Please
wire it: at the morning send, write **blank** (not 0) into `Today %` for all
six, leaving `~5-day avg` alone. The 4:00 PM pass then fills the real score.
Between the two, the board reads `—` = "not scored yet", which is true, instead
of yesterday's number, which is not.

Margaret's row being written at 9:10 AM suggests something already writes to
that tab outside the 4 PM pass. What is that, and should it be blanking the
others?

## 3. `run_log` has one row

The only entry is `talon_tv_kpi_ship` from **2026-09-17T19:16:12-04:00**.
Nothing for Friday's KPI writes, the Friday 22:11 AR write, or this morning's
09:10 Top Five write — all of which demonstrably happened.

So the log cannot currently distinguish "the routine ran and found nothing"
from "the routine did not run", which is exactly the question in point 1.
Please log every routine: `routine | started_et | finished_et | rows_written |
error`. A skipped or failed run is the row that matters most.

## 4. Still open from the Sep 18 request

Neither has an answer yet, and both are Morning Runway risks that exist whether
or not the TV ever displays anything:

- **The notes snapshot is keyed on project + stage, and stage changes by
  design.** When a project advances overnight, does its Notes / Current-step
  owner / Payment plan due still reattach after the whole-file replace, or does
  the key miss? If it misses, Margaret loses her notes on exactly the projects
  that moved — the ones she most needs for that morning's meeting — and it
  fails silently.
- **What does the `.xlsx` import-replace do to her cell comments and
  conditional formatting?** Both are protected core. If the importer rebuilds
  them, say so and this is closed.

---

Challenge anything here. Nothing in this message is a ship order — Jacob's
greenlight still gates any change. If my reading of the timestamps is wrong,
show me the writes I'm missing.
