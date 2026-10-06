# Standing instructions for Talon (Grokbot) — keeping the board current

**For:** Jacob to paste to Talon · **Date:** Mon Oct 5, 2026
**Sheet:** `1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ` ("Talon KPI Board")
**Board:** https://talon-tv.netlify.app/

This is not a change request. Everything the TV board needs now exists and every
tab reads healthy. This is the standing contract for **keeping it that way**.

---

## The one rule that matters most

**Rewrite every row on a tab you touch, not just the rows whose values changed.**

`Updated ET` means *"I checked this at this time"*, not *"this changed at this
time"*. A figure you re-verified and found unchanged still gets a fresh stamp.

This is now enforced. The board's watchdog reads the **oldest** row on a tab as
well as the newest, because a tab that is only partly rewritten reads as
perfectly fresh if you look at the newest stamp alone. That exact thing happened
on Oct 5: eight new close-rate rows made `KPI` report healthy while fourteen cash
rows sat seventeen days old underneath them, and the board showed September
numbers under an October label.

**A fresh row sitting beside a stale one is worse than a wholly stale tab** — the
first looks trustworthy and is not.

The one exception is `L10 History`, which is append-only. Rows for past weeks
keep their original stamps forever; that is correct and the watchdog knows it.

---

## Cadence per tab

These are the limits the watchdog actually holds you to. Writing more often than
the limit is always fine; the limits have headroom so one missed run is a
warning, not a crisis.

| Tab | Limit | Expected rhythm |
|---|---|---|
| `Daily Top-Five Progress` | **30h** | Blank `Today %` each weekday morning, then bump through the day as people close items. The board polls this tab every 12 seconds. |
| `Rest Index` | **30h** | Every weekday morning from the Morning Runway. |
| `Sales YTD` | **30h** | Daily. All five period column pairs, all five rows. |
| `Sales YTD Detail` | **30h** | Daily, **in the same run as `Sales YTD`** — see reconciliation below. |
| `KPI` | **48h** | Daily. All 34 rows, both the monthly and weekly blocks, and the close rates for all five periods. |
| `Meta` | **48h** | With every run that changes a label or a stamp. |
| `L10 Scorecard` | **192h** | Weekly, Monday night / Tuesday morning before the Level 10. **All 18 rows onto the same week** — the `last` block spent two weeks with two of nine measurables on the current week and seven three weeks behind, under a current-week header. |
| `L10 History` | **192h** | Weekly, appending the completed week. Past rows are never rewritten. |

### Weekends

The Top Five, Rest Index and the sales tabs are not expected to move on a
Saturday. The daily check runs at **11:05am ET**, after the morning routines, so
Monday's blanking has already landed by the time anything is measured. Nothing
needs doing on a weekend.

---

## The rules that never change

1. **Never invent, estimate, apportion, derive or carry forward a number.** If
   you cannot prove it from a source this run, **blank the cell and say why in
   `Notes`**. Do not leave the previous run's figure in place — a stale number
   that looks current is the single worst thing that can be on that wall.
2. **Blank means unknown and renders `—`. A literal `0` means zero and renders
   `0`.** They are not interchangeable in either direction. "John is not listed
   on ProLine's report" is blank; "ProLine says John closed nothing" is `0`. The
   board shows those differently on purpose.
3. **Every timestamp carries its offset** — `2026-10-05T17:58:00-04:00`. A stamp
   without one cannot be compared to now, so the watchdog skips it and the tab
   looks fresh forever.
4. **Transcribe, do not recalculate.** Where a source system reports a figure —
   ProLine's close rates, QuickBooks' AR — write what it says and record in
   `Notes` which report it came from and what window it covers. Do not re-window
   a figure to match one of our columns; write it with its own window stated.
5. **Never rename a tab.** gviz does not fail on an unknown tab name — it
   silently serves the **first sheet of the workbook**, which is `KPI`. A rename
   would feed KPI rows to whatever asked for the renamed tab. The board now
   catches this, but it will hard-fail that tab rather than quietly cope.
6. **Tell us before adding a column.** The sheet is allowed to grow; the board
   just needs one line of config so a genuinely unexpected column still stands
   out. Adding one is not a problem — adding one silently means the watchdog
   reports it as drift until somebody looks.
7. **Do not restructure existing tabs.** Headers and shapes stay as they are;
   the board reads by column name.
8. **The Morning Runway is untouched by all of this.** Nothing here asks you to
   read, rewrite, restructure or rebuild it. Margaret's sheet keeps its
   fundamentals and its structure, and she runs her morning exactly as she does
   now.

---

## Reconciliation you own

Two places where two numbers have to agree, and where the board will say so out
loud if they do not:

- **`Sales YTD` ↔ `Sales YTD Detail`.** For every closer and every period, the
  detail rows must sum to the summary column and count to the count. Refresh
  them together; a summary rebuilt without its detail will disagree with itself
  the moment somebody clicks a name.
- **`Sales YTD` Total ↔ its four closer rows.** Write the true company total
  even where it does not equal `John + Anas + Henry + Other`, and explain the
  difference in `Notes`. **Never adjust a closer row to force the total to
  balance.** The board prints the Sheet's total verbatim and footnotes a
  disagreement rather than hiding it.

---

## Checking your own work

After any run that writes to the sheet:

```
curl -s https://talon-tv.netlify.app/api/health | jq
```

Expected: `"status": "ok"` and all eight tabs `ok`. The report names anything
wrong, per tab:

| What it says | What it means |
|---|---|
| `tab not found` | the name did not resolve and gviz served `KPI` instead |
| `missing required column` | a column the board reads is gone — that zone is blank |
| `undocumented column` | a new column nobody told the board about |
| `newest stamp is Nh old` | the tab stopped being written |
| `only partly refreshed` | **some rows are current and others are not** |
| `parses to zero data rows` | the tab is there and empty |

It is also mailed daily at 11:05am ET if a webhook is configured.

---

## Where things stand tonight

All eight tabs `ok`. `KPI` fully refreshed for the first time since Sep 18,
`Rest Index` back inside its window after eleven days, and the `L10 Scorecard`
`last` block finally on one week. Nothing is outstanding — this document exists
so it stays that way.
