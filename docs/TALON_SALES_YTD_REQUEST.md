# Change request for Talon (Grokbot) — Sales YTD tab + freshness

**From:** Talon TV board (Claude Code) · **For:** Jacob to relay · **Date:** Mon Oct 5, 2026
**Sheet:** `1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ` ("Talon KPI Board")

---

## Why

The office TV board is being rebuilt today. The big top-left card stops showing
Rest Index and becomes a **year-to-date sales scoreboard by closer** — the first
thing anyone sees walking into the office. Rest Index moves down to a small card
and keeps working exactly as it does now.

I have built that card to read a tab that does not exist yet. Until it does, it
renders its frame with `—` in every slot, because the board's rule has not
changed: **never invent a number.** I will not derive YTD dollars from the
monthly `Contracts Signed $$` tile, and I will not carry a stale figure forward.

So the single thing standing between the new board and a useful wall is this tab.

---

## ASK 1 — new tab: `Sales YTD` (this is the blocker)

Exact tab name: **`Sales YTD`**

Row 1 headers, exactly:

```
Closer | Contract $$ | Contracts Count | Updated ET
```

Exactly five rows, in this order:

| Closer | Meaning |
|---|---|
| `John` | contracts won by John |
| `Anas` | contracts won by Anas |
| `Henry` | contracts won by Henry |
| `Other` | everyone else — see the bucket rule below |
| `Total` | company-wide |

### Definitions — please use these exactly, do not substitute

- **Period:** calendar year to date. **Jan 1 of the current year → today**, inclusive.
  Not a rolling 12 months, not fiscal.
- **Date basis:** the same one `L10 History` already uses for Contracts Signed —
  ProLine **`[Status] Won Date`** on the projects export. If you use a different
  field, say which in a Notes column and I will label the card accordingly rather
  than let it imply something untrue.
- **`Contract $$`:** sum of **Contract Value** for those projects. Plain number,
  no `$`, no commas, two decimals at most. The board formats it.
- **`Contracts Count`:** how many projects make up that dollar figure. Integer.

### The `Other` bucket

`Other` is every closer who is **not** John, Anas or Henry — including Jacob,
including house or unassigned contracts.

**Please add a `Notes` column on the `Other` row** listing each name folded into
it with their dollar amount, e.g. `Jacob $412,000 (14); unassigned $38,500 (2)`.
Jacob needs to be able to see whether a real closer is hiding inside `Other`
before we decide whether to give them their own row. An extra column is fine —
see "if you add columns" below.

### Blank vs zero — the rule that matters most

- A closer with **genuinely no contracts** this year is **`0`**, not blank.
- **Blank means "I could not read this"** — the export was missing, the field was
  unparseable, whatever. Blank renders as `—` on the wall, which honestly says
  "unknown".
- Never write `0` to mean "no data". Never write a number you had to estimate,
  apportion, or carry over from a previous run.

### `Total` must reconcile

`Total` should equal `John + Anas + Henry + Other`, for both dollars and count.

If it genuinely cannot — a project with no closer that you excluded from the four
buckets, a duplicate you dropped — **write the real company total anyway and say
why in Notes.** Do not force the rows to add up by adjusting one of them. A total
that quietly disagrees with its parts is worse than one that explains itself.

### `Updated ET`

ISO 8601 **with the offset**: `2026-10-05T14:30:00-04:00`.

Not optional. The board's watchdog only measures staleness from stamps that carry
their own timezone — a stamp like `Mon Oct 5 · 2:30 PM ET` is displayable but not
comparable, so it gets skipped and the tab silently looks fresh forever.

---

## ASK 2 — four keys on the `Meta` tab

| Key | Example | What it does |
|---|---|---|
| `ytd_label` | `2026 YTD` | The period chip on the sales card. Falls back to the year if absent. |
| `ytd_basis` | `ProLine Won Date, Jan 1 2026 to date` | Printed small under the card, so nobody has to ask what the number counts. |
| `sales_ytd_tab` | `Sales YTD` | Tab name, for the board's own reference. |
| `ytd_updated_et` | `2026-10-05T14:30:00-04:00` | Optional. Only if it differs from the tab's own stamps. |

---

## ASK 3 — the KPI tab has not been written in 17 days

Every row on `KPI` is stamped **`2026-09-18`**. Today is Oct 5.

The rebuilt board puts seven of those values on the wall. As of right now it will
display **mid-September numbers under a "September MTD" label, in October** —
which reads as a broken board, and is the kind of thing that quietly destroys
trust in the whole display.

Two things, please:

1. **Refresh `KPI`** (both the `monthly` and `weekly` Period blocks).
2. **Update the `Meta` period labels with it** — `period_label_monthly` still
   says `September MTD` and `period_label_weekly` still says `Week of Sep 7–13`.
   A fresh number under a stale label is its own kind of wrong.

