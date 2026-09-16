# 07 — Phase 4 Preflight

Skybird Project Showcase + Referral System · Phase 4
Written 2026-09-16. Opens Phase 4 per `06-trigger-design.md` §5.

**Status: at a gate. No code written. Nothing on the live site touched.**

Phase 4's goal is one real CompanyCam project → one real WordPress draft. This document is the preflight: what was verified live, what contradicts the ground-truth docs, and what has to be answered before the first line of code.

---

## 0. Headline

1. **The CompanyCam side of the trigger is real and correctly staged.** Tags, label, curated photo set, and test project all verified live today against the current API (§1). Nothing on that side blocks Phase 4.
2. **The `project.label_added` webhook was never registered.** `06-trigger-design.md` §1 described this leg as proven end to end on 2026-09-14; confirmed with Jacob on 2026-09-16 that the test was a **manual pull** (§2.3). The delivery leg — subscription, label filtering, HMAC-SHA1 signature validation, fast ack — is unproven, and proving it is Phase 4's first deliverable.
3. **`01-api-audit.md` §2.2 could not be resolved by checking the live site.** `skybirdroofing.net` is blocked by this environment's network egress policy (§3). The research thread that produced `03-structure-signoff.md` §4 had that access; this session does not.
4. **Four smaller factual corrections to the Phase 1 docs** surfaced from live data (§2). All are the kind that break code silently if copied as written.
5. **The n8n question is not answerable from here either** (§5), but it reduces to two things someone can check in about five minutes from the n8n UI.

---

## 1. Verified live on CompanyCam, 2026-09-16

All via the CompanyCam MCP connector, authenticated as **Jacob Vollmer** (user `2870072`, role `admin`), company **Skybird Roofing** (`798255`). Read calls only; nothing was created, tagged, or modified.

### 1.1 The curation vocabulary exists, as designed

| Object | Type | ID | Created |
|---|---|---|---|
| `Showcase` | media tag (photo) | `27372163` | 2026-09-14T19:58:59Z |
| `Showcase Cover` | media tag (photo) | `27372182` | 2026-09-14T19:59:07Z |
| `Website Showcase` | project label | `27372191` | 2026-09-14T19:59:14Z |

This matches `06-trigger-design.md` §1 exactly. The three-object split (two photo tags + one project label) is live and is the only Showcase-related vocabulary in the account — confirming `01-api-audit.md` §6's finding that no Showcase/Portfolio API object exists.

### 1.2 The test project

**`Bill Najdecki #2561` — CompanyCam project ID `110848078`.**

| Field | Value |
|---|---|
| Label applied | `Website Showcase` ✅ |
| `status` / `archived` | `active` / `false` |
| `photo_count` | 419 |
| `address` | 2001 Silverleaf Drive, Youngsville, NC 27596 — **PII, never published** |
| `coordinates` | `36.07117119999999, -78.5582979` — true location, input to the §04 offset |
| `primary_contact` | name, email, phone present — **PII, never published** |
| `updated_at` | 2026-09-14T20:01:32Z (the label add) |
| `description` | `null` |

Service area: Youngsville — one of the 8 in `03-structure-signoff.md` §4.

### 1.3 The curated photo set

Filtering project `110848078` by tag `Showcase` returns **exactly 4 photos**. All four are `internal: false` and `processing_status: "processed"` — every one passes the `01-api-audit.md` §1.5 hard filter with nothing to exclude.

| Photo ID | `captured_at` | Also `Showcase Cover` | `description` |
|---|---|---|---|
| `3421903489` | 2026-07-30T13:50:32Z | — | `null` |
| `3547119850` | 2026-09-08T20:31:04Z | — | `null` |
| `3553007383` | 2026-09-10T14:12:05Z | **yes** | `null` |
| `3553086721` | 2026-09-10T14:46:54Z | — | `null` |

Filtering by `Showcase Cover` returns exactly one photo (`3553007383`) — the "one hero photo" rule holds in practice, not just on paper.

Sorted by `captured_at`, the shape is one photo from job start (2026-07-30, two days after the project was created) and three from the 09-08/09-10 completion window. That is the during/after-weighted set `06-trigger-design.md` §3 asks a reviewer to confirm.

