# Two findings on the shipped KPI Board — 2026-09-17

Read from the live Sheet at `2026-09-17T19:16:12-04:00`, after link-view sharing
went on. Board side needs no changes for either of these; both are upstream.

The good news first: **the ship parses cleanly.** Every per-person Rest Index
figure reconciles exactly against `runway_flat` with blank clocks excluded, the
ISO stamps order and reformat correctly (`Thu Sep 17 · 7:16 PM ET`), `Meta`
drives the period label, the `Key | Value` summary block reads as intended, and
the `Rule | blank clocks excluded from average` row is ignored rather than drawn
as a person chip. `Rest Index | 4` renders as `4.0`. Nothing to fix there.

---

## Finding A — Five people are at 0%, and the 5-day average equals today exactly

`Daily Top-Five Progress` as published:

```
Person    Today %   ~5-day avg   Updated ET
Margaret     0          0        2026-09-17T16:10:00-04:00
Travis      20         20        2026-09-17T16:10:00-04:00
John         0          0        2026-09-17T16:10:00-04:00
Henry        0          0        2026-09-17T16:10:00-04:00
Anas         0          0        2026-09-17T16:10:00-04:00
Jacob        0          0        2026-09-17T16:10:00-04:00
```

These are **literal zeros, not blanks** — confirmed by contrast: the `KPI`
Values in the same read come back genuinely empty, so the reader distinguishes
the two correctly. Per the agreed contract the board therefore renders `0%`, not
`—`, for five of six people.

**A1. Are those scored zeros or placeholder zeros?**
If the 4 PM pass confirmed no completed items, `0%` is honest and should stay.
If it found no Slack/ProLine evidence and defaulted to zero, that is a
placeholder and **must be written blank instead** — blank ≠ 0 is the one rule
the whole display contract rests on. The board cannot tell them apart, and on a
1080p wall in the office `0%` beside a person's name reads as a statement about
their day.

**A2. Did the ~5-day history survive the hygiene pass?**
`~5-day avg` is identical to `Today %` for all six people. A five-weekday mean
matching today exactly, six times over, is what a one-day window looks like.
Please confirm the average is still computed over the last up-to-5 weekday
scores including today, and that prior days' scores weren't cleared when the
tab was rewritten.

---

## Finding B — The company hero number doesn't match the agreed rule

Per-person averages all check out against `runway_flat`:

```
Jacob  37 rows, 0 blank   avg 6.7297 -> 6.7   published 6.7  OK
John   25 rows, 3 blank   avg 4.2273 -> 4.2   published 4.2  OK
Anas   34 rows, 7 blank   avg 2.8148 -> 2.8   published 2.8  OK
Henry  21 rows, 3 blank   avg 2.5000 -> 2.5   published 2.5  OK
```

The company figure does not. Three candidate definitions against the same data
(463 total days; 104 projects with a clock; 117 projects in total; 13 blank):

| Definition | Value | Rounded |
|---|---|---|
| Mean of the four owner averages — **the agreed rule** | 4.0680 | **4.1** |
| Pooled, blank clocks excluded | 4.4519 | 4.5 |
| Pooled, blanks counted in the denominator | 3.9573 | **4** ← what shipped |

The published `4` matches dividing by all 117 projects, including the 13 with no
clock. That is the blank-clock-as-zero bias removed at the person level
reappearing at the company level — and it contradicts
`blank_clock_rule = exclude_from_average` as stated on that tab and in `Meta`.

Direction matters more than magnitude here: ~0.1 of a day, but it moves a
lower-is-better metric in the flattering direction, and it does so exactly when
data is missing.

**B1.** Which rule does the hero use? If it is pooled-including-blanks, either
switch it to the mean of the four owner averages (4.1 on today's data) or change
the stated rule so the tab describes what the number actually is.

**Caveat on my figures:** they are computed from `runway_flat` as published. If
the hero was computed from live Morning Runway clocks rather than from that tab,
the inputs may differ slightly — but the exact match to 3.9573 is hard to
account for otherwise. Worth a look either way, and if `runway_flat` and the
hero come from different reads, that is itself worth knowing.

---

## Minor

- **Duplicate row:** `Jacob | Jacob Vollmer | 8 | appt set` appears twice in
  `runway_flat`. Two genuine jobs with the same name, or a dedupe miss? It does
  not change his 6.7 either way, but it makes his project count 37 instead of 36.
- **`Project count` and the average use different denominators.** The count is
  all projects; the average uses only those with a clock (John: 25 shown, 22
  used). Nothing on the TV displays project count today, so this is cosmetic —
  but anyone reconciling the tab by hand will hit it. Either relabel, or add a
  second column for the scored count.

---

## Board side

No changes needed for any of the above. The board will show whatever the Sheet
says, which is the point: `0` renders as `0%`, blank renders as `—`, and the
hero renders whatever `Rest Index` holds, to one decimal. If A1 turns out to be
placeholder zeros, the fix is a write-path change on your side and the wall
corrects itself on the next refresh.

---

Challenge anything here. Do not change anything until Jacob greenlights it —
these are questions and a proposed correction, not a ship order. If you think my
arithmetic or my reading of `runway_flat` is wrong, say so and show the numbers
you are working from.
