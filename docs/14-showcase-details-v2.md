# 14 — Showcase Details, version 2

Proposed. Not built — the template is live in Jacob's CompanyCam and
rewriting it is his call, not something to do unasked.

Jacob, 2026-10-28: *"Just ask the salesman to talk a little bit about
something interesting that happened on the job, and then a couple other
details that the production HQ doesn't ask for."*

**Thirteen questions become five.**

---

## Why it shrinks this far

Three things changed since v1 was written on 2026-10-02.

**1. The captions now carry the job detail.** v1 asked *"anything to add
about what you found?"*, *"…what you fixed?"*, *"what made it harder?"* —
three free-text boxes. On #2601 Jacob wrote nine photo captions by hand and
they already contain the plywood repair and how long it took, ice-and-water
on a sub-4/12 pitch, the Cobra vent, the F8 drip edge, the California cut.
Asking a second time, in a form, for what someone has already written under
the photograph is work for its own sake.

**2. Production HQ is the record for the specs.** Manufacturer, shingle
line, colour, warranty, package and town all live there for 201 jobs, and
`CLAUDE.md` makes it the authority. v1 asked for colour and package anyway.
Colour goes; package goes — it is internal-only, and v1's option label
("Essentials — GAF Timberline HDZ, Silver Pledge") bundles a warranty into
a package name, which is the exact derivation `CLAUDE.md` forbids.

**3. The claim rule arrived on 2026-10-15,** after v1 was written and
filled. v1's *"Why did they call us?"* offers **"Storm damage or insurance
claim"** as a tappable option, and on #2561 that is what was tapped.

> **Deleting that question is the cleanest fix available.** A banned-phrase
> scan catches the words on the page; it cannot stop a form from collecting
> an answer that must then be discarded. The reason a homeowner called is
> rarely publishable anyway, and where it is, the story question covers it.

---

## The five questions

**Description** (shown at the top of the checklist):

> Answer on the last day of the job, on any project you're tagging Website
> Showcase. These answers become the project's page on skybirdroofing.net.
> Only the first box needs typing — the mic key works, just talk.
>
> Never write the homeowner's name, address, phone or email.
> **Never mention hail, storms, insurance or a claim** — even when the job
> was one. None of it can be published.

### 1 · Tell me about something interesting that happened on this job
*Free text. The mic key works — just talk.*

The anchor, and the only one that needs typing. One or two lines. Anything
the crew worked around, anything unusual about the house, anything that
would make a neighbour say "huh". If nothing stands out, say so and move on.

### 2 · What kind of house?
*Select one.* One storey · Two storey · Split level · Other

Not in Production HQ. Lets the page describe the roof accurately instead of
generically.

### 3 · Days on site
*Select one.* 1 · 2 · 3 · 4 or more

Not in Production HQ. Tapped rather than derived from photo timestamps,
which record when someone held up a camera, not when the crew worked.

### 4 · What did we find once we opened it up?
*Select any.* Rotten decking · Old layers to remove · Failed flashing ·
Poor ventilation · Nothing unexpected

Not in Production HQ, and the thing nobody could see from the ground — the
detail that makes one page unlike the other two hundred.

### 5 · What did we fix beyond a standard roof?
*Select any.* Decking replaced · New ventilation · Chimney flashing ·
Skylight · Copper or metal accents · Gutters · Nothing beyond standard

Only the work worth pointing at. Everything standard to a Skybird roof is on
every page already.

---

## Dropped from v1, and why

| Question | Why it goes |
|---|---|
| Why did they call us? | The claim-language source. Rarely publishable |
| Which package did they get? | Production HQ holds it; and its option labels derive a warranty from a package |
| What colour shingle? | Production HQ holds it |
| What made this one harder? + free text | Folds into question 1 |
| Anything to add about what you found? | Folds into question 1 |
| Anything to add about what you fixed? | Folds into question 1 |
| What would you tell a neighbour? | Overlaps question 1, and on #2561 it produced "Approved through insurance" |
| What did we do? | Every one of these is a full roof replacement |

---

## Two things to fix in the instance, not the template

1. **#2561 carries two instances** — one completed 2026-10-02, one created
   2026-09-29 and never filled. Anything reading checklists must select the
   completed instance, not the first returned. Worth deleting the empty one.
2. The read is through the **MCP server**, which n8n cannot call in the
   current setup. The checklist read stays manual for the first pages.
   Whether n8n's MCP client node can do it is worth testing — after a page
   is live, not before.
