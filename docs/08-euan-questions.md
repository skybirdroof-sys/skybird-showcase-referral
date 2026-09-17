# 08 — Message to Euan

Skybird Project Showcase + Referral System · Phase 4
**Status: SENT 2026-09-17 13:19 UTC**, as a reply in the 9/14–9/15 sign-off thread (`Skybird*** Project Showcase site structure — need your sign-off before we build`). To: euan@pitchpeakmarketing.com (Euan Swan, Pitch Peak Marketing).

This file mirrors the message verbatim so the repo and what actually went out do not diverge.

> **Send defect, 2026-09-17 — corrected resend sent 13:23 UTC, verified clean.**
> The message was sent with an HTML body that had been HTML-escaped before submission, so the markup was delivered as literal visible text (`<div style="...">`, `<p>Hi Euan,</p>`) rather than rendered formatting, and the plain-text alternative was dropped rather than used as the fallback. The reference-site link was also rewritten into unusable nested-markdown form.
> Content and recipient were correct; only the rendering was broken. A plain-text-only resend went out in the same thread at 13:23 UTC with a one-line apology at the top, and was verified clean before being reported as fixed. The thread now holds four messages: Jacob's original, Euan's Option B reply, the malformed send, and the readable correction.
> **Lesson for any future send from this project: pass `body` only, plain text.** The HTML path added no value here — the message is a list of questions — and introduced the one failure mode that reached an external partner.

---

## What's in it, and why

An earlier version of this draft deliberately held back five of the seven `01-api-audit.md` §2.2 items on the grounds that they were readable from the public site, and that asking Euan would spend his attention on things a URL fetch answers for free.

**Reversed 2026-09-17 (Jacob): include them.** Two reasons, and the second is the stronger one:

1. **We cannot currently answer them.** `skybirdroofing.net` is blocked by this environment's network egress policy (`07-phase-4-preflight.md` §3). The allowlist fix needs a new session to take effect. Holding the questions back to answer them ourselves, then going back to Euan with whatever is left, adds a round trip for no gain.
2. **He gives a better answer than a fetch does for most of them.** This is the part worth keeping in mind for future escalations — "can I look it up?" is not the same question as "is looking it up as good?":

| Item | What a public fetch gives | What Euan gives |
|---|---|---|
| ACF | `acf/v3` in `namespaces[]` — that ACF is active | **Whether it is ACF Pro.** Gallery and Repeater are Pro-only (`01-api-audit.md` §2.1), so this changes what we build |
| Security plugin | Whether *anonymous* REST access happens to work | The actual config — whether Application Passwords or authenticated REST are restricted, which is what we'll hit |
| Theme / builder | Directory names in the HTML | The real answer, including anything the markup doesn't reveal |
| SEO plugin | The REST namespace | Same answer, no ambiguity |
| `/projects/` collision | 404 or not | Same answer, plus whether anything is planned for that path |

So the message now carries all four originally-his items **plus** a short "quick ones" block. The quick block is framed for one-line answers and placed after the substantive asks so it does not compete with them.

The `-nc` suffix question (`03-structure-signoff.md` §4) is now in that block too. It was previously excluded as self-answerable by comparing the two URLs — same reasoning as above applies, and he knows whether one is a redirect or simply stale.

---

## The draft, as it sits in Gmail

**To:** euan@pitchpeakmarketing.com
**Subject:** Project showcase build — a few things we need from you

