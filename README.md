# Skybird Project Showcase + Referral System

Every completed Skybird roof replacement gets a real, indexable page on
skybirdroofing.net, built from curated CompanyCam photos, plus a referral layer
so past customers can share their project and earn a reward when it leads to a
new lead or job.

Built in-house on Skybird-owned infrastructure. See
`docs/handoff-buy-vs-build-decision.md` for why.

## Documents

| Doc | Phase | Status |
|---|---|---|
| [`docs/01-api-audit.md`](docs/01-api-audit.md) | 1 | Complete — CompanyCam / WordPress / GHL / ProLine API surface |
| [`docs/02-euan-consultation-notes.md`](docs/02-euan-consultation-notes.md) | 1 | Informal consultation with Pitch Peak |
| [`docs/03-structure-signoff.md`](docs/03-structure-signoff.md) | 1 | **Signed off by Euan** — flat URLs, per-service-area map widgets |
| [`docs/04-pin-precision-research.md`](docs/04-pin-precision-research.md) | 2 | Settled — fixed randomized offset, 0.2–0.3 mi |
| [`docs/05-data-model.md`](docs/05-data-model.md) | 2 | Draft — five entities, three storage locations |
| [`docs/06-trigger-design.md`](docs/06-trigger-design.md) | 3 | Complete — label → webhook → n8n → WP draft, plus review gate |
| [`docs/handoff-buy-vs-build.md`](docs/handoff-buy-vs-build.md) | — | Context carried into the vendor evaluation |
| [`docs/handoff-buy-vs-build-decision.md`](docs/handoff-buy-vs-build-decision.md) | — | **Decision: build in-house.** Closed |
| [`docs/07-phase-4-preflight.md`](docs/07-phase-4-preflight.md) | 4 | **At a gate** — open items in §7 |
| [`docs/08-euan-questions.md`](docs/08-euan-questions.md) | 4 | Sent 2026-09-17 |
| [`docs/09-euan-answers.md`](docs/09-euan-answers.md) | 4 | **Answered** — §2.2 closed bar the security plugin |

## The trigger, in one line

Photos tagged `Showcase` (+ one `Showcase Cover`) → project labeled
`Website Showcase` → CompanyCam `project.label_added` webhook → n8n →
WordPress draft → **human review** → publish.

Nothing publishes automatically. See `docs/06-trigger-design.md` §3 for the
pre-publish review checklist.

## Hard rules

- Never publish homeowner name, phone, email, or street address — including in
  image filenames and alt text.
- Map pins use stored offset coordinates. True CompanyCam coordinates are never
  written to WordPress.
- Photos with `internal: true` are never included, even if tagged `Showcase`.
- Credentials live in the n8n credential store. Never in this repo.
