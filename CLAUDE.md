# Read this first, every session

One page on purpose. `docs/` is 4,000+ lines and will not be read in full.
This is what must survive being forgotten.

---

## What this is

Every completed Skybird roof gets a real page on skybirdroofing.net, built
from curated CompanyCam photos, plus a referral layer so past customers can
share their project and earn a reward when it leads to a job.

## The North Star

> *"The map and the pages are scaffolding. The thing that makes money is a
> past customer sharing a link and a lead arriving with a code attached —
> build toward that and let the rest be good and in working order."*
> — Jacob, 2026-10-15

**The referral layer is the goal.** Everything else serves it.

Corrected 2026-10-15. This file first listed the map as #1 and the referral
as #3, on my reading of an earlier answer. That was wrong, and it is the
kind of wrong that points confident work in the wrong direction for weeks.

In service of it:

1. **Pages a customer is proud to share.** Note the bar: not "will Google
   rank this" but "would the homeowner post this with their name on it".
   Those are different pages, and the second one is harder.
2. **A single interactive map** — all areas, clickable pins, zoom and pan,
   leading to those pages. Usable at the sales table and on the site.
   (Supersedes `docs/03` §2's per-service-area widgets — confirmed
   2026-10-15.)
3. **Replacing the dead `/gallery/` page.**

## How to tell if we have drifted

Ask: *does today's work move a past customer closer to sharing a link that
a lead arrives through?*

If it doesn't, it had better be closing a hard-rule risk.

Four recorded drifts, all mine:

- **Wrote the North Star itself backwards** (2026-10-15), putting the map
  first and the referral third. Caught only because Jacob asked to go
  through this file rather than trusting it.

- Built checklist depth for two sessions while the map — named twice as the
  goal — had never been rendered.
- Optimised for *not breaking* over *shipping*. Nothing was published for six
  weeks after a correct draft existed.
- Stated figures confidently without checking (said 198 jobs covered; it was
  171) and recorded a decision nobody made ("Zebulon knowingly out").

**Nothing has been published yet.** Until that changes, it is the top item.

## Hard rules — never trade these for speed

- **No homeowner name, phone, email or street address** anywhere public.
  Including image filenames and alt text.
- **Photos carry PII in ways filenames don't.** A signed checklist, a permit,
  a form on a clipboard. One was published for 2 hours (`07` §16.1).
- **Photos carry GPS inside the file.** One was published 17.6 ft from the
  front door while the map pin sat a quarter mile away (`07` §16.9). The
  plugin strips Exif and XMP on upload — never disable it.
- **Nothing uploads before a human looks.** An attachment is public the moment
  it exists, whatever the post's status (`07` §17).
- **Map pins use stored offset coordinates**, redrawn per project. True
  coordinates are never written to WordPress.
- **`internal: true` photos never ship**, even if tagged `Showcase`.
- **No invented specifics.** No prices, no "free roof", no storm-chasing, no
  manufacturer or product named unless it is in the record.
- **No claim language on the page at all.** Not "hail", not "insurance claim",
  not the storm date — even when the job was a claim and the date is a fact.
  A page the homeowner shares announces it to their own friends, and their
  claim is their private financial business (`docs/13` §1).
- **Credentials live in the n8n credential store.** Never in this repo.

## Decisions that are closed — do not relitigate

| | |
|---|---|
| Buy vs build | **Build in-house.** `docs/handoff-buy-vs-build-decision.md` |
| Out-of-area towns | **Option A.** The page names the real town; the job is filed under the nearest hub. Never relabel a job's town |
| Warranty | **Read from the record, never derived from the package.** 26 Peace of Mind jobs, 4 Golden Pledge warranties |
| Manufacturer | **Never assumed.** An unrecognised shingle line names no manufacturer at all |
| Publishing pace | **No artificial staging.** Publish each page as soon as it is genuinely complete |
| Nothing publishes automatically | A human reviews every page |
| Storm / claim framing | **Off the page entirely.** `storm_date` is stored, private, never rendered — reversed 2026-10-15 |
| What a page must be | **`docs/13-page-definition.md`.** Its §5 gate is binding; the audience is the customer deciding whether to put their name on it |

## The guards that do not depend on remembering

```
php tests/test-plugin.php     # 368 assertions
node tests/test-workflow.js   #  36 assertions
```

Both must pass before any commit. They encode decisions, not just behaviour —
a change that quietly reverses one fails mechanically.

**When fixing a bug, break it again afterwards and watch the test fail.** That
step has caught a real defect in four consecutive pieces of work, including
twice when the test itself was wrong and passing for the wrong reason.

## Where things are

| | |
|---|---|
| Current state, next action | `docs/11-resume-here.md` (read the LAST section first) |
| Everything that went wrong and why | `docs/07-phase-4-preflight.md` |
| The workflow, node by node | `docs/10-n8n-workflow.md` |
| Per-project detail / notes path | `docs/12-project-notes-path.md` |

## Working style

Files over chat. Cite sources. Stop at gates and ask rather than running ahead
to more code because the plan looks obvious. Treat `docs/01`–`docs/06` as
ground truth unless something directly contradicts them — then flag it rather
than silently overriding.
