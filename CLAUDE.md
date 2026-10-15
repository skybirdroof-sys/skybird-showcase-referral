# Read this first, every session

One page on purpose. `docs/` is 4,000+ lines and will not be read in full.
This is what must survive being forgotten.

---

## What this is

Every completed Skybird roof gets a real page on skybirdroofing.net, built
from curated CompanyCam photos, plus a referral layer so past customers can
share their project and earn a reward when it leads to a job.

## The North Star

> *"Option 4 at a large scale — a working map on my website that leads to
> pages that have been fully optimized for SEO purposes."* — Jacob, 2026-10-14

Unpacked, in the order he gave it:

1. **A working, interactive map** — on the website and usable at the sales
   table. Proof of where Skybird has worked. He has named this more than
   anything else.
2. **Pages worth landing on** — real detail, not one sentence with the town
   swapped.
3. **The referral layer working at scale** — a share traced to a lead.
4. **Replacing the dead `/gallery/` page.**

## How to tell if we have drifted

Ask: *does today's work get a page published, or a pin on the map?*

If it doesn't, it had better be closing a hard-rule risk. Three recorded
drifts, all mine:

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

## The guards that do not depend on remembering

```
php tests/test-plugin.php     # 232 assertions
node tests/test-workflow.js   #  35 assertions
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