**Two design details this surfaces:**

- **The cover is a member of the `Showcase` set, not separate from it.**
  **Decided 2026-09-16 (Jacob): cover + the 3 others.** The `Showcase Cover` photo becomes the WordPress featured image and social thumbnail; the on-page gallery renders the `Showcase` set *minus* the cover. No photo appears twice on the page.
  Implementation rule for Phase 4: `gallery = photos tagged Showcase, excluding the photo tagged Showcase Cover`, sorted by `captured_at` ascending. On this project that is 3 gallery photos (`3421903489`, `3547119850`, `3553086721`) plus `3553007383` as `featured_media`.
  Edge case to handle rather than assume away: if a project has **no** `Showcase Cover` tag, or **more than one**, the draft should fail the review gate loudly instead of silently picking one. `06-trigger-design.md` §3 already requires a reviewer to confirm the cover is a genuine hero shot — it cannot confirm a cover that the automation guessed.
- **`description` is `null` on all four.** See §2.4.

---

## 2. Contradictions with the ground-truth docs — flagged, not overridden

Per the working rule: these are reported here rather than silently corrected in the Phase 1–3 docs.

### 2.1 `feature_image`, not `featured_image`

`01-api-audit.md` §1.2 lists the Project field as `featured_image[]`. The live API returns **`feature_image[]`** — singular "feature", no "d". Same array-of-`{type, uri, url}` shape otherwise (`original` / `web` / `thumbnail`).

Copying the documented spelling into n8n produces a silent `undefined`, not an error. Worth fixing in `01-api-audit.md` once confirmed.

### 2.2 `integrations[]` is absent — the ProLine bridge does not work this way

`01-api-audit.md` §1.2 and §4.2 Q4 treat `project.integrations[]` as the candidate CompanyCam → ProLine project-ID bridge, flagged "verify on a real project."

**Verified: `GET` project `110848078` returns no `integrations` key at all** — not an empty array, absent entirely.

So `proline_project_id` in `05-data-model.md` §1 has no automatic source via this path. Caveat on how far to push this finding: this is the MCP connector's serialization of the project object, and a field could be omitted there without being absent from the raw REST response. Before declaring §4.2 Q4 closed, re-check with a direct `GET /projects/110848078` using the Application Key. Either way it is not the settled "already available" the data model assumes.

`proline_project_id` should stay in the schema (it costs nothing empty) but Phase 4 must not depend on populating it.

### 2.3 No `project.label_added` webhook is registered

`06-trigger-design.md` §1 and §6, and `01-api-audit.md` §0, describe the label → webhook → n8n leg as confirmed live and "proven working end to end on a real project the same day" (2026-09-14).

**The account currently has exactly three webhook subscriptions, none of them `project.*`:**

| ID | URL | Scopes | Enabled |
|---|---|---|---|
| `266047` | `handsome-salmon-665.convex.site/webhooks/companycam/video` | `video.created` | true |
| `266046` | `handsome-salmon-665.convex.site/webhooks/companycam/document` | `document.created` | true |
| `266045` | `handsome-salmon-665.convex.site/webhooks/companycam/photo` | `photo.created`, `photo.updated` | true |

All three predate this project (2026-08-03) and point at a Convex deployment, not n8n.

This does not contradict the *scope* being available — `project.label_added` is a valid scope per `01-api-audit.md` §1.3, confirmed against the live webhooks page. What is missing is the *subscription*.

**Resolved 2026-09-16 (Jacob): the 9/14 test was a manual pull.** The label was added and the project then fetched by hand. No webhook was ever registered, so nothing was torn down and nothing was delivered.

The consequence is the one that matters for planning: **the delivery leg is unproven, and proving it is Phase 4's first deliverable** — not a re-wiring of something known good. `06-trigger-design.md` §1 now carries the same correction. Concretely, Phase 4 step 1 is:

