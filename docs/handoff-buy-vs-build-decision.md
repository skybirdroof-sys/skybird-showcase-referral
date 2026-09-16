# Handoff: Build-vs-Buy Decision — Predictive Sales AI vs. In-House Showcase/Referral Build

Written 2026-09-16 to carry back into the main build thread. Supersedes the open question in `handoff-buy-vs-build.md` (2026-09-14).

## Decision

**Keep building in-house.** Skybird owns the pages, the data, and the code. Proceed with Stage 3 (trigger design writeup) and on to the MVP.

Rationale in one line: the vendor's product moves the SEO asset this project exists to capture onto a domain Skybird doesn't control, and the parts it does well (referral tracking) are the parts that can be built later, once the pages are live.

## Corrections to the prior handoff

- The vendor is **Predictive Sales AI (PSAI)**. "Pin Precision" in the earlier header was a mix-up with the map-offset feature. There is no "Andy"; the presenter throughout has been **Tim Teague, Director of Sales, PSAI**. The "$1,000/mo referral SaaS pitch" and the Tim demo are the same vendor, not two.
- Skybird's current informal referral practice: ~$250 or a gift card, mentioned verbally, nothing in writing, no link or tracking.

## What PSAI actually offers (from the 9/14 call transcript, Tim's email, and the pro forma)

**Product:** "Project-2-Profit" bolt-on. $1,000 setup + $995/month. No long-term agreement. Launch quoted as Oct 1 (2–3 weeks).

**Where the pages live:** `skybirdroofing.projectshowcase.ai` — a subdomain of *their* domain — connected to skybirdroofing.net by a floating JavaScript button. Project pages, alt tags, and all "authoritative content" accrue to projectshowcase.ai, not to Skybird's site. This is the same off-site bounce problem the CompanyCam widget has today.

**How jobs get loaded:** drag-and-drop the contract PDF (auto-extracts customer, address, materials) + upload photos manually. "CompanyCam integration" as described = export photos to a drive and upload. Not automated.

**Referral flow (this part is finished and demoed):** publish job → homeowner gets email/text with share link → shares tracked in PSAI activity ledger → lead form with TCPA consent capture → lead pushed to **ProLine** (not GHL) with homeowner background data (property age, tax value, household profile) and a 1–5 "predictive match index." Reward tiers configurable per job (Tim's suggestion: $100 booked appointment + $400 close). The text message failed to arrive during the demo; email worked.

**Bundled extras not in Skybird's scope:** NOAA weather reporting (would replace HailTrace), GAF warranty import to seed the map, chatbot, quote forms with Google reviews, financing button, exit intent, Facebook/Instagram campaign tools, "audience" drawing around jobs.

**Map privacy:** pins resolve only to town level; zoom is capped. Comparable to our 0.2–0.3 mile offset approach.

**Pro forma (Tim's numbers, worst-case framing):** 7 referral leads month 1 → 117 leads/yr, 31 closed sales, $558K gross on $32.5K marketing spend (5.8%). Assumes a program with zero enrolled ambassadors produces 7 referral leads in its first month. Treat as sales material.

## What the reference sites revealed (checked 9/16)

Tim's email listed 11 contractor sites as examples. Checked Roman Roofing and Mr. Roofing directly:

- **Both run PSAI's full website platform.** Their entire sites are hosted by PSAI (assets served from PSAI's multitenant/cms storage). That is why their project pages are on their own domains.
- **Mr. Roofing's project pages** (`mrroofing.net/past-projects/project/{id}/`) are indexed by Google, titled at street level ("project on 19th Ave in SF, CA"), and include: back-to-map link, prev/next project, share buttons (Facebook/Twitter/LinkedIn/Pinterest/email), neighboring projects, Google reviews, quote form. **This is a working reference model for exactly what we are building** — same structure Euan signed off on.
- **The bolt-on Tim proposed for Skybird is a different product** from what the reference sites show. None of the examples were bolt-on customers.
- **Zero indexed pages exist anywhere on projectshowcase.ai.** No public evidence that the bolt-on subdomain version produces SEO value for anyone.
- Roman Roofing's project listing renders client-side (placeholders + "Loading…" in raw HTML). Fragile for indexing.

## Why in-house wins for Skybird specifically

- Pages on skybirdroofing.net; SEO compounds to Skybird. Shared links never die if a vendor relationship ends.
- Ambassadors and leads stay in GHL alongside the rest of the marketing data. PSAI would route leads to ProLine and keep referral activity in its own portal — a blind spot for GHL reporting.
- The CompanyCam label → webhook trigger is already proven live (Bill Najdecki, #2561). PSAI's loading is manual.
- No monthly cost, no vendor lock-in.
- Owner's stated priority: learn to build it and leverage AI fully rather than rent it.

## What PSAI does better (carry these into the build as requirements)

These are the gaps in the in-house plan that the vendor has solved and we have not yet:

1. **Rep-facing process.** PSAI documents the ambassador program and trains reps to ask every time. The software is the easy part; the ask-every-time process is what makes referrals happen. Needs an owner and a written procedure (Stage 5/6 deliverable, not code).
2. **TCPA consent capture with audit trail** on the referral lead form ("view consent" per lead). Add to the Lead entity in the data model.
3. **Kitchen-table use.** A robust showcase is a sales tool on a tablet, not just an SEO asset. Design project pages and the area map to look good on mobile/tablet.
4. **Homeowner notification on publish** (email + text with share link). Already implied by Stage 5; confirm it's in scope.
5. **Enrollment offer at contract signing** (discount for joining the program) as the on-ramp, separate from the post-job share reward. Jacob's call on amounts; note that Tim's field data suggests booked-appointment bonuses should be meaningful relative to close bonuses.

Weather reporting, homeowner background enrichment, and match scoring are out of scope. HailTrace stays.

## Legal note (lay summary, not advice)

Building a functionally similar system with homemade code is fine. Ideas, features, and business logic are not protectable. Stay away from: their code, their UI/layouts/copy/email templates, their branded names ("Project-2-Profit," "Predictive Match Index"), and reuse of their materials (pro forma, demo video, email). Risk rises only if this is ever sold to other roofers — at that point, run it by Trevor. Check whether any demo click-through or GAF-event paperwork included a non-compete clause (unlikely). Optional: USPTO search for PSAI patents.

## Open items

- **Friday 9/18, 2:30 PM ET:** Tim has a follow-up on the calendar. Either cancel, or use it to ask (a) whether the bolt-on can be served under skybirdroofing.net, and (b) for a live bolt-on customer example. Answers would only matter if the decision reopens.
- Reward amounts, fraud/duplicate logic, and ProLine stage → reward trigger mapping remain undecided (Jacob's call).
- Euan has not yet seen Mr. Roofing's project page as a reference. Worth sending him the link as "this is the target."

## Next step in the main thread

Proceed with **Stage 3: formal trigger writeup** — CompanyCam `Showcase` / `Showcase Cover` photo tags + `Website Showcase` project label → `project.label_added` webhook → n8n → WordPress draft. Then Stage 4 MVP: one CompanyCam project → one WordPress project page at `/projects/{slug}/`.
