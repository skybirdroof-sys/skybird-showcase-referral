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

---

## Built 2026-10-28

Created as a **new template**, not a rewrite of v1. v1 has live instances on
#2561, and mutating a template that instances were made from is not
something to do to a system in use when a new one costs nothing.

**Template:** `Showcase Details v2` — `6468025a-e0f9-4eea-ace4-afa61c34f0aa`

| Field | Type | UUID |
|---|---|---|
| Tell me about something interesting that happened on this job | text | `c5e71d7d-c39d-48fe-8db2-5161b3866010` |
| What kind of house? | select-one | `cce64896-732f-408c-8641-b813ebc36857` |
| Days on site | select-one | `2a6c4912-76bc-4718-8de2-298a26d084b4` |
| What did we find once we opened it up? | select-multiple | `043d2d1c-071c-43e6-b5a9-672127d4460e` |
| What did we fix beyond a standard roof? | select-multiple | `01de1281-887e-4ac4-a907-f376ac11783b` |

All five are optional, matching v1. A required field on a form filled at the
end of a long day produces a tapped answer, not a true one — and the story
box is the one field where a junk answer is worse than a blank.

### Left for Jacob

1. **Retire v1** (`b6cd2ffd-0d35-4cd3-b2c2-708d49926adf`) once v2 has been
   used once in anger, and rename v2 to "Showcase Details". Two templates
   with near-identical names is a worse trap than either one alone.
2. **Delete the empty duplicate instance** on #2561
   (`b58ea020-529c-45cb-8e60-277be7e3ea63`, created 2026-09-29, never
   filled). The completed one is `63794641-2401-4a43-b357-ec2115484f68`.
3. **Not instantiated on #2601.** Deliberate — his nine captions already
   carry what it would collect. v2 starts with the next job.
