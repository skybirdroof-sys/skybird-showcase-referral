# 12 — Project notes: where the unique detail comes from

Skybird Project Showcase + Referral System · Phase 4/5 boundary
Raised by Jacob, 2026-09-28. **Built 2026-09-29** — §4 is live; §7's open
questions stand.

---

## 1. The problem, in his words

> *"If we're just creating pages and they all look the same, they all have the
> same jargon, and there are no specifics to it, I feel like Google's algorithm
> will not take kindly to it."*

He is right, and the current draft proves it. Every page this pipeline
produces today is:

> *Roof Replacement in {Town}, NC*
> *Skybird Roofing completed a full roof replacement in {Town}, North Carolina.*

Eight service areas of that, differing only in a town name, is the shape search
engines classify as doorway pages — pages built to catch a town query rather
than to tell a reader anything. Scale is the aggravating factor, and scale is
the entire point of this system. Forty projects of the same sentence is worse
than four.

`docs/06-trigger-design.md` §3 already requires *"2–4 sentences, first sentence
carries the who/town/job"* at the review gate. Nothing feeds that. The
reviewer is asked to write specifics they do not have, from a draft that
contains none, about a job they may not have been on.

The examples Jacob gave are exactly the right kind of material:

- wasps in the soffit the crew had to deal with first
- the homeowner kept them in sweet tea all afternoon
- more rotten decking underneath than the quote allowed for
- a tricky valley on the back elevation that needed flashing done properly

None of that is on a photo. All of it is in somebody's head at 4pm and gone by
Friday.

---

## 2. Where it can be captured

Checked live against project `110848078`, 2026-09-28.

| Surface | Readable via API? | State | Verdict |
|---|---|---|---|
| **Project Description** | ✅ `GET /v2/projects/{id}` → `description` | `null` | **This is the one.** 10,000 chars of free text, already inside the object `Get Project` fetches |
| Photo `description` | ✅ on each photo object | `null` on all four Showcase photos | Second prize, and cheap — see §6 |
| Project comments | ✅ `GET /projects/{id}/comments` | empty | Threaded discussion, not a summary. Wrong shape |
| Custom fields | ❌ **"This feature is not enabled for this company"** | — | Structured capture would need a plan change |
| Advanced checklists | ✅ | none on this project | The Landing is on paper (§16.1). Digital would be structured capture — see §7 |

**Project Description costs no new integration.** In the CompanyCam app it is
the "Project Description" box; in the API it is `description`, and older API
vocabulary calls it the notepad. It is already in the payload. The only thing
missing is somebody typing in it.

---

## 3. The hazard, stated plainly

Free-text job notes will contain the homeowner's name. Constantly. *"Bill made
us sweet tea"* is how a human writes that sentence, and no amount of asking
nicely changes it.

So a path that reads notes and generates public copy from them is ingesting a
field that **reliably** contains PII and then depending on a scrubber to catch
it. This repo already rejected that pattern once, for alt text
(`docs/07-phase-4-preflight.md` §2.4.1): a filter over generated prose is a
control that fails silently, where one unusual phrasing ships a name and
nothing errors.

It is more true here than it was there, for three reasons:

1. **Volume.** Alt text is a short generated sentence. Notes are up to 10,000
   characters of unstructured human writing per project.
2. **Names are the *point* of the interesting sentences.** The good detail and
   the PII arrive in the same clause.
3. **The gate has already been shown to be imperfect.** On 2026-09-28 a
   photograph of a signed checklist carrying the homeowner's name and street
   address went to a public URL because nobody looked at the pictures
   (`07` §16). A gate is only as good as the attention paid at it, and adding
   a wall of free text to review does not increase that attention.

There is a second hazard with nothing to do with privacy. An LLM handed three
bullet points will embellish:

> *"more plywood than expected"* → *"extensive structural damage we caught
> before it became a costly problem"*

That is invented, and `docs/06` §3's locked copy rules forbid invented
specifics. Sparse input plus fluent output is how a page ends up making claims
nobody can stand behind.

---

## 4. Proposal: the notes reach the reviewer, not the page

**`Curate` reads `description` and stores it in a meta field that never
renders on the front end.**

| | |
|---|---|
| Meta key | `field_notes` |
| Registered | `show_in_rest => true`, so n8n can write it |
| Rendered | **never** — no template reads it, and a test asserts that |
| Visible | ACF *Project details* → new **Job** tab, above `completion_date` |
| Label | "Field notes (not published)" |

The reviewer opens the draft and has the wasps, the tea and the decking in
front of them. They write the three sentences.

That is roughly ninety seconds per project, and it is the ninety seconds that
makes the page worth having. It is also where a human decides that *"the
homeowner kept the crew in sweet tea"* is charming and *"we found more rot than
we quoted for"* reads as a surprise upcharge rather than as thoroughness —
a judgement no filter makes.

### Why not generate the paragraph automatically

Both hazards in §3 apply at full strength, and the payoff is ninety seconds.

