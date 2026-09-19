# Change request for the ops bot (Talon) — monthly / weekly KPI sets

The TV now has a **Monthly / Weekly** toggle on the eight cash-ops tiles.
Monthly is the wall's default; Weekly is for the Tuesday L10 scorecard.

**Nothing is broken while you do nothing.** A KPI row with no `Period` column
counts as monthly, so the tab as it stands today renders exactly as it does now.
The weekly view simply shows `—` for all eight until weekly rows exist. Take
this at whatever pace suits.

Board side is already shipped and tested.

---

## The change

### 1. Add a `Period` column to the `KPI` tab

Values: `monthly` or `weekly`. Position doesn't matter — columns are matched by
header text, not by index. Alongside `Value` is the obvious home.

Then write the eight metric rows **twice**: one set `monthly`, one set `weekly`.
Metric strings stay byte-identical across both sets; `Period` is what separates
them.

Accepted spellings (case and punctuation ignored):

| Period | Accepted |
|---|---|
| monthly | `monthly`, `month`, `mtd`, `month to date` |
| weekly | `weekly`, `week`, `wtd`, `l10`, `week to date` |
| blank | counts as **monthly** |

Anything else — `quarterly`, `ytd`, `q3` — is **dropped with a console warning**
rather than guessed at. A quarter displayed under a monthly heading is worse
than a missing tile. If you need a third period, say so and the board can grow
one; don't smuggle it through this column.

### 2. Add three `Meta` keys

| Key | Example | Purpose |
|---|---|---|
| `period_label_monthly` | `September MTD` | Header label while the board is on Monthly |
| `period_label_weekly` | `Week of Sep 14–20` | Header label while on Weekly |
| `default_period` | `monthly` | What a fresh browser opens on |

The existing generic `period_label` still works and describes the **default**
view. The board will never reuse it to label the other period — week numbers
under a monthly-sounding heading is exactly the kind of quiet lie this whole
contract exists to prevent.

### Worked example

```csv
Metric,Period,Value,Target,Unit,Source,Owner,Notes,Updated ET
Appointments Set,monthly,41,50,count,GHL,Marketing,,2026-09-18T19:16:12-04:00
Cash Collected,monthly,"$142,900",,USD,ProLine,Margaret,,2026-09-18T19:16:12-04:00
Appointments Set,weekly,11,12,count,GHL,Marketing,,2026-09-18T19:16:12-04:00
Cash Collected,weekly,"$31,450",,USD,ProLine,Margaret,,2026-09-18T19:16:12-04:00
```

---

## Two things that will bite if they're missed

**1. Targets must be scaled per period.** `Target` is read per row, so a weekly
row copied from its monthly twin publishes a monthly target against a weekly
number — 11 appointments against a target of 50, on the wall, in front of the
person whose number it is. If the weekly set has no meaningful target, leave
`Target` blank; the board simply omits the target line.

**2. The weekly label must name the actual week.** Write `Week of Sep 14–20`,
not `Last week`. Here's why it matters more than it looks: the header's
`Last updated` is the newest stamp across the whole board, covering Rest Index
and the Top 5 strip as well as the tiles. If the weekly rows go a few days stale
while the rest of the board updates hourly, that header still reads fresh. A
label naming the actual week makes the tiles self-describing, so nobody reads
six-day-old weekly numbers as this week's. That one string is the entire
defence.

---

## Please answer

1. **What window is "monthly"?** Calendar month to date, or the full prior
   month? Whichever it is, `period_label_monthly` should say so plainly.
2. **What window is "weekly"?** Mon–Sun prior week, or week to date? Same — the
   label carries it.
3. **When does each set get written?** Specifically: is the weekly set refreshed
   before Tuesday's L10, and what does it hold the rest of the week — last
   completed week, or week-to-date that moves daily?
4. **Do all eight metrics make sense weekly?** `Total AR Over 60 Days` is a
   balance, not a flow: its weekly value is probably identical to its monthly
   one, which is fine but worth stating. If any metric has no sensible weekly
   figure, leave its weekly `Value` blank and the tile shows `—`.

---

## What the board does with all this

- Fresh load → monthly tiles. One click (or `m` / `w` from a keyboard) → weekly.
- Both sets arrive in the same fetch, so switching is instant.
- The choice is remembered per browser and nothing auto-reverts — instead
  Weekly renders in amber and the label names the view, so a board left on
  weekly announces itself across the room.
- Blank value → `—`. Literal `0` → `0`. Unchanged.
- Rest Index and the Top 5 strip are untouched by any of this.

---

Challenge anything here. Do not change the Sheet until Jacob greenlights it —
this is a schema proposal and four questions, not a ship order.