1. Create the `project.label_added` subscription pointed at the n8n production webhook URL, **capturing the signing token at create time** — it is shown once and never again (`01-api-audit.md` §1.3).
2. Prove a real delivery fires on a label add, and that n8n filters correctly: the payload carries the *project*, and seven other project labels already exist in the account (§1.1 lists only the Showcase vocabulary; the full list includes `Gutter Cleaning`, `JobNimbus Job`, `Pipedrive Deal` and four `… Lead` labels). A subscription to `project.label_added` fires for **any** label add, so n8n must check that the added label is `Website Showcase` before doing anything.
3. Prove `X-CompanyCam-Signature` validates as base64 HMAC-SHA1 of the **raw** request body — n8n must hash the raw bytes, not a re-serialized JSON object, or the signature will never match.
4. Prove n8n acks HTTP 200 quickly and does the work afterward, per the 25-error-disable rule.

Step 2 is the one most likely to be skipped and most likely to bite: without the label filter, tagging any project as a `Pipedrive Deal` would start building a WordPress draft.

**Also worth knowing before adding a fourth webhook:** `handsome-salmon-665.convex.site` is receiving every photo created in Skybird's CompanyCam. That may be entirely expected (a prototype, another vendor integration), but no doc in `docs/` mentions it. Flagging so it gets identified rather than assumed.

### 2.4 Photo `description` is null — there is no alt-text seed

`01-api-audit.md` §1.2 lists photo `description` as "usable as alt text / caption seed," and `01-api-audit.md` §2.3 says "alt text set from photo description + city."

All four curated photos have `description: null`. The curation workflow in use does not write captions.

Phase 4 therefore has to **generate** alt text from what is actually available — city/service area, product line, and shot type — rather than read it. This matters for the `06-trigger-design.md` §3 review check "no homeowner PII … including in image filenames/alt text if those were auto-generated from CompanyCam data": there is no CompanyCam-sourced text to leak, but there is also nothing to fall back on.

### 2.5 "#2561" is part of the project name, not the CompanyCam ID

All the handoff docs refer to the test project as "#2561". The CompanyCam project ID is **`110848078`**; `#2561` is a suffix in the project's *name* (`Bill Najdecki #2561`), almost certainly the ProLine/job number.

Any code, webhook filter, or n8n expression must key off `110848078`. Nothing looks up `2561`.

Incidentally, `2561` in the project name may be the ProLine job number the §2.2 `integrations[]` lookup was meant to find — if so, a name-parse is a cheap fallback bridge. Unverified; noting it, not proposing it yet.

### 2.6 A duplicate project exists at the same address

Searching `Najdecki` returns two active projects:

- `Bill Najdecki #2561` — `110848078`, 419 photos, created 2026-07-28, labeled
- `William Najdecki` — `49180918`, 10 photos, created 2023-04-16, unlabeled, same address (`2001 Silverleaf Dr`)

Not a Phase 4 blocker — the label disambiguates. It is a real consideration for the Phase 5 referral layer, where the ambassador is matched to a customer: matching on address or surname would hit both. Noting it now so it is not discovered later as a bug.

---

## 3. The blocker: this environment cannot reach the live site

The instruction for Phase 4 was to resolve `01-api-audit.md` §2.2 by checking the live site directly, the way `03-structure-signoff.md` §4 did, and escalate only what is genuinely Euan's.

**That is not possible from this session.** Outbound HTTPS is default-deny under this environment's network egress policy:

| Host | Result |
|---|---|
| `skybirdroofing.net` | `connect_rejected` — 403 to CONNECT |
| `api.companycam.com` | `connect_rejected` |
| `app.n8n.cloud` | `connect_rejected` |
| `developers.companycam.com` | blocked |
| `docs.n8n.io` | blocked |

Both available paths (direct request through the agent proxy, and the sanctioned fetch tool) return the same policy denial. Per the proxy's own guidance, a policy denial is reported, not worked around — so no attempt was made to route around it via caches, mirrors, or third-party readers.

**What still works:** the MCP connectors (CompanyCam, GitHub, Google Workspace). That is why §1 was possible and §3's checks were not.

**Decided 2026-09-16 (Jacob): allow the domains in the environment's network policy.**

The allowlist Phase 4 needs:

| Host | Needed for |
|---|---|
| `skybirdroofing.net` | §4.1 — resolving five of the seven §2.2 items, and later the WordPress REST writes |
| `api.companycam.com` | Direct API spot-checks with the Application Key (§2.2's `integrations[]` re-check) |
| `app.n8n.cloud` | Inspecting and building the workflow (§5) |
| `developers.companycam.com` | The current API reference and OpenAPI spec (`01-api-audit.md` §1.6 item 3) |
| `docs.n8n.io` | n8n roles, and the Data Tables plan question in §5 |

Network policy is set where the environment was created — see https://code.claude.com/docs/en/claude-code-on-the-web. **It will not take effect in this running session**; the change applies to a new session against the updated environment. Re-tested at the end of this session and all three primary hosts were still denied, which is expected.

So the working sequence is: update the environment → start a new session on this branch → §4.1 runs in a couple of minutes → only §4.2's two questions go to Euan. That restores the Phase 1–3 working mode that produced `03-structure-signoff.md` §4.

Should the allowlist turn out not to be available, the fallbacks are (a) run the §4.1 commands yourself and paste the output — no credentials needed, or (b) send all of §2.2 to Euan, which works but spends his attention on five items a public URL fetch answers for free.

---

## 4. Resolving `01-api-audit.md` §2.2

The seven open items split cleanly. Five are facts discoverable from the public site without credentials. Two are genuinely Euan's.

### 4.1 Discoverable without credentials — anyone, or this session once unblocked

Each is a plain GET. No login, no API key, read-only.

| # | §2.2 item | Check | What the answer looks like |
|---|---|---|---|
| 1 | ACF installed? | `GET /wp-json/` → `namespaces[]` | `acf/v3` present ⇒ ACF ≥5.11 active. Absent ⇒ native `register_post_meta` |
| 2 | SEO plugin | same `namespaces[]`; plus `/robots.txt` and `/sitemap_index.xml` vs `/wp-sitemap.xml` | `yoast/v1` ⇒ Yoast. `rankmath/v1` ⇒ Rank Math. `sitemap_index.xml` ⇒ Yoast/Rank Math; `wp-sitemap.xml` ⇒ core only |
| 3 | REST API reachable / Application Passwords | `GET /wp-json/` → `authentication` object | JSON root returns ⇒ REST not firewalled. `authentication.application-passwords` ⇒ App Passwords advertised |
| 4 | Security plugin blocking REST | response headers + behaviour of the above | 403/401 on `/wp-json/`, or a Wordfence/Cloudflare/Sucuri block page, is the answer. Clean JSON ⇒ nothing in the way at the anonymous level |
| 5 | Theme + page builder | homepage HTML: `wp-content/themes/{name}/`, `<meta name="generator">`, `elementor-*` / `bricks-*` / `wp-block-*` classes | Names the theme and whether it is Elementor, Bricks, Divi, or the block editor |
| 6 | `/projects/` collision | `GET /projects/` and `GET /wp-json/wp/v2/types` | 404 on `/projects/` ⇒ slug free. A real page ⇒ collision to resolve before registering the CPT. `types` also shows whether a `project` CPT already exists |

Two extras worth catching in the same pass, both already flagged in the Phase 1–3 docs:

- **The `-nc` suffix question** (`03-structure-signoff.md` §4, flagged for Euan): fetch `/service-areas/franklinton/` and `/service-areas/franklinton-nc/` and compare — a 301 between them settles which is canonical without asking him.
- **Staging site**: `staging.`, `dev.`, `stg.` subdomains resolving, or a `X-Pantheon`/`WPEngine`/Kinsta header on the live site naming the host. This narrows item 7 below but does not replace it — an unlisted or password-protected staging site will not show up this way.

Exact commands, once egress allows:

```bash
SITE=https://skybirdroofing.net
curl -sS "$SITE/wp-json/" | python3 -m json.tool | head -40   # items 1,2,3
curl -sSI "$SITE/wp-json/"                                     # item 4
curl -sS "$SITE/" | grep -oE 'wp-content/(themes|plugins)/[a-z0-9-]+' | sort -u   # items 1,2,5
curl -sS "$SITE/robots.txt"                                    # item 2
curl -sS -o /dev/null -w '%{http_code}\n' "$SITE/projects/"    # item 6
curl -sS "$SITE/wp-json/wp/v2/types" | python3 -m json.tool | grep -E '"(slug|rest_base)"'  # item 6
```

### 4.2 Genuinely Euan's — escalate these two, not all seven

**(7) Is there a staging site, and can we have access?**
Detection may hint at one; only Pitch Peak can confirm it exists, that it mirrors production, and grant access. `06-trigger-design.md` §5 makes staging the default venue for Phase 4, so this gates the first write.
*Ask:* "Is there a staging environment for skybirdroofing.net that mirrors production closely enough to test a new CPT and REST writes against? If so, can we get a login plus an Application Password for a dedicated user?"

**(8) Who owns the `skybird-projects` plugin?**
`01-api-audit.md` §2.2 explicitly leaves this open and says "Pitch Peak may want to own that plugin — fine."

*Recommendation: Skybird owns it; Pitch Peak reviews and installs it.* Grounds, all from existing docs:
- `handoff-buy-vs-build-decision.md` §Decision — the whole reason for building in-house is that Skybird owns the pages, the data, and the code. The CPT registration *is* the data model.
- `05-data-model.md` §1 — every meta field is a Phase 4/5/6 dependency. If Pitch Peak owns the plugin, each schema change becomes an agency ticket on someone else's queue.
- `02-euan-consultation-notes.md` §2 — Euan is already comfortable with Claude having admin access and creating pages without him in the loop, so this is not a trust escalation.

It ships from this repo as a versioned, reviewable artifact. Pitch Peak retains the install/activate decision on their own infrastructure, which is the part that is properly theirs.
*Ask:* "We'd like to own a small plugin (`skybird-projects`) that registers the `project` CPT, the service-area taxonomy, and its meta fields — versioned in our repo, delivered to you for review and install. Does that work, or would you rather own it?"

Also worth sending, though not from §2.2: `03-structure-signoff.md` §5 notes the **pin-precision question** is the one item still genuinely outstanding with Euan, and `handoff-buy-vs-build-decision.md` §Open items suggests sending him **Mr. Roofing's project page as the target reference**. Both fit in the same short message — one email, four items, rather than four emails.

---

## 5. n8n: can this workflow be built in Skybird's own account?

**Not determinable from here** — `app.n8n.cloud` is blocked (§3), `docs.n8n.io` is blocked, and there is no n8n connector in this session. Taking the instruction seriously not to assume either way, here is what actually decides it.

The relevant fact from the existing docs is narrow: `01-api-audit.md` §0 and §4.2 Q1 establish that an **agency-managed n8n → ProLine flow exists** and should be inspected before deciding how leads enter. Nothing in `docs/` says whether that flow lives in the same n8n instance as the account under `skybirdroof@gmail.com`.

**The question reduces to one thing: one instance or two?**

Log in to n8n as `skybirdroof@gmail.com` and check:

1. **Is the existing ProLine flow visible in this account?**
   - *Visible* ⇒ one shared instance. Now check the role shown under Settings → Users for `skybirdroof@gmail.com`. Owner/Admin ⇒ Skybird can build here, but the workflow shares an instance with agency-managed production automation, so coordinate before touching shared credentials. A lesser role ⇒ Pitch Peak's instance; needs their involvement.
   - *Not visible* ⇒ two separate instances. Skybird's own is free to build in, and the agency flow is a separate conversation that Phase 4 does not depend on.
2. **Can you create a credential and activate a workflow?** Settings → Credentials, and the Active toggle on a workflow. If both are available, the account can host this end to end.

**Why Phase 4 can likely proceed in Skybird's own account either way:** this workflow shares no credentials with the ProLine flow. It needs a CompanyCam Application Key and a WordPress Application Password, both new, plus a production webhook URL, which is per-instance. It does not read or write ProLine. That independence is the thing to confirm — and it is also the argument for building it in Skybird's instance regardless, consistent with the ownership rationale in §4.2(8).

**One caveat to verify rather than assume:** CompanyCam must be able to POST to the n8n production webhook URL, and n8n must be able to reach `skybirdroofing.net`. On n8n Cloud both are fine by default. On a self-hosted instance behind a VPN, neither is guaranteed. Check whether the account is Cloud or self-hosted — the URL shape tells you (`*.app.n8n.cloud` vs a custom domain).

Two things I could not verify and am flagging rather than stating: n8n's current role/permission tiers by plan, and whether the Data Tables feature `05-data-model.md` §4 assumes for the referral ledger is on the account's plan. Both were going to come from `docs.n8n.io`, which is blocked. The Data Tables question is Phase 5, not Phase 4 — but if it turns out to be plan-gated, `05-data-model.md` §4's "or a Google Sheet for v1" fallback is already written in.

---

## 6. Credentials — what is needed, when, and where it must not go

**The CompanyCam Application Key is not needed yet, and should not be sent into this session.** `api.companycam.com` is blocked from here (§3), so a key could not be used even if provided — and the read access Phase 4 needs is already available through the MCP connector, which is how everything in §1 was verified.

The key is needed **in n8n**, entered directly into an n8n credential by whoever builds the workflow. It should be pasted into n8n's credential store, never into this chat, a doc, a commit, or `.env` in this repo.

Same for the WordPress Application Password, once §4.2(7) is answered.

| Credential | Needed for | Lives in | Status |
|---|---|---|---|
| CompanyCam Application Key (Read only) | n8n → CompanyCam project/photo pulls | n8n credential store | Ready — hold until the n8n instance is settled (§5) |
| CompanyCam webhook signing token | HMAC-SHA1 validation of `project.label_added` | n8n credential store | Does not exist yet — shown once at webhook-create time (§2.3) |
| WordPress Application Password | n8n → WP draft + media upload | n8n credential store | Blocked on §4.2(7) |

Per `01-api-audit.md` §2.1, the WordPress user should be a dedicated `skybird-sync` account at Editor level — able to create drafts and upload media, unable to publish others' posts or install plugins. That is a request to make of Euan in the same message as §4.2(7).

Note the current CompanyCam MCP session authenticates as Jacob (`admin`), which satisfies `01-api-audit.md` §1.1's "Admins and Managers only" requirement for creating the Application Key — no separate access request needed.

---

## 7. Gate — what is needed before Phase 4 writes code

Per the working rule of stopping at gates rather than running ahead.

**Closed 2026-09-16 (Jacob):**

| # | Item | Resolution |
|---|---|---|
| 1 | Egress (§3) | Allow the five domains in the environment's network policy. Takes effect in a **new session**, not this one |
| 2 | Webhook discrepancy (§2.3) | The 9/14 test was a **manual pull**. The delivery leg is unproven and is Phase 4's first deliverable |
| 5 | Gallery/cover overlap (§1.3) | **Cover + the 3 others.** Cover is the featured image; the gallery excludes it |

**Still open:**

| # | Item | Owner | Blocks |
|---|---|---|---|
| 3 | n8n: one instance or two? (§5) | Jacob — two checks in the n8n UI, ~5 min | Where the workflow is built, and who can build it |
| 4 | Staging access + `skybird-projects` plugin ownership (§4.2) | Euan | Everything that writes to WordPress |
| 6 | Who owns `handsome-salmon-665.convex.site`? (§2.3) | Jacob/John | Nothing directly — but it is receiving every photo created in Skybird's CompanyCam, and no doc explains it. Worth identifying before adding a fourth webhook |

Item 3 unblocks building the trigger. Item 4 unblocks writing to WordPress. Item 6 is a question to answer, not a blocker.

**The critical path, once egress is live:** new session → run §4.1 (five §2.2 items resolved, ~2 min) → send Euan the §4.2 message (two questions + pin precision + the Mr. Roofing reference) → confirm the n8n instance → create the `project.label_added` subscription and prove the four steps in §2.3.

---

## 8. Repository

Contrary to the assumption that no repo existed, **`skybirdroof-sys/skybird-showcase-referral` already exists** and is what this session is working in — `main` plus the Phase 4 branch. No new repo was created. All eight Phase 1–3 documents are now committed under `docs/`, which is why this document can cite them by path.

Nothing in this document required code. No live system was modified.
