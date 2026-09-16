# Handoff: Skybird Project Showcase + Referral System — for Build-vs-Buy Thread

Written 2026-09-14 to carry into a new thread evaluating "Pin Precision" (vendor) against building this in-house.

**Note on the vendor:** "Predictive Sales AI" is not a new name to this project — it's already referenced in the original kickoff doc's explicit scope boundary: *"no cloning Predictive Sales AI's UI, replicate the business logic on Skybird-owned infrastructure."* Everything built so far (Phases 1–2, summarized below) was designed from day one specifically to avoid dependency on this vendor, not to compete with it in ignorance of it. That framing matters for the new thread: this isn't "should we evaluate an unfamiliar tool," it's "should we reverse a decision that was explicit from the start." Worth naming that tension directly rather than treating the call as fresh information in a vacuum.

---

## 1. What this project is

Skybird wants every completed roof replacement to get a real, indexable page on skybirdroofing.net — built from curated CompanyCam photos — plus a referral layer so past customers can share their project and earn a reward when it leads to a new lead or job. This replaces two things at once: CompanyCam's own project widget (which bounces clicks off-site, losing SEO value) and the site's existing `/gallery/` page (a dead-end photo grid with no click-through, being replaced outright).

The idea originated from a $1,000/month referral SaaS pitch to Jacob (the vendor apparently called "Andy" in earlier notes — separate from "Pin Precision," as far as known). The decision from the start has been to replicate the *behavior* Skybird actually needs on Skybird-owned infrastructure, rather than pay for and depend on someone else's platform. Everything below is the result of that approach, three phases in.

## 2. Decisions already locked in (not up for re-litigation unless the vendor changes the calculus)

- **Trigger:** a CompanyCam project gets curated (photos tagged `Showcase`, one tagged `Showcase Cover`), then labeled `Website Showcase`. That project label fires a real webhook (`project.label_added`, confirmed live on CompanyCam's current API) that starts the automation. Proven end-to-end on a real project (Bill Najdecki, #2561).
- **CompanyCam has no API access to its own "Showcase" feature** (the curated gallery under Marketing, used today for the site's widget). The tag-based proxy above exists specifically because that feature isn't reachable via API — confirmed via live tool access, not guessed.
- **Site structure, signed off by Euan (Pitch Peak, manages the WordPress site):** flat project URLs (`/projects/{slug}/`), strong internal linking to/from each project's service-area page (no URL nesting needed). A separate map widget on **each of the 8 service-area pages** (Franklinton, Goldsboro, Greenville, Knightdale, Raleigh, Rolesville, Wake Forest, Youngsville), with projects as clickable pins. **Skybird builds this widget in-house**, not Pitch Peak.
- **Project pages need:** a "back to all [area] projects" link, and a "Share to Facebook" button that opens a pre-populated post linking back to the project page with a referral code attached.

## 3. Data model (Phase 2, drafted, not yet built)

Five entities, three storage locations — deliberately not centralized in one tool:

| Entity | Lives in | Why |
|---|---|---|
| Project | WordPress | It's the public page |
| Ambassador (the referring past customer) | GHL contact + a code pointer in WordPress | GHL is already the contact database |
| Lead (the new referred prospect) | GHL contact | Same reasoning |
| Referral | n8n-owned ledger | Needs multi-step status tracking and fraud checks GHL custom fields aren't built for |
| Reward | Same ledger, linked to Referral | Amount/tier/paid-status bookkeeping |

Referral code: 6 characters, random, alphanumeric, excludes ambiguous characters. Attribution: first-party cookie set on `?ref=` visit, 45-day window, first-touch wins.

**Deliberately still open, not decided:** reward dollar amounts (Jacob's call — a $50/$500 structure came up in casual conversation but isn't approved), fraud/duplicate-referral logic, and exactly how ProLine's stage events map to reward triggers.

## 4. What hasn't been built yet

Everything past Phase 2. No code has touched the live site. Phases 3 (formal trigger writeup — mostly already decided above, just not formally documented as its own phase output), 4 (MVP build), 5 (referral layer), and 6 (reward automation) are all still ahead, per the original kickoff doc's phase gating.

## 5. Pin precision (Phase 2 detail — only relevant if the vendor also does mapping)

Map pins are offset from the true CompanyCam coordinates by a random distance within roughly 0.2–0.3 miles, generated once per project and stored (not recalculated on each view), modeled on Airbnb's approach but scaled down for a lower threat model — Skybird's project pages already never show homeowner name/address, which is most of why Airbnb's approach needs to be more defensive than this does.

## 6. The actual question for the new thread

The original scope decision — replicate the business logic, don't depend on or clone Predictive Sales AI's product — was made *before* this 45-minute call happened, without firsthand exposure to what they're actually offering. Given everything above is already researched, decided, and partially proven (the CompanyCam tagging/webhook mechanism has been tested live), the honest question isn't "can this be built in-house" — it demonstrably can, and a meaningful chunk already has been, at real time cost. The question is whether what came out of that call changes the original judgment: does Predictive Sales AI's actual product (not the secondhand pitch that originally informed the "don't clone it" decision) solve a problem this plan hasn't accounted for, avoid an ongoing maintenance burden, or change the cost/time tradeoff enough to justify reversing course — weighed honestly against the engineering time already spent building the alternative. That's the comparison the new thread needs to make, with this document as the "what building it ourselves actually looks like, and why" side of the ledger, and the call transcript/video/screenshots as the other side.
