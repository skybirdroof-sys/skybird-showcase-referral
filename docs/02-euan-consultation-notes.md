# 02 — Euan Consultation Notes

Skybird Project Showcase + Referral System · Notes from Margaret/Euan marketing call, 2026-09-14
Source: call transcript, second half (Margaret raised the project ~50 min in)

**Status: informal consultation captured. Not a substitute for the formal walkthrough the kickoff doc calls for before Phase 4 — but it resolves most of the open WordPress questions in `01-api-audit.md` §2.2, and surfaces one new structural decision.**

---

## 0. Where this came from

An outside consultant ("Andy," runs a $1,000/mo referral SaaS for roofing companies, also a "big WordPress hater") pitched Margaret on a one-page-per-project structure — pointed to a client site with ~986 project pages as the model. Margaret is reverse-engineering the *behavior* she wants (referral pages, sharing, tracking) in-house with Claude rather than buying his product, which is exactly the posture the kickoff doc's §7 ("no cloning Predictive Sales AI's UI, replicate the business logic on Skybird-owned infrastructure") already anticipated. Andy's product is very likely the same category of tool as — or literally — the "Predictive Sales AI" reference already in the brief.

Margaret looped Euan in before building anything, per the kickoff doc's own rule. This doc is that conversation.

---

## 1. The structural question Euan raised — and where it landed

**His concern, stated plainly:** a page-per-project structure is fine *only if every page is properly interlinked into the site hierarchy* — living under the correct service-area page (e.g., nested under Goldsboro's page, not floating at the root). Two failure modes he named specifically:

- An orphaned or poorly-linked project page can accidentally outrank pages you care about (his example: a referral page for "Joe Schmo in Wake Forest" outranking the Skybird homepage itself if it gets unusual traffic and isn't clearly subordinate in the link graph).
- Raw page count is not a proxy for SEO strength. He pushed back directly on Andy's "986 pages = good" pitch: **what matters is site structure and relevance to what people are searching, not volume** — a large number of thin, badly-structured pages can slow the whole site down and dilute rather than help.

**Where he landed, after thinking out loud with Margaret:** recommend a **widget-first model**, closer to what CompanyCam's own embeddable widget already does (browse projects, click one, see details) — but built in-house so clicking a project stays on skybirdroofing.net instead of bouncing to CompanyCam's domain, which is the exact SEO leak the kickoff doc already flagged as the reason to build this at all.

**Important nuance — this is not "no pages."** Euan explicitly walked back toward a hybrid a few exchanges later: the widget can still generate and link to a real WordPress page per project ("it could generate a new page... and it's linked into the widget as well for that specific location"). So the resolved shape is:

- **A widget is the primary browse/index surface** (on the homepage or a projects hub) — this is what carries the "look how much we've done" impression and keeps interaction on-site.
- **Each project still gets a real, indexable WordPress page** behind the widget, with standard on-page SEO (H1, H2, body copy, alt text on images) — this hasn't changed from Phase 1's CPT recommendation.
- **The one firm requirement: every project page must be clearly subordinate to its service-area page in the link graph** — reachable from and linking back to the relevant service-area page (Goldsboro, Wake Forest, etc.), not just sitting at a flat `/projects/{slug}/` with no relationship to the service-area pages Pitch Peak already maintains.

**What's still open, worth confirming with Euan directly before Phase 2 locks the data model:** whether "subordinate in the link graph" means a URL path change (e.g. nesting under `/service-areas/goldsboro/{slug}/` instead of `/projects/{slug}/`) or just strong internal linking (service-area page links out to its projects; each project page links back) with the flat URL staying as-is. Euan didn't say which — he described the *requirement*, not the *implementation*. Flat URL + internal links is simpler and doesn't require restructuring permalinks or introducing a second taxonomy dependency; recommend proposing that as the default in the Phase 1 gate follow-up rather than assuming a URL nesting change.

---

## 2. Repeatable process, his words

> "The more automated we can make it with checks, the better."

He wants: generate page (H1/H2/alt text/etc. handled) → **manual check before publish** → **manual submission to Google Search Console to request indexing**, at least initially. This matches the kickoff doc's Phase 3 "human review" gate — no changes needed there, just confirms it.

He's explicitly fine with Claude having MCP access to WordPress and acting as an admin — publishing updates to the widget and creating pages without him in the loop, once the process is proven. That's a green light for the automation depth Phase 4 already assumed; nothing here should be held back on Euan's account once the structure question above is settled.

---

## 3. The referral share mechanic — new detail, useful for Phase 2/5

Margaret and Euan worked out roughly how the actual share flow could work, which fills in brief §31 Q12 (attribution across visits) with something concrete:

- Project page includes a **"Share Now" button**.
- Click opens Facebook's share dialog pre-populated with the project photo/link and a caption — technically this is Facebook's standard `sharer.php?u=...&quote=...` pattern, or Open Graph tags on the page driving the pre-fill. Straightforward to implement.
- The URL that gets shared needs the ambassador's referral code appended (`?ref=CODE`) for the cookie/query-param/hidden-field attribution chain already planned in Phase 1 to work end to end.

This is implementation detail, not a new decision — folding it into Phase 2's referral-code design rather than treating it as open.

---

## 4. Referral amounts — heads up, not a decision

Margaret said out loud on the call (to Euan, not as a formal decision): **$50 if a referral results in a booked appointment, $500 if it becomes a signed job.** The brief's §31 explicitly logged Tim Teague's numbers as "an example, not the offer" and left this for Jacob to decide against the ~$23k planning ticket. Margaret using these specific numbers in conversation doesn't make them final — flagging so this doesn't quietly become the assumed default before Jacob has actually weighed in.

---

## 5. One coordination flag, not a decision

Margaret is already hands-on prototyping with the CompanyCam MCP connector herself — she described pulling a project ("Building Jackie," ~550 photos) and having Claude pick the best 5 automatically in about 30 seconds. That's the same tool surface (CompanyCam MCP) this build has been using with John, but a different approach (automatic ranking vs. the judgment-based curation used on the Najdecki project — which mattered, since two of three projects sampled turned out to be inspection-only and wrongly disqualified from Showcase status on a purely automatic read).

Worth John/Jacob/Margaret syncing on this before Phase 2 so there isn't parallel, divergent work on the same photo-curation problem — not something to resolve in this doc, just flagging it exists.

---

## 6. Net effect on Phase 1 / kickoff doc

- §2.2's WordPress questions (theme/builder, ACF, staging site, permalink structure) are **still open** — this call didn't touch those, it only addressed structure/hierarchy, not the CMS mechanics.
- The **trigger design (Option A, CompanyCam label → n8n → WordPress draft) is unaffected** — this call was about what happens to the page once it's created, not how it gets created.
- **New: a widget is now part of the design**, not just individual pages. Phase 2's data model should account for both the widget (what it queries, how it updates) and the page (what it contains), not just the page.
- **New, needs Euan follow-up:** confirm whether "properly interlinked" means a URL/permalink change or just internal linking, before the data model locks in a URL structure.