> Hi Euan,
>
> Following on from your Option B sign-off last week — we're starting the build on the project showcase pages. Flat `/projects/{slug}/` URLs, each project linked to and from its service-area page, and a map widget per service area.
>
> First milestone is one CompanyCam project turned into one WordPress **draft**. Nothing publishes automatically — there's a manual review checklist before anything goes live, which should match the "more automated with checks" process you described.
>
> A few things where we need you:
>
> **1. Is there a staging site, and can we get access?**
> We'd rather prove this end to end somewhere that isn't production. Is there a staging environment that mirrors production closely enough to test a new custom post type and REST writes against?
>
> Either way we'll need a dedicated WordPress user — something like `skybird-sync`, **Editor** role, with an Application Password. Editor is deliberate: it can create drafts and upload media, but can't publish other people's posts or install plugins. If you'd rather scope it tighter, tell us what you're comfortable with and we'll work within it.
>
> **2. Who should own the small plugin that registers the project post type?**
> The post type, service-area taxonomy and custom fields need to live in a plugin rather than the theme, so a theme update can't delete them. You mentioned you might want to own that — genuinely fine either way.
>
> Our preference is that we own it: versioned in our repo, delivered to you as a reviewable artifact, and you keep the decision about installing and activating it. The reason is iteration speed — otherwise every field we add in later phases becomes a ticket on your queue. But if you'd rather own it, say so and we'll write it to your conventions and hand it over.
>
> **3. Map pin precision — the one question still open from September**
> Project pages never show the homeowner's name or address. But the map needs a pin, and an exact pin is effectively the address.
>
> Our recommendation: offset each pin randomly within about 0.2–0.3 miles of the true location, generated once and stored, so it never moves between page loads. Close enough to read as the right neighbourhood, not close enough to point at the house. Roughly what Airbnb does, scaled down.
>
> Happy with that radius, or do you want it tighter?
>
> **4. Quick site questions — one-line answers are fine**
> We could work some of these out from the public site, but you'll have a better and faster answer for most of them:
>
> - Which theme and page builder is the site on — Elementor, Bricks, Divi, or the block editor?
> - Is ACF installed, and is it Pro? (Pro matters — its Gallery and Repeater field types fit this exactly and would save us building equivalents by hand.)
> - Which SEO plugin — Yoast or Rank Math? That's where the SEO title, meta description and schema would get written.
> - Any security plugin (Wordfence, iThemes, etc.) that restricts the REST API or Application Passwords? It's the usual cause of 401s, and worth knowing before we start rather than after.
> - Is `/projects/` free as a URL path, or is there already a page sitting there?
> - Service-area URLs: the top nav links to `/service-areas/franklinton-nc/` but the footer links to `/service-areas/franklinton/`. Which is canonical — is one a redirect, or is one stale?
>
> **5. FYI — the target, for reference**
> [mrroofing.net/past-projects/project/{id}/](https://mrroofing.net/past-projects/) is close to what we're aiming at: indexed project pages, back-to-map link, prev/next, share buttons. Same structure you described. Worth a look if you want to sanity-check where this is heading.
>
> Thanks,
> Jacob

---

## Notes for Jacob

- **It is a new email, not a reply** to the Option B sign-off thread (`Skybird*** Project Showcase site structure — need your sign-off before we build`, 2026-09-14/15). A fresh subject makes the asks actionable; the opening line carries the continuity. Easy to change to an in-thread reply if you'd rather Euan have the history right there.
- **Item 2 is a real fork, not a formality.** If Pitch Peak takes the plugin, the meta fields in `05-data-model.md` §1 become an agency dependency for Phases 4, 5 and 6. If his answer is ambiguous, it is worth five minutes on a call rather than email ping-pong.
- **Item 3 is not load-bearing.** `04-pin-precision-research.md` §4 treats it as settled and notes it is a Skybird-side data-handling decision. If he doesn't answer it, build 0.25 miles and move on.
- **Nothing mentions the vendor.** The build-vs-buy decision is closed (`handoff-buy-vs-build-decision.md`) and Euan was never part of it. Item 5 is framed as a reference site, which is what it is.
- **The ProLine situation is deliberately absent.** The missing CompanyCam↔ProLine bridge (`07-phase-4-preflight.md` §2.4.2) is a Skybird-side problem. Nothing about it is Euan's to solve and raising it would only dilute the asks.

## What his answers unblock

| His answer | Unblocks |
|---|---|
| Staging + `skybird-sync` user | Every write to WordPress — the Phase 4 draft itself |
| Plugin ownership | Writing the `skybird-projects` plugin (CPT, taxonomy, meta) |
| ACF / ACF Pro | Whether fields are ACF or native `register_post_meta`, and whether Gallery/Repeater are available |
| SEO plugin | Where the SEO title, meta description and schema get written |
| Security plugin | Whether Application Passwords will actually authenticate |
| `/projects/` free | Whether the CPT can use the intended permalink |
| `-nc` canonical | Which service-area URLs the project pages link back to |

Once these land, the only Phase 4 items left are Skybird-side: the egress allowlist, and creating/proving the `project.label_added` webhook (`07-phase-4-preflight.md` §2.3).