If there is a reason the monthly block cannot be refreshed — the GHL or Kayla
export still is not landing, as the Notes say for Appointments Set — then
**blank those Values rather than leave September's**, and say so in Notes. A blank
cell renders `—`, which is true. September's number sitting there in October is
not.

Going forward: what cadence can you commit to for `KPI`? Daily is ideal; if it is
weekly, tell me and I will set the board's staleness threshold to match so it
only complains when something is genuinely wrong.

---

## ASK 4 — the `L10 Scorecard` `last` block is half a week out of step

The Meta key `l10_week_label` reads `Sep 28–Oct 4`, and Sort 1 and 2
(Appointments Set, Cost per Appointment Set) were refreshed Monday to that week.

But Sort 3 through 9 — Contracts Signed, all three Close Rates, Jobs Completed,
Total AR Over 60 Days, Cash Collected — still carry `WeekLabel: Sep 14–20` and
stamps from Sep 21–22.

So the L10 page currently shows **`Sep 28–Oct 4` as its header above seven cards
holding three-week-old numbers.** Jacob reads that page into Ninety every Tuesday.

Please bring all nine `last` rows onto the same completed week, or blank the ones
you cannot source yet. Same for the `current` block, where Sort 3+ still say
`Sep 21–27`.

---

## ASK 5 — Close Rate goals should be blank, not `0`

The three `Close Rate - *` rows carry `Goal = 0` with `GoalOp = >=` on both the
`L10 Scorecard` and `L10 History` tabs.

The L10 page renders that honestly as **`GOAL ≥ 0%`** — which reads as "the target
is zero". It is a placeholder for "no goal set", but nobody looking at it can tell.

**Please write those `Goal` cells blank.** The page already handles a blank goal
correctly: it prints **"no goal set"**, which is the true statement.

I deliberately have not special-cased `0` in code, because "a goal of zero means
no goal" is a rule I would be inventing about your data, and it would hide a real
zero target if one ever existed.

(The underlying blocker — no same-period per-closer appointment denominator — is
understood and is not what this ask is about. Your Notes on those rows are exactly
right and I am not asking you to invent close rates.)

---

## ASK 6 — Rest Index cadence

`Rest Index` is stamped `2026-09-24`, 11 days ago. It is about to become a card
people look at every day rather than a hero number.

What cadence can you commit to? Daily from the Morning Runway would be ideal. As
with KPI, tell me what is realistic and I will set the threshold to match.

---

## Rules that apply to all of the above

These are the board's standing rules, unchanged:

1. **Never invent, estimate, apportion or carry forward a number.** If you cannot
   prove it from a source, leave the cell blank.
2. **Blank means unknown and renders `—`. A literal `0` means zero and renders `0`.**
   They are not interchangeable in either direction.
3. **Timestamps carry their offset** (`-04:00`), or staleness cannot be measured.
4. **Do not restructure the existing tabs.** `KPI`, `Daily Top-Five Progress`,
   `Rest Index`, `Meta`, `L10 Scorecard`, `L10 History` keep their current headers
   and shapes. The board reads them by column name.
5. **If you add a column, tell us.** The board now runs a schema watchdog that
   compares every tab's headers against a documented contract and flags anything
   undocumented. This is not a complaint about growth — the sheet is allowed to
   grow — it just means a new column needs one line in our config, and we would
   rather add it than discover it. (This is how the L10 page briefly rendered
   eighteen cards instead of nine when the `Period` column appeared unannounced.
   No harm done, and the watchdog exists because of it.)
6. **The Morning Runway is untouched by all of this.** Nothing here asks you to
   read, rewrite, restructure or rebuild it. Margaret's sheet keeps its
   fundamentals and structure, and she runs her morning exactly as she does now.

---

## What is NOT changing

- **Keep writing `Cost per Appt` to the `KPI` tab.** The main board stops showing
  that card, but the L10 page still uses `Cost per Appointment Set` and we may
  bring it back. No work needed — just do not remove it.
- `Daily Top-Five Progress` is unchanged in every respect. The celebration ding
  and the green names read the same `Today %` column they always have. Keep
  blanking Today % in the morning the way you do; a blank is never treated as a
  decrease and never fires anything.
- `runway_flat`, `run_log`, `L10 History` structure — all unchanged.

---

## How we will know it worked

Once `Sales YTD` exists, this returns a verdict with no deploy and no guessing:

```
curl -s https://talon-tv.netlify.app/api/health | jq
```

It reports, per tab: whether it resolved, row and column counts, any missing
required column, any undocumented column, and how far the newest timestamp has
fallen behind that tab's limit. If `Sales YTD` shows up there as `ok`, the card
will be live on the wall on the next refresh.

---

## Priority, if you can only do some of it

1. **ASK 1** — `Sales YTD`. The new board's headline card is empty without it.
2. **ASK 3** — refresh `KPI` + its Meta labels. Seven cards are showing September.
3. **ASK 4** — the L10 week mismatch. Jacob types that page into Ninety weekly.
4. ASK 2, 5, 6 — whenever.
