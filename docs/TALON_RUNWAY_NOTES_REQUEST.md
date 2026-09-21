# For Talon — Morning Runway: comment loss and notes reattachment

The three KPI freshness items are shipped and verified against the live Sheet:
Top Five blanked correctly (Margaret's 09:10 bump kept, five seats now reading
`—` rather than Friday's scores), Rest Index rebuilt to 5.2 with per-person
8.2 / 5.8 / 3.5 / 3.1, `run_log` carrying three rows. The wall is telling the
truth about what has been scored today. Thank you.

This is the one risk left, it has nothing to do with the TV, and it is about a
person rather than a dashboard.

---

## Before tomorrow's 8:30 rebuild

The rebuild runs again tomorrow morning and will delete another day of
Margaret's annotations. Two things should happen today, ahead of any fix and
ahead of any of the questions below.

**1. Tell her today.** She should hear before tonight that cell comments do not
survive the overnight rebuild, so she does not put anything she needs into one
between now and the fix. If she has been losing annotations without knowing
why, she has been quietly absorbing a defect that was never hers. That
conversation is owed today, not when the fix ships.

**2. Protect tomorrow's run.** Either snapshot her comments before the replace
and restore them after, or skip the replace tomorrow and write only the clock
column. If neither is possible by 8:30, say so and Jacob can decide whether the
rebuild runs at all tomorrow. A day of stale clocks costs her far less than a
day of deleted notes.

Nothing below is urgent by comparison. These two are.

---

## What you told us

> Import Replace rebuilds clock fills + owner dropdown from xlsx; **cell
> comments not in xlsx → lost on Replace.**

> Pass1 name+stage, Pass2 name-only if unique open card. Duplicate-name edge can
> miss. **Mon rebuild: reattached 65 / 111 open.**

So every weekday, the rebuild deletes Margaret's cell comments, and some
fraction of her Notes / Current-step owner / Payment plan due does not come
back. This runs unattended against the sheet she uses to brief the outside
salesmen each morning.

## Question 1 — how much was actually lost?

**Of the 46 open cards that did not reattach on Mon Sep 21, how many had
content** in Notes, Current-step owner, or Payment plan due before the replace?

`65 / 111` does not distinguish "46 people's notes were destroyed" from "46
cards had nothing to carry". Those are very different mornings for Margaret,
and every further decision here depends on which one it is. If the pre-wipe
snapshot is still on disk, this is a count, not an investigation.

## Question 2 — notes or comments?

Google Sheets has two different things and the fix differs completely:

- **Notes** (right-click → Insert note, the little corner triangle) are cell
  properties. A script can read them all before the replace and write them back
  after. Recoverable, straightforwardly.
- **Comments** (the threaded discussion kind, with replies and resolve) are not
  cell properties at all — they live at the Drive layer and anchor to a
  position. After a whole-file replace there is often nothing valid to re-anchor
  to. Much harder, sometimes impossible.

**Which is Margaret actually using?** If it is comments, that changes the answer
from "snapshot and restore" to "stop replacing the file".

## What we would like, in order

1. **Stop deleting her comments.** Whatever the mechanism, the weekday rebuild
   must not destroy annotations a human wrote. If that means the snapshot has to
   cover comments as well as the three columns, do that; if comments can't be
   restored after a replace, then the replace itself has to go.
2. **Move off Import → Replace.** This was raised on Sep 18 and the honest
   answer was "fair goal; not current reality". It is the root cause of every
   symptom here: writing values into designated ranges preserves comments,
   notes, formatting, filters and frozen panes for free, and removes the whole
   class of reattachment bug rather than improving its hit rate.
3. **Key reattachment on stable project identity**, not name + stage. A ProLine
   project id if one exists. Name + stage was always going to miss the cards
   that moved overnight, which are the cards she most needs.
4. **Report the count every run** in `run_log`: carried vs orphaned, and how
   many orphans had content. Then question 1 answers itself every morning
   instead of being archaeology.

## Two things that are not code

- **How long has the replace been running?** That is how long this has been
  happening, and it sizes what she has already absorbed.
- **If she has already worked around this** — stopped using comments because
  they kept vanishing — that is a workaround she built around our defect. It
  still gets fixed, and she should get the feature back, not keep the habit.

## Whose call the fix is

Margaret's, on anything she can see. Restoring her annotations after a replace
is invisible to her and needs nobody's permission. Changing where she puts
notes, adding a column, asking her to work differently — that needs her yes
first, and "it would be easier for the rebuild" is not a reason she has to
accept. Ask her what would make the morning easier while you are in there;
do not design it for her.

## Interim, until the root fix ships

Keep the pre-rebuild snapshot in Drive with 30 days of history, so a bad morning
is recoverable rather than reconstructed from memory.

---

Challenge any of this. Nothing here ships without Jacob's greenlight — these are
two questions and a proposed order of work. If the 46 turn out to have been
blank, say so and this drops to a much smaller item.
