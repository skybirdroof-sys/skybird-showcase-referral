# 01 — API Audit

Skybird Project Showcase + Referral System · Phase 1
Prepared 2026-09-14 · Answers brief §31 · Sources linked inline

**Status: complete, at gate. Waiting on two decisions (see §6).**

---

## 0. Headline findings

1. **CompanyCam has a webhook that fires when a project label is added** (`project.label_added`). Option A from brief §9 — tag the project, automation fires — is possible without polling.
2. **The publicly documented CompanyCam API is legacy and sunsets September 1, 2027.** The current API lives at developers.companycam.com. **Confirmed 2026-09-14** (John pulled up the live Webhooks page): the new API's `project.*` scopes match the legacy list exactly, including `project.label_added`. The trigger design in this document holds on the API Skybird will actually build against.
3. **Photos carry an `internal` flag** meaning "not for marketing." Respect it. They also filter by tag ID, so a "Showcase" photo tag is the natural photo-selection mechanism.
4. **Showcases are not exposed** in the legacy API reference. Assume no. The project page is built from project + tagged photos, not from the showcase.
5. **WordPress is straightforward.** Custom post type + ACF + Application Passwords covers create-draft, upload-media, write-fields. Nothing exotic required.
6. **GHL hidden fields can read a URL query parameter** into a contact custom field. One gotcha: iframe-embedded forms cannot see the parent page URL.
7. **ProLine has an API key, a Zapier app with stage-change and payment triggers, and inbound webhooks.** Public REST docs were not found. The existing agency-managed n8n → ProLine flow is the thing to inspect before deciding how leads enter.

---

## 1. CompanyCam

### 1.1 Which API

| | Legacy Core API (v2) | New API |
|---|---|---|
| Docs | docs.companycam.com (public) | developers.companycam.com (login required) |
| Status | Deprecating; "will not add new functionality" | Current; has OpenAPI spec, Postman collection, changelog |
| Hard stop | **Sept 1, 2027** | — |
| Auth | Bearer token (OAuth 2.0 or access token) | Personal Access Token or Application Key; must register an Application first, even for private use; keys expire |
| Who can create keys | — | Admins and Managers only |
| Plan requirement | Pro, Premium, Elite | Paid plan |

Sources:
- Legacy banner + sunset: https://docs.companycam.com/docs/webhooks-1 and https://help.companycam.com/en/articles/6828353-using-companycam-s-legacy-api
- New API, keys, Applications: https://help.companycam.com/en/articles/15949273-building-custom-integrations-with-companycam-s-api
- Plan tiers: https://docs.companycam.com/docs/welcome

**Also available:** a CompanyCam **MCP Server (Beta)** that connects Claude Code directly to CompanyCam data. Useful for exploring Skybird's real projects during Phase 4 without writing throwaway scripts.
Source: https://help.companycam.com/en/articles/15928195-connecting-the-companycam-mcp-server-beta (linked from the article above)

**What this means:** Everything below is documented against the legacy API because that's what was publicly fetchable. The webhook scopes are now confirmed to carry over 1:1 (§1.3). Endpoint field shapes for Projects/Photos are very likely the same but weren't individually re-verified against the new reference — worth a spot-check during Phase 4, not a blocker before Phase 2.

### 1.2 Objects and fields (legacy v2, base `https://api.companycam.com/v2`)

> **Corrections from live data, 2026-09-16.** Three of the field notes below were written from the legacy docs and do not match what the current API returns for project `110848078`. Details and evidence in `07-phase-4-preflight.md` §2; summary here so nobody codes from the stale spelling:
>
> | Documented below | Actually returned |
> |---|---|
> | `featured_image[]` | **`feature_image[]`** — singular "feature", no "d". Same `{type, uri, url}` shape. Copying the wrong spelling yields `undefined`, not an error |
> | `integrations[]` present | **Absent entirely** on the test project — not an empty array. No automatic ProLine bridge via this path; re-check with the Application Key before closing §4.2 Q4 |
> | `description` usable as alt-text seed | **`null` on all four curated photos.** There is no caption data. **Decided 2026-09-16: alt text is generated from the ProLine job record** (`manufacturer`, `product_line`, `color`, `warranty`) plus the service-area city — not from CompanyCam at all. See `07-phase-4-preflight.md` §2.4.1, which also records the contract-upload approach as considered and rejected |

**Project** — `GET /projects/{id}`
Source: https://companycam.readme.io/reference/getproject.md