**The order matters more than the verdict.** Ship the raw-notes path first and
read six months of real notes. Then decide. Deciding now means designing a
generator against imagined input — which is how the ISO-vs-epoch fixture
certified a bug while reporting green (`07` §16.7).

When it is time, the shape is: generate a **suggested** paragraph into a
*second* reviewer-only field, clearly labelled as unreviewed, alongside the raw
notes, which the human always rewrites. Never straight into `content`. The
human is editing a suggestion, not approving a publication.

---

## 5. A blank box gets nothing typed in it

The weakest link is not the pipeline. It is whether a project manager at the
end of a long day types anything at all. A field labelled "Project Description"
next to a hundred photos will stay `null` forever.

Give them four prompts to answer rather than a box to fill:

```
What was unusual about this job?
What did we find once we opened it up?
What did the crew do that took extra care?
Anything about the house or the street worth knowing?
```

Two benefits. Prompted writing produces usable specifics where a blank box
produces nothing. And prompts about the *job* steer away from names in a way
"type anything" does not — which reduces the PII in the input rather than
filtering it out of the output. That is the better place to fix it.

Worth asking whoever runs production whether this belongs on The Landing
checklist itself, since that is already the moment someone is standing at the
finished job writing things down.

---

## 6. The cheap win: photo descriptions

Every Showcase photo's `description` is `null` (`07` §2.4). That is why alt
text has nothing real to work from and falls back to a generated sentence built
from product fields that are themselves empty until ProLine exists.

One line per photo from whoever is already tagging them fixes captions and alt
text together, and it is the smallest possible ask — four photos, four
sentences, at the moment they are choosing which four to tag.

Same PII rule: describe the roof, not the household.

---

## 7. Open questions

1. **Does this belong in Phase 4 or Phase 5?** It is not required for
   *one real project → one real draft*. It is required before the fortieth.
2. **Who writes the final copy** — the PM who was there, or one reviewer for
   all eight areas? Different answers change where the notes need to surface.
3. **Are advanced checklists available on the current plan?** If so, a digital
   Landing checklist gives structured capture *and* replaces the paper form
   that caused the §16 leak. Two problems, one change.
4. **Does `description` survive a project being archived?** Untested.

---

## 8. What is decided here, and what is not

**Decided:** notes will not be generated into published copy without a human
rewriting them, and the capture field is CompanyCam's Project Description.

**Not decided:** everything in §7.

---

## 9. Built, 2026-09-29

`Curate` reads `project.description`, `Build Payload` writes it to
`meta.field_notes`, and the reviewer reads it in a read-only textarea on the
ACF **Job** tab, labelled *"Field notes from CompanyCam (not published)"*.

### The part that needed care

Every meta field in this plugin is registered `show_in_rest`, because n8n has
to write them. **Read access rides along with the post.** The moment a project
is published, `GET /wp-json/wp/v2/projects/{id}` hands its entire `meta` object
to anyone who asks — so a `field_notes` reading *"Bill made the crew sweet
tea"* would be world-readable while appearing nowhere on the page.

That is §16.3's lesson arriving a second time. *Invisible* is not
*unreachable*, and this project has already published a homeowner's address by
assuming otherwise.

So `field_notes` carries a `private` flag, and `includes/rest.php` strips every
private field from the REST response for anyone who cannot `edit_post` on that
specific post. Written over REST by the automation; readable over REST only by
someone who could open it in wp-admin anyway. Capability, not role — a
contributor who cannot edit a published project cannot read its notes either.

The field is also read-only in the form. It is a snapshot of CompanyCam at the
moment the draft was built, and editing it in WordPress would change nothing at
the other end.

### What the tests hold down

Thirteen new assertions, and every one is containment rather than feature:

| | |
|---|---|
| `field_notes` is marked private | and is the **only** private field, so a second one cannot be added without its own tests |
| A visitor cannot read it over REST | and no trace of it survives anywhere in the public response |
| An editor can | capability check, on that post |
| No template prints it | matched against comment-stripped source |
| Markup is stripped, length capped at 10,000 | CompanyCam accepts basic HTML |
| The notes never reach title, body or excerpt | see below |

Verified by breaking each one: removing the REST strip fails 2, dropping the
`private` flag fails 4, printing the notes in the template fails 1.

### Two fixture traps, both caught

**The fixture didn't name anyone.** The notes fixture said *"Alan kept the crew
in sweet tea"* while the PII list checked for *"Wexler"* — so the containment
assertion passed without exercising anything. Same failure as the ISO-vs-epoch
fixture in `07` §16.7. There is now an explicit assertion that **the fixture's
notes contain PII**, so the test above cannot pass by accident.

**A PII check was not enough.** Leaking the notes into a 120-character excerpt
passed cleanly, because the clip ended before the homeowner's name. It still
published *"more rotten decking than the quote allowed for"* — internal
information, no name required. The check is now that **no 24-character run of
the notes may appear in the title, body or excerpt**, name or no name.

Both were found by reintroducing the bug on purpose. Neither would have been
found by reading the code.
