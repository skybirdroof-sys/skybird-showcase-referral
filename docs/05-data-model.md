# 05 — Data Model

Skybird Project Showcase + Referral System · Phase 2
Numbered 05 to stay continuous with docs produced so far (01 audit, 02 Euan consultation, 03 structure sign-off, 04 pin precision) — the kickoff doc called this "02-data-model.md" before those intermediate docs existed.

**Status: draft, ready for review. Nothing here touches a live system.**

---

## 0. Five entities, three homes

| Entity | Lives in | Why there |
|---|---|---|
| **Project** | WordPress (CPT + meta) | It's the public page. Needs to be indexable, editable in the CMS Pitch Peak already manages. |
| **Ambassador** | GHL (contact) + a thin pointer in WordPress | GHL already is the contact database — no reason to duplicate a full contact record elsewhere. WordPress only needs the referral code, to build the share URL on the project page. |
| **Referral** | n8n-owned ledger (Data Table for v1) | This is the audit trail — needs multi-step status over weeks, dedup logic, fraud checks. GHL custom fields can hold a snapshot on the *lead's* contact record, but the ledger is the source of truth. |
| **Lead** | GHL (contact) | Same reasoning as Ambassador — GHL is already the lead database. |
| **Reward** | n8n-owned ledger, same table family as Referral | Owed amount, tier, paid status, trigger event — this is bookkeeping, not marketing automation. Doesn't belong in GHL. |

This is the hybrid already flagged as the recommendation in `01-api-audit.md` §3.3 — this section makes it concrete.

---

## 1. Project (WordPress CPT `project`)

Permalink: `/projects/{slug}/` — flat, per Euan's sign-off in `03-structure-signoff.md`. Subordinate to its service area through linking, not URL nesting.

| Field | Type | Notes |
|---|---|---|
| `companycam_project_id` | meta | Bridge back to CompanyCam, for any future re-sync |
| `proline_project_id` | meta | **Correction 2026-09-16:** there is no ProLine↔CompanyCam link for new jobs — `integrations[]` is absent and will stay absent (`07-phase-4-preflight.md` §2.4.2). Keep the field: it is the right slot for a future bridge attached to the GHL→ProLine handoff or direct ProLine entry (§2.4.3). Nothing populates it today, so nothing may depend on it |
| `service_area` | taxonomy term | One of the 8 service areas. Drives which widget the project appears in and the back-link target |
| `city`, `neighborhood`, `zip` | meta | Display text only — never the street address (brief §24) |
| `approx_lat`, `approx_lng` | meta | The offset coordinates from `04-pin-precision-research.md` — generated once, stored, never regenerated. **The true CompanyCam coordinates are never written to WordPress at all** — no reason to let the real location exist anywhere on the public-facing system, even server-side. If it's not stored here, it can't leak from here. |
| `manufacturer`, `product_line`, `color`, `warranty` | meta | From the job record / ProLine, for the page copy |
| `completion_date` | meta | |
| `gallery` | meta (array of attachment IDs) | The `Showcase`-tagged photos, downloaded into the Media Library per `01-api-audit.md` §1.5 — never hotlinked from CompanyCam |
| `featured_image` | WP featured image | The `Showcase Cover`-tagged photo |
| `ambassador_referral_code` | meta | Pointer only — the code itself is generated and owned in the Ambassador record (§2). Written here so the page template can build the share URL without a live lookup |
| title / H1, description | post content | Per `topics/document-standards.md` copy rules (existing Skybird doc — not re-litigated here) |
| status | post status | `draft` → human review → `publish`, per the kickoff doc's Phase 3 gate |

---

## 2. Ambassador (GHL contact + WordPress pointer)

An Ambassador is a past customer who's eligible to refer. Not a new object in GHL — it's the **same contact record** GHL already has for that customer, with additional custom fields:

| GHL custom field | Notes |
|---|---|
| `referral_code` | See §4 for format. Generated once when their project is showcased |
| `is_ambassador` | Boolean flag — lets GHL workflows and reporting filter to "customers who can refer" without a separate object |
| `showcase_project_url` | The WordPress project page URL, for GHL to include in the "your project is live" message (brief's no-homeowner-messaging-without-sign-off rule still applies — this is data prep, not the message itself going out) |

The **WordPress side** only stores `ambassador_referral_code` on the Project post (§1) — a read of the code, not a second copy of the contact. GHL stays the single source of truth for who the ambassador is.

---

## 3.5 Lead (GHL contact — addendum, 2026-09-16)

Added after reviewing Predictive Sales AI's product directly: their referral lead form captures **TCPA consent with an audit trail** ("view consent" per lead) — something this data model didn't originally account for. Worth carrying forward as a requirement regardless of the build-vs-buy outcome, since it's a real gap, not a vendor-specific feature:

| GHL custom field | Notes |
|---|---|
| `tcpa_consent_given` | Boolean, set at lead-form submission |
| `tcpa_consent_timestamp` | |
| `tcpa_consent_text_version` | Which version of the consent language they agreed to — needed if the wording ever changes, so old leads stay auditable against what they actually agreed to |

## 4. Referral and Reward (n8n-owned ledger)

One row per referral attempt, in an n8n Data Table (or Google Sheet for v1 — whichever ships faster; migrating later is a non-event since nothing else depends on the storage mechanism, only on the fields).

**Referral row:**

| Field | Notes |
|---|---|
| `referral_code` | Which ambassador this traces to |
| `source_project_url` | Which project page the visit originated from — useful for knowing which showcases actually drive referrals |
| `referred_lead_ghl_id` | The new prospect's GHL contact ID, once they submit a lead form |
| `first_touch_at` | When the attribution cookie was first set (§5) |
| `status` | `pending` → `appointment_booked` → `signed` → `installed` → `paid` → (or `rejected_duplicate` / `rejected_self_referral`) |
| `status_updated_at` | |

**Reward row** (child of a Referral, same table family or a linked table):

| Field | Notes |
|---|---|
| `tier` | `appointment` or `job` — **amounts are still Jacob's decision**, not locked here. The $50/$500 figures mentioned on the Euan call were conversational, not approved (flagged already in `02-euan-consultation-notes.md` §4) |
| `trigger_event` | Which ProLine stage fired it — ties to Phase 6 in the kickoff doc, which is explicitly gated behind Phase 5 being proven first. This field exists in the model now so Phase 6 doesn't need a schema change later, but the automation that populates it isn't being built yet |
| `status` | `owed` → `approved` → `paid` |
| `paid_at` | |

---

## 5. Referral code format

Short, non-guessable, no ambiguous characters: **6 characters, alphanumeric, excluding `0/O`, `1/I/L`, and vowels** to avoid accidentally spelling something or being misread over the phone. Generated once per Ambassador, checked for uniqueness against the existing ledger before assigning (collision odds are low at this length but the check is cheap, so do it).

Example shape: `SKYBRD` pattern is the brand, not the algorithm — actual codes are randomly generated from the allowed character set, not brand-based, so they're not guessable in sequence (`SKY001`, `SKY002` would be guessable and should be avoided).

---

## 6. Attribution across visits

Per the mechanic Euan described (`03-structure-signoff.md` §3):

1. Project page's **Share to Facebook** button appends `?ref={code}` to the shared URL.
2. On any project page load with `?ref=` present, set a **first-party cookie** storing the code. Recommend a **45-day expiry** — long enough to cover Skybird's typical sales cycle (site FAQ states most replacements are scheduled 1–8 weeks out), short enough that stale attribution doesn't linger indefinitely.
3. **First-touch wins:** if a cookie already exists with a *different* code, don't overwrite it. A second share shouldn't steal credit from whoever referred the visitor first.
4. When the visitor eventually submits the GHL lead form (embedded on the project page or wherever they land), a **hidden field reads the cookie** and populates the `referral_code` custom field on their new GHL contact — the same hidden-field-to-query-parameter mechanism documented in `01-api-audit.md` §3.2, just sourced from a cookie instead of a live URL parameter (since the visitor may click through to the contact form from a different page than the one the `?ref=` param landed on).

---

## 7. Explicitly not decided here — still open, by design

Per the kickoff doc's phase gating, these stay open rather than getting decided as a side effect of building the data model:

- **Duplicate/fraud logic** (brief §31 Q13, Q17) — the `rejected_duplicate` / `rejected_self_referral` statuses exist as placeholders in the Referral schema (§3), but the actual matching rules (phone/email/address overlap with the ambassador's own contact) are Phase 5 work, once basic attribution is proven end to end.
- **Reward amounts and payable trigger** — Jacob's decision, flagged twice already, not re-litigated here.
- **Existing-contact handling** (brief §31 Q14 — what happens if the referred person is already a GHL contact) — same, Phase 5.