| Field | Notes for this build |
|---|---|
| `id`, `name` | Name is often the customer name — **never publish raw** |
| `address` | Full street address object — **PII, never publish; use `city`, `state`, `postal_code` only** |
| `coordinates` | lat/lon — useful for approximate map pin later |
| `featured_image[]` | Array of `original` / `web` / `thumbnail` URLs. **This is the "feature image" the brief asked about — it exists** |
| `notepad` | Free-text project notes |
| `primary_contact` | Name, email, phone — PII |
| `integrations[]` | `{type, relation_id}` — where a linked CRM's project ID lives. **If ProLine's native CompanyCam integration writes here, this is the CompanyCam → ProLine project ID bridge** (verify on a real project) |
| `slug`, `public`, `project_url`, `embedded_project_url` | Public-timeline stuff; not needed |
| `archived`, `status` | Filter out archived/deleted |

**Photo** — `GET /projects/{project_id}/photos`
Source: https://companycam.readme.io/reference/listprojectphotos.md

| Field / param | Notes |
|---|---|
| `uris[]` | `original` / `web` / `thumbnail` URLs on static.companycam.com |
| `internal` (bool) | "for internal use only and should not be used in marketing" — **hard filter: skip if true** |
| `description` | Photo caption; usable as alt text / caption seed |
| `captured_at` | Sort before/during/after |
| `processing_status` | Only use `processed` |
| `hash` | MD5 — dedupe |
| `?tag_ids=` | **Filter to photos with a given tag.** This is the photo-selection mechanism |
| `per_page` max 100 | Cursor or page pagination via `X-Next-Cursor` header |

**Labels vs. tags — terminology matters**
- **Project labels** = what the UI calls project tags. Endpoints: `GET/POST/DELETE /projects/{id}/labels`.
- **Photo tags** = tags on individual photos. Endpoints: `GET/POST /photos/{id}/tags`, plus company-wide `GET/POST /tags`.
- Source: https://companycam.readme.io/llms.txt (endpoint index)
- Known quirk: a forum thread reports `POST /projects/{id}/labels` returning existing labels rather than confirming the add. Test this. https://docs.companycam.com/discuss/6222240d8dc8a700a1fd04f1

### 1.3 Webhooks (legacy)

Source: https://docs.companycam.com/docs/webhooks-1

Events relevant to this build:

| Scope | Fires when |
|---|---|
| `project.label_added` | **A label is added to a project** ← Option A trigger |
| `project.updated` | Any project edit (noisy) |
| `photo.tag_added` | A tag is added to a photo |
| `photo.created` | Photo processed |
| `project.archived` | Could drive an "unpublish" later |

Mechanics:
- POST to your URL with `{event_type, created_at, payload, webhook_id}`; `payload` matches the object (a `project.*` event carries the Project).
- Must return exactly HTTP 200. Otherwise exponential backoff, max 10 attempts. **Webhook disabled after 25 total errors** (counter resets on success). n8n must ack fast and do work after.
- Signature: `X-CompanyCam-Signature` = base64 HMAC-SHA1 of raw body with the webhook `token`. Validate it.
- Create/list/update/delete via `/webhooks` endpoints.

**Confirmed 2026-09-14** against the live developers.companycam.com Webhooks page: the new API's `project.*` scope list is identical to legacy, including `project.label_added`, same retry behavior (200 required, exponential backoff, max 10 attempts, disabled at 25 total errors, counter resets on success).

### 1.4 Showcase data via API

Not present in the legacy endpoint index. Marketing Suite / showcases appear to be product-side only. **Assume no**, verify in the new portal, and design so it doesn't matter.

### 1.5 Rate limits and photo URL lifetime

- **GET 240/min · POST/PUT/DELETE 100/min**, 429 on exceed. Source: https://docs.companycam.com/docs/rate-limits
- One project pull ≈ 1 project GET + 1–2 photo GETs (per_page=100) + up to 20 image downloads from the CDN (not API calls). Nowhere near the limit.
- **Photo URL expiry: not documented.** URLs are plain `static.companycam.com/…jpg`. Do not depend on them regardless — **download into the WordPress Media Library** (brief §31 Q8). Reasons: SEO (images on skybirdroofing.net), no dependence on CompanyCam uptime or a future signed-URL change, and full control of alt text/filenames.

### 1.6 What John needs to do for CompanyCam

1. Log in to developers.companycam.com as an Admin.
2. Register an Application ("Skybird Website Sync"), then create an Application Key, **Read only** for Phase 4 (we only read projects/photos; the WordPress side does the writing).
3. Export the OpenAPI spec and the webhook events page; drop them in `docs/vendor/companycam/`.
4. Confirm Skybird's plan tier includes API access.
5. Pick one real, completed replacement project as the Phase 4 test project and note its project ID.

