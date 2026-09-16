# 08 — Message to Euan: the four items that are actually his

Skybird Project Showcase + Referral System · Phase 4
Draft for Jacob to send. Not sent yet.

---

## Why this is four items and not eleven

`01-api-audit.md` §2.2 lists seven open WordPress questions and labels them all "decisions that depend on Euan." Five of them aren't — theme, page builder, ACF, SEO plugin, security plugin, REST reachability and the `/projects/` slug collision are all facts readable from the public site without credentials (`07-phase-4-preflight.md` §4.1). Asking him for those spends his attention on things a URL fetch answers for free, which is the mistake `03-structure-signoff.md` §5 explicitly avoided last time.

That leaves two from §2.2, plus two carried forward from earlier docs that were never sent:

| # | Item | Source |
|---|---|---|
| 1 | Staging site + a sync user | `01-api-audit.md` §2.2; `06-trigger-design.md` §5 |
| 2 | Who owns the `skybird-projects` plugin | `01-api-audit.md` §2.2 |
| 3 | Pin precision — the last genuinely open item | `03-structure-signoff.md` §4–5, `04-pin-precision-research.md` |
| 4 | The reference model, as an FYI | `handoff-buy-vs-build-decision.md` §Open items |

One message, four items. Items 3 and 4 are nearly free to answer and have been waiting since 9/14.

---

## Draft

> **Subject: Project showcase build — four things before we touch the site**
>
> Hi Euan,
>
> We're starting the build on the project showcase pages — the structure you signed off on (flat `/projects/{slug}/` URLs, strong internal linking to and from each service-area page, a map widget per area). First real milestone is one CompanyCam project turned into one WordPress **draft**. Nothing publishes automatically; there's a manual review checklist before anything goes live, which I think matches what you asked for.
>
> Four things where we need you:
>
> **1. Is there a staging site, and can we get access?**
> We'd rather prove this end to end somewhere that isn't production. Is there a staging environment for skybirdroofing.net that mirrors production closely enough to test a new custom post type and REST API writes against?
>
> Either way, we'll need a dedicated WordPress user — something like `skybird-sync`, **Editor** role, with an Application Password. Editor is deliberate: it can create drafts and upload media, but can't publish other people's posts or install plugins. If you'd rather scope it tighter, tell us what you're comfortable with and we'll work within it.
>
> **2. Who should own the small plugin that registers the project post type?**
> The custom post type, the service-area taxonomy and the custom fields need to live in a small plugin rather than the theme, so a theme update can't delete them. You mentioned you might want to own that — genuinely fine either way.
>
> Our preference is that we own it: it's versioned in our repo, you get it as a reviewable artifact, and you keep the decision about installing and activating it on your infrastructure. The reason is just iteration speed — every field we add in later phases becomes a ticket on your queue otherwise. But if you'd rather own it, say so and we'll write it to your conventions and hand it over.
>
> **3. Map pin precision — the one question still open from September.**
> Project pages never show the homeowner's name or street address. But the map widget needs a pin, and an exact pin is effectively the address.
>
> Our recommendation: offset each pin by a random distance and direction within about 0.2–0.3 miles of the true location, generated once when the project is created and then stored permanently, so the pin never moves between page loads. Close enough to read as "the right neighborhood," not close enough to point at the house. This is roughly what Airbnb does, scaled down — their threat model is higher than ours because their listings pair the fuzzy location with a host's name, and our pages give a reader nothing to search with.
>
> Happy with that radius, or do you want it tighter or looser?
>
> **4. FYI — the target, for reference.**
> `mrroofing.net/past-projects/project/{id}/` is close to what we're aiming at: indexed project pages, back-to-map link, prev/next, share buttons, neighboring projects. Same structure you described. Worth a look if you want to sanity-check where this is heading.
>
> Thanks,
> Jacob

---

## Notes for Jacob before sending

- **Don't send the §4.1 list.** If the network allowlist goes through, we answer those five ourselves in about two minutes and Euan never needs to see them.
- **Item 2 is a real fork, not a formality.** If Pitch Peak takes the plugin, `05-data-model.md` §1's meta fields become an agency dependency for Phases 4, 5 and 6. Worth a five-minute call rather than email ping-pong if his answer is ambiguous.
- **Item 3's radius is not load-bearing.** `04-pin-precision-research.md` §4 treats it as settled and notes it's a Skybird-side data-handling decision, not something needing his sign-off. It's in here because it's cheap to ask and he was flagged as the owner — if he doesn't answer, build 0.25 miles and move on.
- **The `-nc` suffix question** from `03-structure-signoff.md` §4 is deliberately **not** in this message. Fetching `/service-areas/franklinton/` and `/service-areas/franklinton-nc/` and comparing settles it without asking — it goes in the §4.1 pass.
- **Nothing here mentions the vendor.** The build-vs-buy decision is closed (`handoff-buy-vs-build-decision.md`) and Euan was never part of it. Item 4 is framed as a reference site, which is what it is.
