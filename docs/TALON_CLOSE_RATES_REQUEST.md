# Change request for Talon (Grokbot) — Close Rates from ProLine

**From:** Talon TV board (Claude Code) · **For:** Jacob to relay · **Date:** Mon Oct 5, 2026
**Sheet:** `1kkeeWFfNFEideM9UZLnno7fI2OMSFHydNv6MOHL2FMQ` ("Talon KPI Board")

---

## The decision

**ProLine already calculates close rate. We are going to read its number, not
build our own.**

Jacob owns the definition and will fix it inside ProLine if it is wrong. That
means neither the Sheet nor the board derives a close rate from anything — no
contracts ÷ appointments, no cohort maths, no apportioning. Whatever ProLine
reports is what the wall shows.

This is the same rule the rest of the board runs on, and it is the reason the
tile has said `—` for three weeks rather than showing a plausible-looking number
nobody could defend. It also means that when a closer argues with the figure,
the answer is "that is ProLine's number, here is the report" — which is a
conversation Jacob can actually have.

**So: do not compute a close rate. Transcribe one.**

---

## ASK 1 — four new rows on the `KPI` tab

The `KPI` tab already has `Close Rates` with a blank Value. Keep it, fill it, and
add three per-closer rows beside it. Same schema, same Period column, no new tab:

```
Metric | Period | Value | Target | Unit | Source | Owner | Notes | Updated ET
```

| `Metric` | What it holds |
|---|---|
| `Close Rates` | the **company** close rate ProLine reports |
| `Close Rate - John` | John Vollmer's, as ProLine reports it |
| `Close Rate - Anas` | Anas Elakri's |
| `Close Rate - Henry` | Henry Styron's |

Each one needs a `monthly` row **and** a `weekly` row, like every other metric on
that tab, so the board's Monthly/Weekly toggle keeps working.

The spelling of those three `Metric` strings matters — the board looks them up by
exact text. Match the pattern already used on the L10 tabs: `Close Rate - John`,
with a space-hyphen-space.

### Format

- **`Unit` is `pct`.**
- **Write `42` for 42%, not `0.42`.** The board renders the percent exactly as
  stored and adds the `%` sign itself, so a decimal fraction would appear on the
  wall as "0.4%".
- A closer ProLine genuinely reports as **zero** is `0`. **Blank means "ProLine
  did not report it"** and renders `—`. Not interchangeable, in either direction.
- `Updated ET` as ISO with the offset, as everywhere else.

---

## ASK 2 — tell us what ProLine's number actually means

This is the part that makes the figure defensible, and it is a Notes cell, not
work.

In the `Notes` column of each row, record:

1. **Which ProLine report or field the number came from** — the report name, or
   the dashboard widget, verbatim.
2. **What ProLine says it divides** — e.g. "won ÷ opportunities created in
   period", "won ÷ appointments run", "won ÷ leads assigned". Whatever ProLine's
   own definition is, in ProLine's own words.
3. **The window** ProLine used for that figure (MTD, trailing 30, the quarter —
   whatever the report is set to).

Please do not normalise, re-window, or "correct" ProLine's number to match the
other tiles. If ProLine reports a trailing-30 rate and our monthly tile is MTD,
**write the trailing-30 number and say so in Notes.** The board will label the
tile from that note rather than imply a window the number does not have. A figure
quietly re-cut to fit a column is exactly the kind of thing nobody can audit
later.

If the three closers' rates and the company rate come from different reports or
different windows, say that too. Mismatched windows are fine as long as they are
stated.

---

## ASK 3 — blank the Close Rate goals

Separate from the above, and still outstanding from Sep 22.

The three `Close Rate - *` rows on **`L10 Scorecard`** and **`L10 History`**
carry `Goal = 0` with `GoalOp = >=`. The L10 page renders that honestly as
**`GOAL ≥ 0%`**, which reads as "the target is zero".

**Please write those `Goal` cells blank.** The page already handles a blank goal
correctly and prints **"no goal set"**, which is the true statement. Once ProLine
is reporting real rates and Jacob sets a target, put the real number there.

---

## What the board will do with this

The `Close Rates` tile is the first of the eight small cards now, directly under
the sales scoreboard. It is already built and waiting:

- **Company rate as the big number**, from `Close Rates`.
- **John · Anas · Henry underneath as three chips**, from the per-closer rows.
- Any of the four that is blank shows `—`. The tile works with one row, four
  rows, or none, and never implies a number it does not have.
- The Monthly/Weekly toggle flips all four together, because they are ordinary
  `KPI` Period rows.

Nothing else needs to change. No new tab, no whitelist, no deploy — the rows
appear and the tile fills in on the next refresh.

---

## Standing rules, unchanged

1. **Never invent, estimate, apportion or carry forward a number.** If ProLine
   does not report it, leave the cell blank.
2. **Blank renders `—`. A literal `0` renders `0`.**
3. **Timestamps carry their offset**, or the watchdog cannot measure staleness.
4. **Do not restructure the `KPI` tab.** These are four more rows in the shape it
   already has.
5. **The Morning Runway is not a sales source and is untouched by this.**

---

## How we will know it worked

```
curl -s https://talon-tv.netlify.app/api/health | jq '.tabs[] | select(.slot=="KPI")'
```

and the tile fills in on the wall within three minutes of the rows landing.

---

## While you are in the `KPI` tab

It was last written **2026-09-18**. As of today that is 17 days, so seven tiles
are showing September numbers under a "September MTD" label in October. The full
ask is in `docs/TALON_SALES_YTD_REQUEST.md` (ASK 3) — flagging it again here
because these close-rate rows land on the same tab, and a fresh close rate beside
a three-week-old cash figure is its own kind of misleading.