---

## 2. WordPress

Source (ACF REST): https://www.advancedcustomfields.com/resources/wp-rest-api-integration/
Source (CPT REST support): https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-rest-api-support-for-custom-content-types/ (WordPress core docs)

### 2.1 What's available

| Need | How |
|---|---|
| Create project page | `POST /wp-json/wp/v2/{rest_base}` on a custom post type registered with `show_in_rest => true`. Send `status: draft` |
| Upload photos | `POST /wp-json/wp/v2/media` (multipart, `Content-Disposition: attachment; filename=…`), then set `featured_media` and reference IDs in a gallery field |
| Custom fields | **ACF ≥ 5.11** exposes field groups in the same endpoints once "Show in REST API" is toggled on the group; write via an `acf` object in the POST body. Or native `register_post_meta(..., ['show_in_rest' => true])` if ACF isn't on the site |
| Taxonomies (Service, Location, Product, Warranty) | Register with `show_in_rest => true`; assign by term ID in the post body |
| Auth | **Application Passwords** (WordPress core since 5.6), Basic auth over HTTPS, generated per user. Create a dedicated `skybird-sync` user with an Editor-level role — it can create drafts but cannot publish others' posts or install plugins |
| Return URL | The create response includes `id`, `slug`, `link` — write `link` back to GHL/ProLine later |

### 2.2 Decisions that depend on Euan (do not pick before the call)

| Question | Why it matters |
|---|---|
| Theme + page builder (Elementor? Bricks? block editor?) | Determines whether the project template is a builder template or a PHP single template, and whether ACF fields render automatically |
| Is ACF (Pro?) already installed? | ACF vs native meta. ACF Pro gives Gallery + Repeater fields, which fit this exactly |
| Any security plugin (Wordfence, iThemes) restricting REST or Application Passwords? | Common cause of 401s |
| Is there a **staging site**? | Phase 4 should run there first |
| Who registers the CPT + taxonomies? | Must live in a **small custom plugin** (`skybird-projects`), not the theme, so a theme update doesn't delete it. Pitch Peak may want to own that plugin — fine |
| SEO plugin (Yoast/RankMath)? | Where the SEO title, meta description, and schema get written; both accept meta via REST |
| Permalink structure | Target `/projects/{slug}/` — confirm no collision with existing pages |

### 2.3 Data-model recommendation (answers §31 Q6–Q8, detailed in Phase 2)

- **CPT `project`**, rest_base `projects`, slug `/projects/`.
- **ACF**: ids (`companycam_project_id`, `proline_project_id`, `ghl_ambassador_contact_id`), location (`city`, `state`, `zip`, `neighborhood`), product (`manufacturer`, `product_line`, `color`, `warranty`), `completion_date`, gallery (before[], after[]), `referral_code`.
- **No custom DB tables** on the WordPress side. Everything is post + meta. Referral *records* don't live here (see §3).
- **Images downloaded** into Media Library, resized by WordPress, alt text set from photo description + city.

---

## 3. GoHighLevel

Source (API portal, webhooks): https://marketplace.gohighlevel.com/docs/ and https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/
Source (custom fields v2): https://marketplace.gohighlevel.com/docs/ghl/custom-fields/custom-fields-v-2-api/index.html
Source (hidden field → query parameter): https://help.attributer.io/articles/add-hidden-fields-to-gohighlevel-forms/ and https://www.ghlexperts.com/guides/how-to-pre-populate-gohighlevel-form-fields-url-parameters-buttons-and-javascript
Source (rate limits, secondary): https://ecosire.com/blog/gohighlevel-webhooks-api-integration

### 3.1 What's available (API v2)

| Need | How |
|---|---|
| Auth | **Private Integration Token** (per sub-account, generated in Settings) for a private build like this; OAuth is for marketplace apps |
| Contacts | Full CRUD, search, tags, custom fields |
| Custom fields | Custom Fields v2 API — create text/number/select fields; set values on contact create/update |
| Opportunities | Create in a pipeline/stage; custom fields on opportunities too |
| Outbound webhooks | 50+ events incl. contact created/updated/tag changed, opportunity status, appointment changes. Signature header; the old `X-WH-Signature` is deprecated as of Sept 1, 2026 — use the current header |
| Workflows | Trigger: **Inbound Webhook**; Action: **Custom Webhook** (POST to n8n). Both exist and are how n8n and GHL talk in either direction |
| Rate limit | ~100 requests / 10 s per location (secondary source; confirm in portal) |

