# 06 — Trigger Design

Skybird Project Showcase + Referral System · Phase 3
Formalizes the trigger mechanism already proven live in Phase 1 (Bill Najdecki, project #2561) and defines the human-review gate the kickoff doc requires before anything publishes.

**Status: mechanism already proven. This document is the formal writeup, plus the review checklist that wasn't yet written down.**

---

## 1. The trigger, end to end

```
Photos curated in CompanyCam
  → tag "Showcase" on each photo that belongs in the set
  → tag "Showcase Cover" on the one hero/after photo
  → tag "Website Showcase" on the PROJECT (not a photo) once curation is done
       ↓
  CompanyCam fires webhook: project.label_added
       ↓
  n8n receives it, validates the signature (X-CompanyCam-Signature, HMAC-SHA1)
       ↓
  n8n pulls the project + photos tagged "Showcase" (excluding internal: true)
       ↓
  n8n creates a WordPress draft (post_status: draft) — nothing public yet
       ↓
  HUMAN REVIEW (§3 below)
       ↓
  Publish
```

This is Option A from the original brief, confirmed against the live CompanyCam API (not the deprecated one) on 2026-09-14, and proven working end to end on a real project the same day.

> **Correction, 2026-09-16 (Jacob).** "Proven working end to end" above describes the *data* flow, not the *delivery* leg. The 9/14 test added the label and then pulled the project by hand — no webhook was ever registered or delivered. Confirmed live on 2026-09-16: the CompanyCam account has three webhook subscriptions, all pointing at a Convex endpoint for `photo`/`document`/`video` events, and none subscribed to any `project.*` scope (`07-phase-4-preflight.md` §2.3).
>
> What this changes: the three steps from `project.label_added` through signature validation to the n8n entry point are **unproven and are Phase 4's first deliverable**, not a re-wiring of something known good. In particular Phase 4 must prove, on a real delivery:
> - the subscription fires on a label add (and, importantly, does *not* fire for the other labels already in the account — the payload carries the project, so n8n has to filter on the label itself);
> - `X-CompanyCam-Signature` validates as base64 HMAC-SHA1 of the raw body (raw, not re-serialized JSON);
> - n8n returns HTTP 200 fast and does the work afterward, per the 25-error disable rule in `01-api-audit.md` §1.3.
>
> The signing token is shown **only once, at webhook-create time**. Whoever creates the subscription must capture it into the n8n credential store in the same sitting.

## 2. Why the project label, not a photo tag, is the actual trigger

Photo tags (`Showcase`, `Showcase Cover`) describe *content* — they say what belongs on the page. The project label (`Website Showcase`) is a separate, deliberate signal that curation is *finished* and the project is ready to move. This separation matters: someone can tag photos over several days while a project wraps up, without accidentally kicking off a draft before they're done. The label is the one, single "go" moment — added once, by a person, on purpose.

## 3. What human review checks before publish

The kickoff doc required this be documented, not left implicit. Before clicking publish on a draft:

| Check | What to look for |
|---|---|
| **Photos** | The `Showcase`-tagged set is actually during/after work with at most a couple of befores — not inspection photos, not damage-marking, not warranty/QA documentation (the Bill Shay and Kent Newell projects from Phase 1 testing were exactly this failure mode — inspection-only projects that shouldn't have reached this stage at all. If one does, don't publish — pull the `Website Showcase` label instead of publishing a bad page.) |
| **Cover photo** | The `Showcase Cover` photo is a genuine hero shot — finished work, good composition, no people/equipment/vehicles cluttering the frame if avoidable |
| **Description** | 2–4 sentences, first sentence carries the who/town/job info (the brief's AEO framing), matches the locked copy rules — no "free roof," no invented prices, no city-stuffing, no claims about "this week's storm" |
| **Location precision** | City/neighborhood/ZIP only in the visible copy — never the street address. Confirm the approximate map coordinates (`05-data-model.md` §1) were generated, not left blank or defaulted to the true location |
| **Product/color** | Manufacturer, product line, color, warranty fields match what was actually installed — pull from the job record, don't guess from photos |
| **SEO title** | Follows the locked format: one job, one town, roof replacement (e.g. *GAF Timberline HDZ Roof Replacement in Wake Forest, NC*) |
| **Service area link** | The project is tagged to the correct one of the 8 service areas, and will actually appear in that area's map widget once published |
| **No homeowner PII** | Full name, phone, email, exact address — none of it anywhere on the page, including in image filenames/alt text if those were auto-generated from CompanyCam data |

If any check fails, the fix is either: fix the draft and re-review, or remove the `Website Showcase` label and address the underlying issue (bad photo curation, missing job data) before re-tagging.

## 4. What happens after publish — noted, not yet built

Two things surfaced from the Phase 2/build-vs-buy work that belong in this flow but aren't part of Phase 3 or 4's scope:

- **Homeowner notification** (email + text with the share link) — this is Phase 5 territory (referral layer), and per the kickoff doc's hard rule, any homeowner-facing message gets drafted and shown to Jacob before it's wired live. Publish does not trigger a homeowner message on its own yet.
- **Mobile/tablet rendering** — flagged from the Predictive Sales AI review: a project page doubles as a sales tool a rep might pull up on a tablet at the kitchen table, not just an SEO asset. This is a Phase 4 build/frontend requirement (the page template needs to look right on mobile), not a trigger-design concern — noting it here so it doesn't get lost before Phase 4 starts.

## 5. Ready for Phase 4

Per the kickoff doc, Phase 4 is: one real CompanyCam project → one real WordPress draft, tested end to end, nothing published automatically, coordinated with Euan before touching the live site (staging site if Pitch Peak has one — still an open item from `01-api-audit.md` §2.2).
