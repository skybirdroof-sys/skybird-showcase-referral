# 03 — Site Structure: Euan's Sign-Off

Skybird Project Showcase + Referral System · Euan's response, 2026-09-14
Status: **structure confirmed.** This supersedes the open URL question in `02-euan-consultation-notes.md` §1 and adds one new scope item that needs a decision before Phase 2 locks the data model.

---

## 1. Confirmed: Option B — flat URLs, strong internal linking

No permalink nesting needed. Google needs to see the relationship through links, not the URL path:
- Service-area page → links out to each of its projects
- Each project page → links back to its service-area page

`/projects/{slug}/` stands as originally planned in `01-api-audit.md` §2.3. No change to the CPT/permalink structure.

## 2. New: a map widget per service area, not one global widget

This is the part that changes scope. Euan wants:

- **One widget per service-area page** — Goldsboro's page gets a Goldsboro widget, Wake Forest's page gets a Wake Forest widget, and so on for every page currently listed under the site's "Service Areas" menu. Not a single sitewide widget with a filter.
- **Each widget is a map**, not a list or carousel. Projects in that service area appear as icons/pins on the map.
- **Click an icon → project page.** Standard map-marker-to-detail-page pattern.
- **Project page needs a "Back to all [Service Area] Projects" link** — returns to that service area's widget.
- **Project page needs a "Share to Facebook" button** — opens a new tab with a pre-populated post linking back to the project page. This matches the mechanic already discussed with Margaret (Facebook's `sharer.php` pattern or Open Graph pre-fill) — now it's a confirmed requirement, not a nice-to-have.

## 3. What this changes for Phase 2

This is a bigger addition than a URL tweak — it brings brief §25 (the public project map) into v1 scope. The kickoff doc's default was "no" on that; Euan's sign-off effectively reverses it, scoped per service area rather than one sitewide map.

Concretely, Phase 2's data model now needs:

- **Approximate coordinates per project**, not just city/ZIP. CompanyCam's Project object already returns `coordinates` (lat/lon) per `01-api-audit.md` §1.2 — but per the brief's privacy rule (§24, non-negotiable: never show exact street address), the coordinates written to WordPress need to be **deliberately imprecise** — snapped to a neighborhood centroid or given a small random offset, not the literal CompanyCam pin. This needs a specific method decided in Phase 2, not left implicit.
- **A service-area taxonomy term per project** (already planned in `01-api-audit.md` §2.3's taxonomy list) — this is what each widget queries against to know which projects belong on its map.
- **A map library choice** — needs picking (Google Maps, Mapbox, Leaflet) and whether it's something Pitch Peak already has infrastructure for on other pages of the site, or net-new.

## 4. Answered directly from the live site (skybirdroofing.net), 2026-09-14

1. **Service areas: 8** — Franklinton, Goldsboro, Greenville, Knightdale, Raleigh, Rolesville, Wake Forest, Youngsville. That's 8 widgets, one per area page.
   - **Flag for Euan:** the top nav links to these with a `-nc` suffix (`/service-areas/franklinton-nc/`), while the homepage footer's "Our Service Area" links to the same pages without it (`/service-areas/franklinton/`). Confirm which is canonical before building against either — could be a redirect, could be a stale link.
2. **Existing map infrastructure: a single-pin Google Maps Embed API iframe** near the footer, showing only Skybird's own office location. Not a JS-driven map with multiple markers — this is a static embed, not infrastructure this build can extend. Recommend the Google Maps JavaScript API for the new per-service-area widgets (same map family already in use, brand-consistent), which needs an API key and billing account set up separately from the existing embed.
3. **Who builds the widget: resolved — this project builds it.** No longer an open question.
4. **Pin precision method: still open, still needs Euan's (or Jacob's) call.**

**New flag, not one of the original four — now resolved and upgraded to a real finding.** The homepage's "View More Projects" section and the `/about-us/gallery/` link both turned out to be clean redirects to the canonical `/gallery/` page — not dead links, no ambiguity, resolved without needing Euan.

What `/gallery/` actually contains, confirmed by screenshot (2026-09-14): a masonry grid of drone/roof photos — real content, just JS-rendered (invisible to a static fetch, which is why it looked empty earlier). More importantly: **the images don't do anything when clicked.** No lightbox, no project detail, no story — just a static wall of photos. This is functionally the same dead-end problem the whole build exists to solve, just self-hosted instead of living on CompanyCam's domain.

**Decision (2026-09-14, Jacob/John):** replace it. The new per-service-area widgets and individual project pages supersede it — no separate "browse all our work" page stays alongside them.

## 5. What's left to send Euan

Only the pin-precision question (#4 above) is still genuinely his to answer. Worth a short, single-question follow-up rather than re-sending the full list — #1–#3 are resolved.