### 3.2 The referral_code question (kickoff §5, brief §16)

**Yes**, a hidden form field can carry `referral_code`:
- Add a contact custom field `referral_code`.
- Drag it into the form, tick **Hidden**, set **Query Parameter** = `ref`.
- On submit it lands on the contact record and is available to workflows.

**Gotcha:** a GHL form embedded as an **iframe** reads the iframe's own URL, not the WordPress page URL, so `?ref=ABC123` on the project page never reaches the form.

Three fixes, in order of preference:
1. **WordPress appends `ref` to the iframe `src`** (tiny JS in the project template reads the cookie/param and rewrites the embed URL). Simple, keeps the GHL form.
2. Use GHL's **inline** embed script, which some accounts report can see the parent URL. Verify on Skybird's account.
3. **WordPress owns the form**, posts to n8n, n8n creates the GHL contact via API with all hidden values. Most control, most code. Hold for v2 unless 1 fails.

### 3.3 Where referral records should live (§31 Q10–Q11)

Recommend a **hybrid**, not "GHL only":
- **GHL** holds the relationship as contact custom fields on the *referred* lead: `referral_code`, `referrer_contact_id`, `referrer_project_url`, plus tags `Customer Referral` / `Ambassador Referral`. That's all GHL workflows need.
- **A small referral ledger owned by n8n** (a table in n8n's Data Tables, or a Google Sheet for v1) holds one row per referral: code, ambassador, project, lead, milestones reached, reward state, timestamps. This is what fraud checks and payouts read from. GHL custom fields are a poor place to keep an audit trail.

Phase 2 finalizes this.

---

## 4. ProLine

Source: https://help.proline.app/en/articles/9396729-integrations-zapier
Source: https://useproline.com/integrations/
Source (inbound webhook example): https://success.roofle.com/knowledge/proline-integration

### 4.1 What's available

| Need | What ProLine exposes |
|---|---|
| API key | **ProLine → Integrations → ProLine API**. Used by Zapier; presumably by n8n's HTTP node too |
| Public REST docs | **Not found.** Zapier app + help center are the documented surface. Direct endpoints are unverified — inspect the existing agency flow before assuming |
| Inbound lead | Web forms, **inbound webhooks** (ProLine gives you a URL per integration; RoofQuote PRO docs show the pattern), or Zapier "Create or Update Project" which accepts contact + project fields |
| Referral source field | Zapier's Create/Update Project maps "contact and event fields." Whether a custom "Referral Source" field is mappable is **unverified** — check ProLine's field list |
| Outbound: stage events | Zapier trigger **"Project Created or Updated"** fires on stage change, filterable by stage. Covers "inspection completed," "signed," "installed" *if those are ProLine stages* |
| Outbound: money events | **Payment complete / refund complete / chargeback complete** triggers — this is how "collected" would fire for the large reward |
| Outbound from workflows | ProLine Workflows have a **"Zapier Trigger" step**, so a workflow can push out on any step, not just stage change |
| CompanyCam link | ProLine has a **native CompanyCam integration**. If it writes to `project.integrations[]` in CompanyCam, the ProLine project ID is readable from the CompanyCam side — no separate lookup |

### 4.2 What John needs to find out (with Euan or from the ProLine account)

> **Update 2026-09-16 (Jacob). Q1 and Q4 are closed; do not work them.**
>
> The existing n8n → ProLine flow is the **SalesRabbit → ProLine → CompanyCam** automation: built years ago by people no longer at Skybird, and **SalesRabbit is being phased out entirely**. It is not the process to design against, and it should not be investigated.
>
> - **Q1 (what does the existing flow call?) — withdrawn.** The answer would describe a retiring system.
> - **Q4 (does the native integration populate `integrations[]`?) — answered: no, and it never will for new jobs.** There is no CompanyCam↔ProLine link at all going forward.
>
> Jobs now enter ProLine two ways, neither of which creates or links a CompanyCam project: **(a)** written up in GoHighLevel and sent to ProLine once booked, or **(b)** typed directly into ProLine by a rep in the field. Any future bridge must attach to one of those two moments — see `07-phase-4-preflight.md` §2.4.3 for the design constraint.
>
> **Q2 and Q3 stand**, and Q2 is now on the critical path for automated page copy. Both must be answered from the ProLine account directly rather than by reading an existing integration.

1. What does the existing n8n → ProLine flow actually call — a ProLine inbound webhook URL, the API key against a REST endpoint, or Zapier in the middle?
2. Does ProLine have a custom field on contacts/projects for lead source or referral source? Name it exactly.
3. Which ProLine stages correspond to: inspection completed · agreement signed · installed · paid in full.
4. Does the ProLine ↔ CompanyCam native integration populate `integrations[]` on the CompanyCam project? (Open one linked project via the API and look.)

---

## 5. Answers to brief §31, at a glance

| # | Question | Answer |
|---|---|---|
| 1 | CompanyCam endpoints | Projects, photos, labels, tags, webhooks all present (legacy). New spec to verify |
| 2 | Tag → webhook? | **Yes**: `project.label_added` (legacy). Verify in new API |
| 3 | Showcase event? | **No** evidence. Design around it |
| 4 | Featured photo via API? | **Yes**: `project.featured_image` |
| 5 | Photo tags readable? | **Yes**: `GET /photos/{id}/tags` and `?tag_ids=` filter |
| 6 | WP CPT structure | CPT `project` + 4 taxonomies (Phase 2) |
| 7 | Meta / ACF / tables | ACF (if installed) or native meta; **no custom tables** |
| 8 | Images | **Download to Media Library**; never hotlink |
| 9 | Referral code generation | Phase 2 (recommend short, non-guessable, e.g. 6–8 chars base32, no vowels) |
| 10 | Where referral records live | GHL custom fields + n8n-owned ledger (hybrid) |
| 11 | Ambassador ↔ referral in GHL | Custom fields on the referred contact pointing at the ambassador contact ID |
| 12 | Attribution across visits | Cookie + query param + hidden field (Phase 2) |
| 13 | Duplicates | Phase 2; first-touch wins, ledger dedupes on phone/email |
| 14 | Existing GHL contacts | Phase 2; if lead already exists and isn't "Lost," no referral credit |
| 15–16 | Reward stage | ProLine payment-complete trigger makes **collected** feasible. Jacob decides |
| 17 | Fraud / self-referral | Phase 2; block same phone/email/address as ambassador |
| 18 | Location precision | Jacob/John decide; API gives city/ZIP/coords so any option works |
| 19 | Schema markup | SEO plugin or `LocalBusiness` + `ImageObject` JSON-LD in the template (Phase 4) |
| 20 | Thin pages | Human review gate + minimum-content check before publish (Phase 3) |

---

## 6. Phase 1 gate — trigger recommendation

**Recommend Option A: CompanyCam project label `Website Showcase` → n8n → WordPress draft.**

Why over the others:
- Option A is where the photos already are; the person curating photos is already in CompanyCam. One tool, one action.
- A real-time event exists for it (`project.label_added`), so no polling needed — *if* the new API keeps it.
- Option B (GHL field) and C (ProLine status) put the trigger in a tool that doesn't hold the photos. Option D (admin tool) is more code and belongs in v2 once the flow is proven.

No polling fallback needed — `project.label_added` is confirmed live on the current API.

**Confirmed via live CompanyCam tool access (2026-09-14):** the object list exposed to the API/MCP tools is Projects, Photos, Labels, Tags, Checklists, Pages, Documents, Boards, Groups, Users, Webhooks — **no Showcase or Portfolio object exists anywhere in it.** CompanyCam Showcases (the curated galleries under Marketing, used today for the website widget/proof-of-work — built by Grok Bot in-browser) are a product-layer feature with no API surface. This build does not touch or replace that. Instead it reproduces the same curation judgment via tags, confirmed with John:

- **Photo tag `Showcase`** = this photo belongs in the curated set on the WordPress page. Applied per-photo to mirror actual Showcase curation: mostly during/after, one or two befores.
- **Photo tag `Showcase Cover`** = the one photo used as the page's featured image / social thumbnail (overrides `featured_image` if set).
- **Project label `Website Showcase`** = added once photo curation is done; this is the Option A trigger, fires `project.label_added`.
- `internal: true` = never included, even if tagged `Showcase`.
- Max 20 photos; sort by `captured_at`.

### Two decisions needed before Phase 2

1. **Trigger approval.** Confirm Option A as recommended, or pick otherwise. (CompanyCam access is done — the label webhook is confirmed live on the current API.)
2. **Euan call scheduled.** The WordPress and ProLine questions in §2.2 and §4.2 are his. Phases 2–3 can be drafted before that call, but Phase 4 cannot start until it happens.

Also still open, lower priority: register an Application + Application Key in the new portal (§1.6) and export the OpenAPI spec for `docs/vendor/companycam/` when convenient — not gating, since the trigger question is settled.

Nothing in this document requires code. No live systems were touched.
