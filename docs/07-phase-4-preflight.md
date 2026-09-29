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
5. **n8n is settled: Jacob builds and activates the workflow himself** (§5). Phase 4's automation layer needs no Pitch Peak involvement.
6. **Alt text is sourced from the ProLine job record**, not CompanyCam photo descriptions (which are empty) and not a parsed contract (considered and rejected — §2.4.1).
7. **The CompanyCam↔ProLine bridge does not exist for new jobs** (§2.4.2) — confirmed absent, not merely unverified. The SalesRabbit-era automation that once linked them is retiring and is explicitly not to be designed against. The only link today is a hand-typed job number in the CompanyCam project name, present on 82% of projects. §2.4.2's sequencing keeps this off Phase 4's critical path; §2.4.3 records the design constraint for whenever a real bridge is built.

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

So `proline_project_id` in `05-data-model.md` §1 has no automatic source via this path.

**Closed 2026-09-16 (Jacob), and the reason is structural.** The original caveat here was that the MCP connector might simply be omitting a field present in the raw REST response, so §4.2 Q4 should stay open pending a direct `GET` with the Application Key. That check is no longer needed: **no CompanyCam↔ProLine link exists for new jobs at all** (§2.4.2), so there is nothing for `integrations[]` to carry. The field is empty because the integration is absent, not because the serialization hid it.

`proline_project_id` should stay in the schema — it costs nothing empty, and §2.4.3 identifies it as the right slot for a future bridge to fill. Phase 4 must not depend on populating it.

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

Phase 4 therefore has to **generate** alt text rather than read it. The decision on where the source data comes from is §2.4.1.

#### 2.4.1 Alt-text source — decided 2026-09-16 (Jacob)

**Source: the ProLine job record. Not CompanyCam photo descriptions, and not a parsed contract.**

Alt text is generated from `manufacturer`, `product_line`, `color` and `warranty` on the ProLine job, combined with the service-area city:

> `New GAF Timberline HDZ shingle roof, Charcoal, Wake Forest NC`

This aligns 07 with what the other docs already said, and isolates `01-api-audit.md` §1.2 as the outlier:

- `05-data-model.md` §1 already sources `manufacturer`, `product_line`, `color`, `warranty` from "the job record / ProLine."
- `06-trigger-design.md` §3's review checklist already says these fields must "match what was actually installed — **pull from the job record, don't guess from photos**."

So this is not a new dependency; it is the existing one, now also carrying alt text.

**Rejected, deliberately: uploading the customer's contract into the CompanyCam project and parsing it for product details.** Recorded here so it reads as a considered and closed decision rather than an oversight, and so it does not get re-proposed as an obvious shortcut later.

1. **It breaks the data-ownership rule.** CompanyCam owns photos; ProLine owns the job. A contract in CompanyCam blurs that boundary and duplicates job data across two systems that will drift out of sync. The build-in-house decision was substantially about owning clean data (`handoff-buy-vs-build-decision.md`); duplicating the job record into the photo system undercuts that.
2. **A contract carries exactly the PII this pipeline is built to exclude** — full name, exact street address, price. `06-trigger-design.md` §3 makes "no homeowner PII anywhere on the page, including in image filenames/alt text" a hard review check, and the brief's §24 rule is non-negotiable.

Worth adding to Jacob's second reason, because it is the part that would have bitten in implementation: the contract route would have put PII *into* the pipeline and then required a scrubbing step on every generated string to get it back out. Scrubbing is a control that fails silently — one unusual address format and a street address ships in an `alt` attribute. Sourcing from structured product fields means **the PII is never in the pipeline to begin with**, so there is nothing to scrub and nothing to fail. That is a materially stronger privacy posture, not just a tidier one.

**The dependency this creates, and why it is not yet safe to assume — see §2.4.2.**

#### 2.4.2 The CompanyCam↔ProLine bridge does not exist — confirmed, not merely unverified

**Updated 2026-09-16 (Jacob). This supersedes the earlier "unverified, needs checking" framing.**

There is **no CompanyCam↔ProLine link for new jobs**. Not undiscovered, not misconfigured — absent.

- The old **SalesRabbit → ProLine → CompanyCam** automation was built years ago by people no longer at Skybird, and **SalesRabbit is being phased out entirely**. It is not the process to design against, and per Jacob it should not be investigated further. `01-api-audit.md` §4.2 Q1 ("what does the existing n8n → ProLine flow actually call?") is therefore **withdrawn, not answered** — the answer would describe a system being retired.
- Going forward, jobs enter ProLine exactly two ways:
  1. **Written up in GoHighLevel first**, then sent to ProLine once the job is booked.
  2. **Typed directly into ProLine** by a rep in the field who finds a new customer.
- **Neither path creates or links a CompanyCam project.** So given a CompanyCam project, nothing in either system identifies the corresponding ProLine job.

This also explains §2.2's finding rather than leaving it a puzzle: `integrations[]` is absent on the test project because **there is nothing to populate it**. The suggestion there to re-check via the Application Key can be dropped for any recent project — the field's emptiness is structural, not a serialization artifact. (Pre-SalesRabbit-retirement projects may still carry a populated `integrations[]`; irrelevant, since those are not the jobs being showcased going forward.)

The second obstacle is unchanged and still open: **ProLine's read API is undocumented.** `01-api-audit.md` §4.1 states plainly that public REST docs were not found and direct endpoints are unverified; the documented surface is the Zapier app and help center. Whether `manufacturer` / `product_line` / `color` / `warranty` are readable per job — and under what field names — is `01-api-audit.md` §4.2 Q2. That question survives this update intact, and now has to be answered from the ProLine account directly rather than by reading an existing integration.

**The name-parse bridge: checked, and weaker than it looks.** §2.5 suggested that parsing the trailing `#NNNN` from the CompanyCam project name could bridge to ProLine without `integrations[]`. Measured against the 100 most recently updated projects on 2026-09-16:

| | Count | Median photos | Zero-photo |
|---|---|---|---|
| Name ends in `#NNNN` | 82 | 28.5 | 31 |
| No number | 18 | 49.0 | 1 |

Job numbers run 2588–2676 across this page, all distinct — consistent with a sequential per-job counter, and consistent with the test project's `#2561` being slightly older.

**But the convention is not enforced, and the exceptions are not junk.** The initial assumption was that unnumbered projects would be informal stubs. The opposite holds: unnumbered projects have a *higher* median photo count (49 vs 28.5) and almost none are empty (1 of 18, against 31 of 82). They are substantive projects that simply never got a number. Examples from the page: `Jamie Payton`, `Lisette Lopez`, `Phillip Smith`, `Angelica Juarez`. Job numbers are also **not** strictly monotonic with project creation date, so the number is assigned by some ProLine-side event rather than at CompanyCam project creation.

**What the job number actually is, given that no automation links the two systems.** If nothing writes the ProLine job number into CompanyCam, then a person is typing it into the project name by hand. That reframes the measurement above: the 82% is not a partially-working integration, it is **a manual convention with an 18% miss rate**, and it is currently the *only* link of any kind between a CompanyCam project and a ProLine job.

It also explains both anomalies. The 18% without a number are cases where someone didn't type it — which is why they look like ordinary substantive projects rather than stubs. And the numbers aren't monotonic with CompanyCam creation date because the number is assigned by a ProLine-side event and transcribed later, not generated when the CompanyCam project is made.

**Conclusion: a name parse is a usable hint, not a bridge — and it will not become one.** It resolves roughly 4 in 5 projects and fails silently on the rest, and the ones it fails on are exactly the well-photographed projects most likely to be showcase candidates. A hand-typed field will not get more reliable by being depended on. Treat a parsed `#NNNN` as a pre-filled lookup key when present, and require the reviewer to supply or confirm the ProLine job when it is absent.

Still worth asking John whether the number is *meant* to be universal — but the question has changed shape. It is no longer "is this a bridge we can rely on" (it isn't) but "is the 18% a data-hygiene problem worth fixing in the interim, while a real bridge is designed." Given that the reviewer is in the loop for Phase 4 either way, probably not urgent.

**Recommended sequencing, so this does not become a Phase 4 blocker:**

Phase 4's stated goal is one CompanyCam project → one WordPress **draft**, with a human review gate before publish. `06-trigger-design.md` §3 *already* requires a reviewer to verify product/color against the job record. So for the Phase 4 MVP:

- Build the draft with the product fields **empty**, and the reviewer fills them from ProLine at the existing review step. No new gate — the human was already required to check exactly these fields.
- Generate alt text at **publish** time from whatever is in the fields, with a deliberately PII-free fallback when they are empty: `Completed roof replacement in Youngsville, NC`. Accurate, useful, and safe by construction.
- Prove the ProLine read path as its own piece of work, then swap manual entry for the automated pull. Nothing in the page template changes when that lands.

This keeps Phase 4's scope where the kickoff doc put it — one project, one draft, end to end — instead of expanding it into "first, build an integration that does not exist." The 2026-09-16 update makes this the clear call rather than a preference: with the bridge confirmed absent, putting the ProLine pull inside Phase 4 would mean designing and building a new cross-system link before producing a single draft page.

#### 2.4.3 Design constraint for the bridge, whenever it is built (Phase 5/6+)

Not to be solved now. Recorded so the constraint is known before anyone starts, rather than discovered partway in.

Any future CompanyCam↔ProLine bridge must attach to one of the **two real job-entry paths**, because those are the only moments a job comes into existence:

1. **GoHighLevel → ProLine**, at the point the job is booked.
2. **Direct entry into ProLine** by a rep in the field.

Three consequences follow, and they rule out most of the obvious approaches:

- **The trigger is ProLine-side or GHL-side, never CompanyCam-side.** A CompanyCam project cannot look up a ProLine job it was never told about. The link has to be *created* when the job is created, pushing outward — not resolved later by matching.
- **Path 2 has no GHL record to hang anything off.** A design that assumes every job passes through GoHighLevel will silently drop every rep-entered job. Both paths need covering, or the gap needs to be an accepted, stated limitation.
- **Matching on address or customer name is not a substitute.** §2.6 already found two active CompanyCam projects at the same address under variants of the same name. Fuzzy matching would have to be right about which one, without a human present.

The likely shape, for whoever picks this up: on job creation in ProLine, create or locate the CompanyCam project and stamp the ProLine job ID somewhere structured — `05-data-model.md` §1's `proline_project_id` already has the slot, and stamping it at creation is what makes the hand-typed `#NNNN` convention unnecessary rather than merely unreliable.

#### 2.4.3.1 Parallel effort: Production HQ sheet retrofit — tracked, not available

**Status as of 2026-09-16: in progress, unfinished, explicitly not to be built against.** Recorded here only so it is not rediscovered later as a surprise, and so that when it does land it gets evaluated rather than adopted by default.

Jacob has a separate effort running through **Grok Bot** (Skybird's other automation — the same one that maintains the CompanyCam Showcases referenced in `01-api-audit.md` §6) to retrofit the **Production HQ sheet** with real ProLine job numbers and CompanyCam project IDs across **196 real job rows**, plus a daily check for new rows going forward.

If it completes and verifies, it may turn out to be a cleaner source than the ProLine API path for both the bridge question (§2.4.2) and product/colour enrichment (§2.4.1). **That is a later decision. Nothing in Phase 4 should assume it exists.**

Two distinctions worth having written down *before* that decision is taken, because they are easy to lose once a populated sheet is sitting there looking authoritative:

- **A backfilled lookup table is a reconciliation, not a bridge.** §2.4.3's constraint is about the moment a job is created — the link has to be *made* then, pushing outward from ProLine or GHL. A sheet that maps job number ↔ project ID after the fact solves *lookup* for rows that already exist; it does not make new jobs linked at creation. The daily check is polling, so it carries a lag, and a project showcased before its row is reconciled still has nothing to read. That may be perfectly acceptable — showcasing happens well after a job completes — but it should be an accepted property, not an unexamined one.
- **Its accuracy depends on what the retrofit matched on.** If the 196 rows were reconciled using the hand-typed `#NNNN` in CompanyCam project names, the result inherits that convention's 18% miss rate (§2.4.2) rather than fixing it, and the misses will be invisible in a populated-looking sheet. If it matched some other way, that way is the interesting part. Worth asking when it lands: *what did it match on, and what happened to rows it could not match?*

The verification bar, when the time comes: spot-check a sample against ProLine directly, and confirm how unmatched and ambiguous rows are represented — blank, flagged, or guessed. §2.6's duplicate (two active CompanyCam projects at one address under variants of one name) is a good adversarial test case.

A further consideration for whoever takes the later decision: `05-data-model.md` §0 deliberately puts the five entities in three homes. Reading page-build data from a fourth (a Google Sheet) is a real architectural choice, not a free shortcut — defensible if the sheet is treated as a *source* that n8n reads once at draft time and writes into WordPress meta, less so if the page ever depends on it at render time.

**What this does *not* affect:** Phase 6's reward triggers. Those depend on ProLine stage and payment events reaching n8n (`01-api-audit.md` §4.1), and on tying a referral to a GHL contact — neither of which touches CompanyCam. The missing bridge is an *enrichment* problem (product, color, warranty for page copy and alt text), not a *reward-triggering* problem. Worth keeping those separate so this does not read as a blocker for Phase 6 planning.

### 2.5 "#2561" is part of the project name, not the CompanyCam ID

All the handoff docs refer to the test project as "#2561". The CompanyCam project ID is **`110848078`**; `#2561` is a suffix in the project's *name* (`Bill Najdecki #2561`), almost certainly the ProLine/job number.

Any code, webhook filter, or n8n expression must key off `110848078`. Nothing looks up `2561`.

Incidentally, `2561` in the project name is very likely the ProLine job number the §2.2 `integrations[]` lookup was meant to find. Measured across 100 projects in §2.4.2: the convention holds for 82% but is not enforced, and the exceptions are substantive projects — so it is a hint, not a bridge.

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

> **Correction, 2026-09-17 — "allow the domains" is not a thing this environment can do, and my earlier framing was wrong.**
>
> Jacob allowed the domains and they are still denied. Checking why: the account has exactly one environment, `env_01V7bhQTYY1xs9kY9SrNbK8Q`, named **"Default - trusted network access"**. That is a *preset*, and its permitted set is a fixed curated list of development hosts — the proxy reports it as `api.anthropic.com`, `registry.npmjs.org`, `jsr.io`, `pypi.org`, `files.pythonhosted.org`, `index.crates.io`, `proxy.golang.org` and loopback/cluster addresses. Nothing else.
>
> So there is no per-domain allowlist to add `skybirdroofing.net` to. Reaching arbitrary hosts requires **changing the environment's network setting itself** (to an unrestricted option) or creating a second environment with one, and then starting a session under it. I described this as "allow the domains … see the docs," which implied a per-domain list that does not exist on this preset. The distinction matters because the first is a checkbox and the second is a policy decision about what this environment may reach.
>
> **This does not block Phase 4.** Everything verified so far came through MCP connectors, which are unaffected. What it blocks is *me* running the live-site checks and driving a sandbox directly — see §4.1, which is why those items went to Euan instead.

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

> **Superseded in practice, 2026-09-17 (Jacob).** All of §4.1 has been folded into the message to Euan (`08-euan-questions.md`), drafted and awaiting send. The split below still describes the right *method*, and §4.1 remains the fastest way to verify or re-check any of these later — but the items are no longer being held back from him.
>
> Two reasons: we cannot answer them from here while egress is blocked (§3), and for most of them his answer is genuinely better than a public fetch. A fetch shows `acf/v3` but not whether it is **ACF Pro** — which decides whether Gallery and Repeater exist or have to be built by hand (`01-api-audit.md` §2.1). A fetch shows whether *anonymous* REST works, not whether a security plugin restricts Application Passwords, which is the thing that will actually break. Worth remembering for later escalations: "can I look it up?" and "is looking it up as good?" are different questions.

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

**Resolved 2026-09-16 (Jacob): he builds and activates the workflow himself.** He has built in n8n before, and the account under `skybirdroof@gmail.com` can host this end to end. Phase 4 proceeds on that basis — no Pitch Peak involvement needed for the automation layer, which matches the ownership rationale in §4.2(8).

**The outstanding sub-check is withdrawn, 2026-09-16 (Jacob).** An earlier version of this section proposed inspecting the existing agency-managed ProLine flow as the fastest route to "how do we read a ProLine job record," on the theory that a working integration beats undocumented API reference.

**Do not do this.** That automation is the SalesRabbit → ProLine → CompanyCam flow: built years ago by people no longer at Skybird, and SalesRabbit is being phased out entirely (§2.4.2). Reading it would describe a retiring system and risk designing against it. `01-api-audit.md` §4.2 Q1 is withdrawn rather than answered.

Whether that flow happens to be visible in Jacob's n8n account is therefore no longer interesting for this build. Phase 4 needs nothing from it. ProLine's read path (§4.2 Q2) has to be established from the ProLine account directly.

The original determination procedure is kept below, since it still applies to the outstanding sub-check.

---

Background, retained: this was **not determinable from this session** — `app.n8n.cloud` is blocked (§3), `docs.n8n.io` is blocked, and there is no n8n connector here.

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
| 3 | n8n (§5) | **Jacob builds and activates it himself.** No Pitch Peak involvement in the automation layer |
| 5 | Gallery/cover overlap (§1.3) | **Cover + the 3 others.** Cover is the featured image; the gallery excludes it |
| 7 | Alt-text source (§2.4.1) | **ProLine job record.** Contract-upload into CompanyCam considered and **rejected** — data-ownership boundary, and it would put PII into the pipeline that then had to be scrubbed back out |
| 8a | CompanyCam↔ProLine bridge (§2.4.2) | **Confirmed absent for new jobs**, not unverified. SalesRabbit-era automation is retiring and is not to be investigated. §4.2 Q1 and Q4 are withdrawn/closed. Design constraint for a future bridge recorded in §2.4.3 |
| 3b | Agency ProLine flow in Jacob's n8n (§5) | **Withdrawn.** Nothing in Phase 4 needs it |

**Still open:**

| # | Item | Owner | Blocks |
|---|---|---|---|
| 4 | Staging access + `skybird-projects` plugin ownership (§4.2) | Euan | Everything that writes to WordPress |
| 8b | **ProLine read path** (`01-api-audit.md` §4.2 Q2): are `manufacturer` / `product_line` / `color` / `warranty` readable per job, and under what names? Must now be established from the ProLine account directly | Jacob/John | The *automated* product and alt-text pull. Does **not** block the Phase 4 draft, per §2.4.2's sequencing |
| 6 | Who owns `handsome-salmon-665.convex.site`? (§2.3) | Jacob/John | Nothing directly — but it receives every photo created in Skybird's CompanyCam and no doc explains it. Worth identifying before adding a fourth webhook |

**Tracked, not open:** the Production HQ sheet retrofit (§2.4.3.1) — 196 job rows being backfilled with ProLine job numbers and CompanyCam project IDs via Grok Bot, plus daily checks. In progress and **not to be built against**. It may later supersede item 8b as the enrichment source; that decision waits until it is finished and verified, against the criteria in §2.4.3.1.

Item 4 unblocks writing to WordPress. Item 8b is parallel work, not a gate. With the bridge confirmed absent, widening Phase 4 to include the ProLine pull would mean building a new cross-system integration before producing a single draft page — so the sequencing in §2.4.2 is now the clear call rather than a preference.

**The critical path, once egress is live:** new session → run §4.1 (five §2.2 items resolved, ~2 min) → send Euan the §4.2 message → Jacob creates the `project.label_added` subscription in his n8n and proves the four steps in §2.3 → build the draft with product fields filled at the existing review gate (§2.4.2) → prove the ProLine read path separately and swap manual entry for the automated pull.

---

## 8. Repository

Contrary to the assumption that no repo existed, **`skybirdroof-sys/skybird-showcase-referral` already exists** and is what this session is working in — `main` plus the Phase 4 branch. No new repo was created. All eight Phase 1–3 documents are now committed under `docs/`, which is why this document can cite them by path.

Nothing in this document required code. No live system was modified.

---

## 9. Pre-run re-verification, 2026-09-18

Re-checked live against CompanyCam immediately before the first n8n run,
because §1 was recorded on 2026-09-16 and the curation could have drifted.
Read-only throughout; nothing was written.

### 9.1 The test project is still in the assumed state

| | |
|---|---|
| Project | `110848078` · Bill Najdecki #2561 |
| Address | 2001 Silverleaf Drive, **Youngsville, NC 27596** |
| Coordinates | `36.07117, -78.55830` — real, present |
| Labels | **exactly one**: `Website Showcase` (id `27372191`) |
| Photos on project | 419 |
| `Showcase` (`27372163`) | **4 photos** |
| `Showcase Cover` (`27372182`) | **1 photo** (`3553007383`) |
| All four | `internal: false`, `processing_status: processed` |

`city` is `Youngsville`, so `Curate` derives `areaSlug = youngsville`, which
matches the seeded term. The back-link will resolve to
`/service-areas/youngsville-nc/`.

### 9.2 Two things that would have broken the first run, both already handled

**The cover is also tagged `Showcase`.** Photo `3553007383` appears in both
filtered lists, so the naive read of "4 Showcase + 1 Cover" is wrong — it is
4 total, one of which is the cover. `Curate` already excludes it
(`capped.filter((p) => p.id !== cover.id)`), so the page gets 1 cover and
**3** gallery photos, with nothing appearing twice. Confirmed against the
node source, not assumed.

**Three of the four photos have `coordinates: {lat: 0, lon: 0}`.** Only
`3421903489` — the one Jacob took himself — carries real coordinates. Had
the pin offset been computed from photo coordinates, three runs in four
would have placed the pin in the Gulf of Guinea. `Curate` takes the offset
from `project.coordinates`, which is populated and correct. Also confirmed
against the source.

Neither was a latent bug. Both are recorded because the *data* makes them
look like bugs on inspection, and the next person reading the curated set
will have the same alarm.

### 9.3 `completion_date` will be populated on this run

`Curate` derives it from `cover.captured_at` — `2026-09-10`. So the first
draft's eyebrow will read **"Completed September 2026"**, which is the
non-redundant case the template was fixed for on 2026-09-18. The empty-date
case that exposed the duplication bug will not reproduce here.

### 9.4 No `project.label_added` webhook exists — §2.3 still holds

Three webhooks are registered on company `798255`, none of them ours:

| id | URL | Scopes | Enabled |
|---|---|---|---|
| 266045 | `handsome-salmon-665.convex.site/webhooks/companycam/photo` | `photo.created`, `photo.updated` | yes |
| 266046 | `handsome-salmon-665.convex.site/webhooks/companycam/document` | `document.created` | yes |
| 266047 | `handsome-salmon-665.convex.site/webhooks/companycam/video` | `video.created` | yes |

All three created `2026-08-03T13:28:26Z`, all `authorization_header_set:
false`. This answers the standing open item "who owns
`handsome-salmon-665.convex.site`" only partially — it identifies *what it
receives*, not who runs it. **Every photo and video event on the account is
being delivered to a Convex deployment nobody in this project has
identified.** That is a data-egress question for Jacob, independent of
Phase 4. It does not block this build: the scopes do not overlap with
`project.label_added`, and CompanyCam's 25-error disable threshold is
per-subscription, so a failing Convex endpoint cannot disable ours.

---

## 10. The `/shenzhou/` staging clone has no working rewrites, 2026-09-21

Verified from an incognito browser, so these are the responses n8n would get.

| URL | Result |
|---|---|
| `/shenzhou/?rest_route=/` | ✅ JSON |
| `/wp-json/` (live site) | ✅ JSON |
| `/shenzhou/wp-json/` | ❌ **the live site's branded 404** |
| `/shenzhou/wp-json/wp/v2/projects` | ❌ same |
| `/shenzhou/sample-page/` | ❌ same |

An ordinary page 404s too, so **no pretty permalink resolves on the clone**.
This is not REST-specific and not caused by the plugin.

### Why, and why the permalink flush did nothing

`/shenzhou/wp-json/` is not a real directory, so it needs a rewrite to reach
the clone's `index.php`. With the clone's subdirectory `.htaccess` missing or
carrying the wrong `RewriteBase`, Apache falls through to the **root**
`.htaccess`, which hands the request to the **live** WordPress — which has
never heard of that path and serves its own 404. The live branding on the
error page is the tell, and it is what distinguishes this from a REST problem.

Settings → Permalinks → Save rewrites the rules *in the database*. The broken
part is the `.htaccess` file, so the flush cannot touch it. Done anyway, twice,
to rule it out.

`?rest_route=` works because `/shenzhou/?rest_route=/` resolves to
`/shenzhou/index.php` by DirectoryIndex, with no rewriting involved.

### What was done about it

The four WordPress nodes now call `?rest_route=`, which needs no rewrite and
works on production as well — so this is a compatibility improvement, not a
staging-only patch. See `n8n/README.md`.

### What is still limited

The plugin's `/projects/{slug}/` pages need that same rewrite and **will 404
on staging**. Rendering was verified on a sandbox (§ `11` Rendering) but the
thing staging was chosen for — Hub Child instead of a block theme, and the
shortcode inside WPBakery — can only be checked via a form that needs no
rewrite:

```
https://skybirdroofing.net/shenzhou/?p=<post-id>&preview=true
```

That renders the single-project template through the real theme, which is the
part worth seeing. The pretty URL itself is not what needs proving here —
production's rewrites work, and the live `/wp-json/` check above shows the
root `.htaccess` is intact.

### Worth telling Pitch Peak, not worth blocking on

Their staging clone is half-functional: the admin works, the REST API works,
and every front-end URL 404s. Same category as the `/shenzhou/` noindex
question — a courtesy flag, not a dependency. Phase 4 has a way around it.

---

## 11. The delivery leg fired for the first time, 2026-09-22

Webhook `282006` created against the n8n production URL, scope
`project.label_added`, `authorization_header_set: true`. A real label add on
project `111393392` (Bill Pate #2601) produced a real delivery.

### 11.1 The four things a first run had to prove (§2.3) — three proven

| | |
|---|---|
| Delivery fires on a label add | ✅ CompanyCam's own delivery log: `success: true` |
| n8n acks fast enough that the error counter never moves | ✅ **200 in 542 ms** |
| The caller is authenticated | ✅ Header Auth matched; an unauthenticated POST never reaches the workflow |
| The filter rejects the other seven labels | ⏳ not yet exercised on a real non-matching delivery |

The third row replaces the original `X-CompanyCam-Signature` criterion, which
`docs/06-trigger-design.md` withdrew on 2026-09-18 when the HMAC check was
replaced with Header Auth.

**This was the unproven leg the whole phase existed for.** The 9/14 test was a
manual pull; nothing had ever been delivered.

### 11.2 The payload shape is not what the legacy docs said

Captured verbatim in `docs/vendor/companycam/project.label_added-payload.json`.

```
{ event_type, created_at, webhook_id,
  payload: { project: {...}, label: {...} } }
```

`01-api-audit.md` §1.3 says "`payload` matches the object (a `project.*` event
carries the Project)". **It does not.** The project sits one level deeper, under
`payload.payload.project`.

Reading it a level too shallow gave `projectId: ''`, which built a request to
`https://api.companycam.com/v2/projects//labels` — note the double slash — and
returned 404. **That 404 looked exactly like a dead base URL**, and was briefly
diagnosed as one. It was not: the resolved URL shown under the node's URL field
is what settled it. `event_type` resolving correctly while `projectId` came
back empty is the tell that the envelope is right and the inner shape is wrong.

### 11.3 The event carries the label, so the fetch fallback is demoted

`payload.payload.label` is the label that was just added — `value`,
`display_value`, `tag_type`. `06-trigger-design.md` assumed this had to be
fetched, and `n8n/README.md` recorded the question as unverified.

The event's label is **strictly more precise than the fetch**, which is why
this is an improvement rather than just a simplification:

- `GET /projects/{id}/labels` answers *"does this project carry Website
  Showcase at all"*. That is true when someone adds `Gutter Cleaning` to a
  project showcased last month — a false positive the idempotency check would
  then have to catch.
- The event answers *"which label was just added"*. That is the actual
  question `project.label_added` is asking.

`Check Label` now reads the event's label. `Fetch Project Labels` and
`Re-check Label` remain as a fallback for the payload changing shape again,
reached only when the event carries no label at all, and `Re-check Label`
carries a comment saying why it is the weaker test.

### 11.4 Three smaller corrections from the same payload

**`integrations[]` is present in webhook payloads.** §2.2 recorded it as
"absent entirely" based on the API's project response. In the webhook payload
it is present:

```json
"integrations": [ { "type": "ProLine", "relation_id": null } ]
```

This refines §2.2 rather than reversing it. ProLine is a *declared* integration
type on the project, with **`relation_id: null`** — declared but unlinked. That
is consistent with Jacob's 2026-09-16 statement that the CompanyCam↔ProLine
bridge does not exist for new jobs: the slot is there and nothing is in it.
There is also a top-level `integration_relation_id: null`. Neither gives a
ProLine job id, so §2.4.2 stands and nothing here populates the product fields.

**Photo URLs have moved host.** §1.5 records "plain `static.companycam.com/…jpg`".
The webhook payload returns `img.companycam.com/<hash>/rs:fit:4032:4032/q:80/<base64>.jpg`
— an image-proxy form with transformation parameters in the path. The REST API
still returns `static.companycam.com` URLs with `?d=4032x4032`. So the two
surfaces disagree, and neither is worth depending on: §1.5's decision to
download into the WordPress Media Library already covers this, and `Curate`
takes its URLs from the API response rather than the payload.

**Timestamps differ by surface.** The webhook payload uses Unix integers
(`created_at: 1790047740`); the REST API returns ISO 8601 strings. Nothing
currently reads a timestamp from the payload — `Curate` derives
`completionDate` from the cover photo's API `captured_at` — but anything added
later must not assume one format.

### 11.5 Operational notes from the same session

**Removing and re-adding a label in the UI can silently do nothing.** An
attempt on project `110848078` produced no delivery, and the project's
`updated_at` was still `2026-09-14T20:01:32Z` afterwards — the removal never
registered, so the re-add was a no-op and CompanyCam correctly sent nothing.
Verify label state before concluding a trigger failed to fire.

**A rejected delivery leaves no execution.** Header Auth is enforced by n8n
before the workflow runs, so a 403 produces no execution entry at all. When
nothing appears in Executions, check CompanyCam's delivery log — it
distinguishes "never sent", "sent and rejected", and "sent and accepted", none
of which look different from inside n8n.

---

## 12. WordPress Application Passwords do not authenticate — both sites, 2026-09-22

The run reaches `Already Drafted?`, the first WordPress call, and stops there.

```
400 rest_invalid_param  "Invalid parameter(s): status"
  └─ details.status: rest_forbidden_status "Status is forbidden." (401)
```

The outer 400 is a wrapper. The inner code and status are what matter:
WordPress returns **401** when it sees no logged-in user and 403 when it sees
one lacking permission. 401 means the request arrives unauthenticated.
`status=any` is only permitted for a user who can edit, so it is refused.

### 12.1 What was ruled out, and how

| Hypothesis | Ruled out by |
|---|---|
| Wrong/mangled Application Password (the `%`) | A freshly generated one failed identically. Twice, on two sites |
| `skybird-sync` lacks the role | Inner status is 401, not 403. A wrong role authenticates and then forbids |
| Staging's broken `.htaccess` | **Production fails identically**, and production's rewrites work |
| The plugin is not installed on production | The error names the `status` param, so WordPress resolved the `projects` route. `rest_no_route` would mean not installed |
| A bad retry | Confirmed on a fresh delivery, not a retry. See §12.3 |

Isolated with the `status` parameter removed entirely:

```
GET https://skybirdroofing.net/?rest_route=/wp/v2/users/me   (Basic Auth)
  → "Authorization failed" / "You are not currently logged in."
```

Nothing simpler exists to test. The credential is correct and WordPress does
not see it.

Corroborated from WordPress's own side: on staging, the Application Password
row shows **Last Used: —** and **Last IP: —**. Those columns only populate on a
successful authentication. It has never authenticated once.

### 12.2 The two remaining causes, and why they need different fixes

**A. The `Authorization` header never reaches PHP.** WordPress's stock
`.htaccess` contains only rewrite rules. Passing that header through needs a
separate directive WordPress never writes:

```apache
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
```

Under Apache with mod_php the header arrives natively; under CGI/FastCGI/PHP-FPM
it is dropped without that line. This is a **server-config** fix.

**B. Application Passwords are disabled** on the install, via the
`wp_is_application_passwords_available` filter. Plenty of plugins and snippets
do this, not only security ones. This is a **WordPress-side** fix.

Distinguished by the REST index at `/wp-json/`: an `authentication` object
containing `application-passwords` means the feature is live, so cause A. An
empty one means cause B.

Euan confirmed no security plugins (`09`, Second reply §1), which was accurate
and does not cover this — the profile page shows an "Editorial Notifications"
section, so something is extending user features.

### 12.3 n8n's retry replays upstream node outputs — a real trap

"Retry from node with error" re-reads the **failing node's own parameters**
from the saved workflow and fetches **credentials live**, but replays the
**stored outputs of upstream nodes**. So a change to `Config` — which is where
`wpBase` lives — is invisible to a retry, and the retried run keeps calling the
old URL no matter what has been saved.

Cost an entire cycle: `wpBase` had been correctly changed to production and the
retry kept resolving to `/shenzhou/`, which read as the edit not having taken.

**The rule:** change anything upstream of the failure → fire a fresh delivery.
Change the failing node or a credential → retry is valid.

This is also why the fresh-password tests were sound. Credentials are not
cached, so those retries genuinely exercised the new password.

### 12.4 What this blocks, and what it does not

Blocked: every WordPress write. `Already Drafted?`, `Upload Media`,
`Get Area Term`, `Create Draft` — four of the 23 nodes, and the last four in
the chain.

Not blocked, and now proven: the delivery leg (§11), Header Auth on the
webhook, the payload parse, the label filter, and the plugin's REST routes,
which answer correctly on production for unauthenticated reads.

**This is not a code problem.** Nothing in the plugin or the workflow can make
a stripped header arrive. The next step is whichever of §12.2's two causes the
REST index points to, and both are outside this repo.

### 12.5 Resolved: cause A, and the host is WP Engine

`https://skybirdroofing.net/wp-json/` returns:

```json
"authentication": { "application-passwords": { "endpoints": ... } }
```

So the feature is **enabled**. Cause B is out; it is cause A — the
`Authorization` header is not reaching PHP.

The same response lists a **`wpe/cache-...`** REST namespace. That is WP
Engine's must-use plugin: **the site is hosted on WP Engine.**

That reframes both of tonight's blockers as one cause:

- WP Engine serves through **nginx**. There is **no `.htaccess`**, so the
  directive in §12.2 cause A has nowhere to live, and Settings → Permalinks
  had no file to write — which is why saving it changed nothing for
  `/shenzhou/` (§10). The rewrite diagnosis in §10 was right about the
  *symptom* and wrong about the *mechanism*.
- The header pass-through is likewise an nginx-level concern, not a file
  anyone with FTP can add.

**The ask, and it is not ours to action:** the WP Engine environment must pass
the `Authorization` header through to PHP so REST Application Passwords
authenticate. WP Engine support can confirm and enable this per environment.
The account is Pitch Peak's, so the request goes through Euan.

Two things to include when asking, because they pre-empt the first round of
support questions:

1. `/wp-json/` already advertises `application-passwords`, so the feature is
   on and the request is not "please enable Application Passwords".
2. `GET /?rest_route=/wp/v2/users/me` with a valid Application Password over
   Basic Auth returns `You are not currently logged in.`, and the password's
   **Last Used** column stays empty — so the credential is never evaluated.

**WP Engine ticket `#8642797`, escalated 2026-09-22.** Updates go to
skybirdroof@gmail.com. Quote that number to pick up the chat where it left off.
The evidence sent is §13.1's wrong-password test. First-line's initial position
was that the platform forwards `Authorization` by default — true as a
description of the default, not an inspection of this environment, which is
what §13.1 asks them to do.

**Originally raised 2026-09-22; escalated after two rounds.** Their
first-line assistant escalated rather than answering, confirming this needs
environment-level inspection. Support's first reply was an account-visibility
question — `skybirdroofing.net` does not appear under Jacob's User Portal
account in their lookup — so the technical question has not been reached yet.
Jacob can see the install in the portal (`skybirdroof`, Production), which
suggests the site sits on an account he has delegated access to rather than
one he owns, most likely Pitch Peak's. Two portal checks done first, both read-only and
both negative, and both are in the ticket so support does not re-ask:
**Web rules** and **Redirect rules** are empty on this environment, so nothing
custom is stripping the header — the behaviour is platform default.

**If WP Engine will not pass the header**, the fallback is an alternative
credential path rather than a code change to the pipeline, and it should be
weighed carefully: a shim that authenticates from a custom header is writing
our own authentication, which is a much worse trade than waiting for a
platform setting. Do not build one without a decision recorded here.

---

## 13. Proof the `Authorization` header never reaches PHP, 2026-09-22 01:20

WP Engine's first reply said their platform forwards `Authorization` and that
the evidence did not point to a platform limitation. Fair, given what they had.
This is the test that settles it.

### 13.1 The discriminator

Run from a browser console **on `https://www.skybirdroofing.net`** — canonical
host, no redirect, no integration in the path:

```javascript
// 1. A correct Application Password
fetch('/wp-json/wp/v2/users/me', {
  headers: { Authorization: 'Basic ' + btoa('skybird-sync:<correct>') }
}).then(r => r.json()).then(console.log)
// → 401 {code: "rest_not_logged_in", message: "You are not currently logged in."}

// 2. A deliberately wrong one
fetch('/wp-json/wp/v2/users/me', {
  headers: { Authorization: 'Basic ' + btoa('skybird-sync:thisiswrongonpurpose') }
}).then(r => r.json()).then(console.log)
// → 401 {code: "rest_not_logged_in", message: "You are not currently logged in."}
```

**Byte-identical responses.** That is the whole argument.

`wp_authenticate_application_password()` returns **`incorrect_password`** —
"The provided password is an invalid application password" — when it reads a
header and the password does not match. Getting `rest_not_logged_in` for a
*wrong* password means WordPress never ran that check, because
`$_SERVER['PHP_AUTH_USER']` / `HTTP_AUTHORIZATION` was not populated.

A credential cannot be rejected if it is never read. The header is not arriving.

### 13.2 Everything eliminated, in order

| Hypothesis | Eliminated by |
|---|---|
| Mangled password (the `%`) | Fresh passwords on both sites, correct shape — 24 chars, alphanumeric, six groups of four |
| Wrong role | 401 not 403; and now, no auth attempt at all |
| Staging's broken rewrites | Production fails identically |
| Application Passwords disabled | `/wp-json/` advertises `application-passwords` |
| WP Engine page cache | Fails on the `/wp-json/` path form too, not just `?rest_route=` |
| **Cross-origin redirect dropping the header** | Tested directly on `www.` with **no** redirect. Still fails |
| n8n's credential or client | Reproduced in a browser console, no n8n involved |
| The credential being wrong | A *deliberately wrong* password returns the identical error |

### 13.3 A correction to §12.1

§12.1 claimed an empty **Last Used** proves the credential is "never evaluated
rather than rejected". **That was wrong.** WordPress writes `last_used` only on
success, so a rejected password leaves it empty too. That column does not
distinguish the two cases and part of the original argument rested on it.

§13.1's wrong-password test is what actually distinguishes them, and it reaches
the same conclusion by sound reasoning rather than lucky reasoning.

### 13.4 The near-miss worth keeping

The first browser test ran from `skybirdroofing.net` (no `www`) and the console
showed the request landing on `https://www.skybirdroofing.net/...`. A redirect
had occurred, and browsers and HTTP clients drop `Authorization` across a
cross-origin redirect — which `example.com` → `www.example.com` is.

That was a genuinely strong hypothesis, it explained every symptom, and n8n
would have been vulnerable to it too (`followRedirect: true`, and
`Config.wpBase` was set without `www` while WP Engine lists
**www.skybirdroofing.net** as the primary domain).

It was wrong — the `www` test failed identically. But **`wpBase` should carry
the `www` regardless.** Hitting the canonical host directly avoids a redirect
on every one of the four WordPress calls, and removes a real failure mode from
the pipeline whatever else is going on.

### 13.5 Follow-up sent 2026-09-23

No substantive reply in ~30 hours. The only mail from WP Engine was an
automated chat transcript at 2026-09-22 05:44 UTC; no engineer has written.

Chased on the ticket, restating §13.1's wrong-password result so whoever picks
it up does not have to read the transcript, and asking for a status and ETA.

**If this stalls**, the options in order of preference:

1. Escalate through Euan — the WP Engine account is Pitch Peak's, and an
   account owner's chase carries more weight than a delegated user's.
2. Ask WP Engine directly whether an environment-level change is available,
   or whether this needs the account owner to request it.
3. Only then reconsider §12.5's warning about a custom-header auth shim — and
   record the decision here first. It has not become a better idea for having
   waited.

### 13.6 Automated follow-up, from 2026-09-27

Still no human reply on #8642797. WP Engine's last contact was the chat on
2026-09-22; Jacob chased on 09-23; a second chase went out 09-27.

An 8-hourly Routine (`trig_01BiAjtzayK78C5XeHbfRGVE`) now reads the ticket
thread and, while there is no human reply, sends a follow-up stating elapsed
time since their last contact and since the previous chase. On a real reply it
notifies Jacob, summarises what it means, records the outcome here, and
disables itself. After three unanswered follow-ups it recommends escalating
through Euan (§13.5) but does not act on it.

Cadence was Jacob's call. The risk flagged at the time: repeated replies to a
Zendesk ticket can reset queue position or be merged as duplicates, so daily
would apply similar pressure with less downside. Noted here so the trade-off
is on the record rather than rediscovered.

### 13.7 Email is not a support channel for WP Engine — 2026-09-28

The 09-27 follow-up did not reach anyone. It did not even land on #8642797.

Replying to WP Engine's Zendesk mail **auto-created a new ticket, #8651413**,
and returned a canned auto-reply:

> Emails received via "support@wpengine.com" do not go into Zendesk, so we need
> to ask you to please login to the User Portal and initiate a Live Chat.
> ... we only provide support through our User Portal, at https://my.wpengine.com

So both follow-ups — 09-23 and 09-27 — were almost certainly never read by a
person. **Support is Live Chat only**, from inside the portal.

This is the likeliest reason #8642797 has sat untouched: the original ticket
was created by chat and escalated, but every chase since went into a channel
that discards them.

**Correcting the plan.** The 8-hourly Routine no longer sends email. It now
only reads the thread and notifies Jacob if a human ever replies, ignoring the
autoresponders. Chasing means Jacob opening a Live Chat and quoting #8642797,
or Euan pushing it as account owner (§13.5).

**Where this came from.** The follow-up mechanism was mine, and I built it on
the assumption that replying to a Zendesk notification threads back onto the
ticket — normally true, and not true here. The 09-23 chase failed the same way
and nobody noticed for four days, which is exactly the failure mode worth
recording: a channel that silently discards messages looks identical to a
support team that is ignoring you.

**Cleanup:** #8651413 is a junk ticket created by this. Worth mentioning in the
Live Chat so it can be merged or closed rather than left open.

---

## 14. §12 and §13 were wrong. The header was always arriving — 2026-09-28

WP Engine support ran the request from their side and got **200**. Then the
same request ran from Jacob's own machine, own network, with curl:

```
curl.exe -i -u "SkybirdRoofing:<app password>" \
  "https://www.skybirdroofing.net/wp-json/wp/v2/users/me"

HTTP/1.1 200 OK
X-Pass-Why: auth
cf-cache-status: BYPASS
{"id":3,"slug":"skybirdroofing",...}
```

`X-Pass-Why: auth` is WP Engine's cache bypassing *because it saw the
Authorization header*. Application Passwords work on this site and always did.
Nothing was ever stripped.

### 14.1 What actually happened

Every failing test was `fetch()` in a browser console **while logged into
wp-admin on the same origin**. That sends WordPress's auth cookies, and:

1. `determine_current_user` runs `wp_validate_auth_cookie` at priority 10,
   which identifies the user from the cookie.
2. `wp_validate_application_password()` runs at priority 20 and opens with
   *"Don't authenticate twice"* — `if ( ! empty( $input_user ) ) return
   $input_user;`. **The Application Password is never evaluated.**
3. `rest_cookie_check_errors` then requires an `X-WP-Nonce` for a
   cookie-authenticated REST request. `fetch` sent none, so authentication is
   discarded and the response is `rest_not_logged_in`.

curl sends no cookies, so step 1 finds nobody, the Application Password is
evaluated normally, and it works.

### 14.2 The reasoning error, precisely

§13.1's whole argument was: a correct password and a deliberately wrong one
return byte-identical `rest_not_logged_in`, therefore WordPress never read the
header, therefore the header never arrived.

The first two steps were right. **The third did not follow.** "WordPress never
read the header" has two possible causes, and only one was considered:

- the header never arrived — assumed; and
- something authenticated the request *before* the Application Password check
  could run — the actual cause, and not considered at all.

The test was genuinely decisive about *where* the failure was — before the
password comparison — and I read that as proof of *why*.

### 14.3 The near-miss

On 2026-09-22 the instruction given with that test was: *"confirm the returned
user is `skybird-sync`. If it comes back as you, that's your admin session
answering and the test is void — rerun it in incognito."*

So the cookie interfering was anticipated. What was missed is that a cookie
does not have to succeed to invalidate the test — it pre-empts the Application
Password and *then* fails the nonce check, producing an error that looks
exactly like the one being investigated. The guard was written for the wrong
failure shape, and the test was never rerun in incognito.

### 14.4 Rules this earns

**Never test an Application Password from a browser on a site you are logged
into.** Use curl, or a private window with no session. The cookie wins before
the credential is read.

**A test that isolates *where* something fails does not thereby explain *why*.**
§13.1 correctly located the failure before the password comparison and then
treated a single explanation for that as established.

**Six days of a support ticket rested on it.** WP Engine's first-line answer —
that the platform forwards `Authorization` by default — was correct, and was
argued against with confident, wrong evidence. The escalation was polite and
well-documented and should not have happened.

### 14.5 Where this leaves the build

Nothing to fix in the plugin, the workflow, WordPress, Cloudflare or WP Engine.
Next step is `docs/11-resume-here.md`: a fresh Application Password for
`skybird-sync`, **verified with curl**, into the n8n credential; `wpBase` to
`https://www.skybirdroofing.net`; restore `Already Drafted?`'s URL; fire the
trigger on Bill Najdecki (110848078).

n8n's own failure was never tested against a credential known to be good — the
only verification available at the time was the browser test, which could not
have passed whatever the credential. It may already work.

---

## 15. First successful end-to-end run — 2026-09-28

A `Website Showcase` label on project `110848078` produced a WordPress draft.
All 23 nodes green. Draft contents verification follows separately.

### 15.1 The real cause of the n8n failure: an HTTPS→HTTP redirect

`Config.wpBase` was `https://skybirdroofing.net` — no `www`. That host 301s:

```
HTTP/1.1 301 Moved Permanently
Location: http://www.skybirdroofing.net/wp-json/wp/v2/users/me
```

Note the scheme: **`http://`**, not `https://`. Every HTTP client — curl,
axios, n8n, browsers — refuses to forward an `Authorization` header across an
HTTPS→HTTP downgrade. So the credential was stripped at the first hop on every
request n8n ever made, and WordPress genuinely never saw it.

Fixed by setting `wpBase` to `https://www.skybirdroofing.net`, the canonical
host, which takes no redirect at all.

### 15.2 Two independent faults, each masking the other

This is why it took six days.

| | |
|---|---|
| **Fault A** | `wpBase` lacked the `www`, so n8n's requests took an HTTPS→HTTP redirect that stripped the credential |
| **Fault B** | Every manual test was `fetch()` in a browser logged into wp-admin, where the auth cookie pre-empts the Application Password and then fails the nonce check (§14) |

The `www` theory was raised on 2026-09-22 and **discarded because a browser
test against `www` also failed** — a failure caused entirely by Fault B. A
correct hypothesis was rejected on evidence from an unrelated bug.

Had either fault existed alone it would have been found in an hour. Together,
each one produced the symptom that appeared to rule the other out, and the
combination survived six days, three support agents and an escalated ticket.

### 15.3 What would have caught it

**curl, from the first test.** It sends no cookies (kills Fault B) and shows
the redirect chain (kills Fault A). Every genuinely informative test in this
whole episode was a curl; every misleading one was a browser console.

The `?probe=` marker, the access-log correlation, the `$_SERVER` probe file —
all elaborate instrumentation for a question one plain `curl -i` answers.

**Rule earned:** to test an HTTP request, reproduce it with the simplest client
that can make it. A browser is not that client — it carries sessions, cookies,
and its own redirect and header policies. Reach for curl first, not fourth.

### 15.4 The run "succeeded" and created nothing

Immediately after §15.1's fix the workflow reported **success** — and produced
no draft. `GET /wp/v2/projects?status=any` returned zero projects.

`Already Drafted?` asks WordPress whether a project already exists for this
CompanyCam ID. WordPress answers with a JSON **array**. n8n's HTTP Request node
splits an array response into one item per element, so the normal case — no
existing draft, `[]` — yields **zero items**, and every node downstream is
skipped. n8n then marks the execution successful, because nothing failed.

The condition on `Is New?` was `$json.length === 0`, written assuming the array
would arrive as a single item to inspect. It never does. So the check only let
the workflow continue when a draft *already existed* — precisely inverted, and
the inversion was invisible because the failing case produced no error.

**Fixed:**

- `Already Drafted?` has **Always Output Data** enabled, so an empty response
  still emits one (empty) item.
- `Is New?` now tests `{{ !$json.id }}` — true for that empty item (no draft,
  proceed), false when a real project object came back (drop).

**Worth noting as a class of bug.** Every failure before this one announced
itself with a red node. This one reported success. A workflow that does nothing
and calls it success is worse than one that errors, and the 23-node structural
validation in this repo could never have caught it — it checks reachability and
syntax, not what a node does with an empty array at runtime.

### 15.5 The same bug twice more, in `Curate` and `Build Payload`

With `Is New?` fixed, the run got as far as `Curate` and stopped there:

```
Cannot assign to read only property 'name' of object
  'Error: Node 'Get Cover Photo' hasn't been executed'
```

The outer sentence is an n8n quirk — it fails while wrapping the real error —
and the real error is the quoted one. Two faults produced it, and a third was
waiting behind them.

**Fault 1 — two branches, one input.** `Get Project` fanned out to both
`Get Showcase Photos` and `Get Cover Photo`, and both connected to `Curate`'s
single input. That is not a join. n8n runs a node as soon as **any** incoming
branch delivers, so `Curate` fired the moment the showcase fetch returned,
while the cover fetch had not run yet — hence "hasn't been executed". Had the
timing gone the other way it would have run `Curate` *twice*, and the second
pass would have created a duplicate draft.

Fixed by running the two fetches in series:
`Get Project → Get Cover Photo → Get Showcase Photos → Curate`. Cover first,
deliberately: it returns exactly one item, so the showcase fetch runs once. The
other order would fire the cover fetch once per showcase photo.

**Fault 2 — `.first().json` on a list.** Underneath Fault 1, `Curate` opened:

```js
const showcaseRes = $('Get Showcase Photos').first().json;
const showcase = showcaseRes.data || showcaseRes || [];
```

This is §15.4's rule again. The CompanyCam photo endpoints return a JSON
**array**, n8n splits it into one item per photo, and `.first().json` is
therefore the first **photo object** — not the list. `showcase.filter` would
have thrown `showcase.filter is not a function` the instant Fault 1 was fixed.
Now `.all().map((i) => i.json)`, filtered on `.id` to drop the empty sentinel
that Always Output Data emits.

**Fault 3 — `Build Payload`, not yet reached.** Identical mistake:
`/wp/v2/service-areas?slug=…` returns an array, and `Array.isArray(areaRes)`
was being asked of a single term object. It would have thrown
*"No service_area term for slug 'youngsville'"* — a message pointing at
CompanyCam data or a missing taxonomy term, when nothing was wrong with either.
Found by reading forward rather than by running into it.

`Get Cover Photo`, `Get Showcase Photos` and `Get Area Term` all now have
**Always Output Data** on, for the §15.4 reason: without it, an empty response
skips the rest of the branch and the run reports success having built nothing.
With it, the empty item reaches the Code node and the intended loud error
fires — *"no photo tagged Showcase Cover"* instead of silence.

#### One rule, four bugs

`Already Drafted?`, `Curate`'s cover reference, `Curate`'s showcase list and
`Build Payload`'s term lookup are four expressions of a single fact about n8n:

> **An HTTP Request node splits a JSON array response into one item per
> element.** A four-element array is four items, `.first().json` is the first
> *element*, and an empty array is **zero items** — which n8n treats as "this
> node produced nothing", skipping the rest of the branch while the execution
> still reports success.

Every node in this workflow that calls an endpoint returning a list is subject
to it. Structural validation cannot see it: the JSON is well-formed, every node
is reachable, and the expressions are valid JavaScript.

#### What now catches it: `tests/test-workflow.js`

Thirty assertions, `node tests/test-workflow.js`, no n8n and no network. It
reads the workflow JSON, pulls the `jsCode` out of each Code node and runs it
against fixtures shaped like the real responses, through a ~20-line emulator
whose only real job is to model the array-splitting rule above.

It checks the **wiring** as well as the code — that exactly one node feeds
`Curate`, that the two fetches are in series, and that every node whose
response can be an empty array has Always Output Data set. Those four
assertions alone would have caught Fault 1 by reading the file.

And it pins the rules the docs require, which until now nothing verified
outside a live run:

- no homeowner name, address, email or phone reaches `Curate`'s output, the
  generated filenames, or the draft payload — asserted against a fixture that
  *does* carry all four, so the absence means something;
- the true coordinates are never passed onward, and the offset pin lands in the
  0.2–0.3 mi annulus on **2,000** consecutive draws, in all four quadrants
  (one draw proves nothing about a random offset);
- `internal: true` and still-processing photos are excluded;
- `status` is always `draft`;
- every curation problem throws — no cover, two covers, a cover-only set, an
  empty set, missing coordinates, a failed upload, an unmatched service area.

Each of the three fixes was verified by reinstating the bug and watching the
suite fail: Fault 1 fails 3 assertions, the missing Always Output Data fails 1,
and `.first().json` fails 23.

---

## 16. The first real draft, and the PII it published — 2026-09-28

The workflow ran end to end at **01:19:48**. Four photos uploaded, filenames
correct and PII-free:

```
Skybird-roof-youngsville-110848078-cover.jpeg   id 1173
Skybird-roof-youngsville-110848078-1.jpeg       id 1176
Skybird-roof-youngsville-110848078-2.jpeg       id 1174
Skybird-roof-youngsville-110848078-3.jpeg       id 1175
```

Every node behaved as designed. **And the homeowner's name and street address
went onto a public URL anyway.**

### 16.1 What was published

Attachment **1175** is a photograph of a *Landing* post-installation quality
checklist on a clipboard, shot on the job. Printed form, handwritten entries:
homeowner's full name, full street address with town and ZIP, inspector's name,
signature, dates. All legible at full resolution.

It sat at
`/wp-content/uploads/2026/09/Skybird-roof-youngsville-110848078-3-scaled.jpeg`
for roughly two hours before anyone looked. Confirmed fetchable from outside
the network, unauthenticated.

**Removed 2026-09-28.** Deleted permanently from the Media Library, then
verified from outside the network: original, `-scaled`, every generated
thumbnail, the REST record and the `.webp` variants all 404.

Deleting the attachment was not sufficient on its own. The first check
afterwards still returned **200** on the `-scaled` copy, with
`cf-cache-status: HIT`, `age: 649` and `cache-control: max-age=31536000` — a
one-year TTL, so it would never have expired by itself. The same URL with a
random query string returned 404, which is what proved the file was off disk
and the 200 was purely Cloudflare. A *Quick clear all cache* in WP Engine
cleared it; the URL now answers `404` with `cf-cache-status: BYPASS`.

**Worth keeping:** on a cached site, deleting a file does not unpublish it, and
the deletion UI gives no sign of that. Always re-fetch the real URL from
outside the network afterwards, and always with a cache-buster — a plain
re-fetch will cheerfully serve you the copy you are trying to destroy.

The other three are clean and were checked image by image, not by filename: the
cover is an aerial of the finished roof with no house number or plate visible;
`-1` is a close-up of the old shingles; `-2` is a crew member mid-tear-off.

### 16.2 Why the automation let it through

It did what it was told. The photo carries the `Showcase` tag, `internal` is
`false`, `processing_status` is `processed`. Every filter in `Curate` passed it
because every filter was satisfied.

The tag was the mistake, and the tag is a human's. `docs/06-trigger-design.md`
§3 already anticipates exactly this — *"not warranty/QA documentation"* is in
the reviewer's checklist in as many words. **But that checklist runs before
*publish*, and this never needed publishing to leak.**

### 16.3 The actual design fault: a draft does not protect its files

This is the part that is ours, and it is a genuine hole in the guarantee this
whole phase is built on.

> **"Nothing publishes automatically" was only ever true of the post.**

WordPress attachments are files on disk under `/wp-content/uploads/`, served
directly by nginx. They have a URL the moment `POST /wp/v2/media` returns, and
that URL does not care about the status of any post. A draft post is invisible;
its attachments are not. The media went up at 01:19:48 — **before** `Create
Draft` ran, **before** any human could have looked at anything, and the review
gate was never positioned to catch it.

The gate protects the page. The files go up first. Nothing in `docs/05`,
`docs/06` or `docs/10` noticed the gap, because all three reason about the
*post* as the unit of publication.

### 16.4 Options, and the one worth taking

| | |
|---|---|
| **A. Gate the upload, not the post** | Split the workflow: `Curate` builds a draft with no media and a list of candidate photo URLs; a human approves the set; a second workflow uploads and attaches. The gate moves in front of the only irreversible step |
| **B. Upload into a protected directory** | Move files on publish. Fights WP Engine's nginx rules and every image-size regeneration in WordPress |
| **C. Auto-reject document-shaped photos** | A classifier guessing "is there writing in this". It will miss one, and a miss is a leak |

**A is the only one that closes it.** B and C both leave the automation writing
files nobody has looked at into a public directory; they just make it less
likely to matter. C is worth having *in addition* — never as the control.

Not implemented yet. It changes the shape of Phase 4's deliverable, so it is a
decision for Jacob, recorded here rather than taken.

### 16.5 Something is writing AI alt text onto uploads

Found incidentally, and it is how the checklist was caught at all. WordPress's
stored `_wp_attachment_image_alt` on these four uploads is populated with
generated descriptions of the image *contents*:

> *"Skybird Roofing logo with 'The Landing' post-installation checklist on a
> clipboard, handwritten name and address filled in."*

The workflow sets no alt text. `docs/07` §2.4.1 and
`plugin/skybird-projects/includes/template.php` both assume alt is generated at
**render** time from ProLine product fields, and that CompanyCam image content
never reaches it. A plugin on the live site is doing otherwise.

Two consequences:

1. **`skybird_projects_image_alt()` may not be what ships.** If the plugin
   writes the `alt` attribute at render, the stored value wins wherever the
   theme or a block renders the image instead.
2. **It can transcribe PII directly.** This one described a name and address
   without reproducing them. Nothing guarantees the next one will be so
   discreet — a legible sign, a form, a vehicle door.

Identify the plugin and decide whether it runs on `project` media at all.

### 16.6 What this cost, and what it bought

A real homeowner's name and address were publicly reachable for about two
hours. That is the failure, and no amount of correct node behaviour offsets it.

What it bought: the gap was found by a test project belonging to a customer
Skybird has a relationship with, on the first run, rather than by the fortieth
project and a stranger. The fix is a workflow split, not a rebuild.

**Rule earned:** *ask what the automation makes reachable, not what it makes
visible.* Draft status, `noindex`, an unlinked URL and an unpublished post are
all visibility controls. None of them is an access control, and uploaded files
answer to none of them.

### 16.7 The draft, field by field — and an empty `completion_date`

Read out of post **1177** via the REST API as a logged-in admin:

| Field | Value | |
|---|---|---|
| `approx_lat` / `approx_lng` | `36.069334`, `-78.554441` | ✅ **0.2500 mi / 1,320 ft** from the real coordinates, bearing 121°. Dead centre of the annulus |
| `companycam_project_id` | `110848078` | ✅ |
| `city` / `zip` | `Youngsville` / `27596` | ✅ |
| `gallery` | `[1176, 1174, 1175]` | ⚠️ Correct order, oldest first — but `1175` is the deleted checklist, now a dangling ID |
| `completion_date` | `""` | 🔴 **Empty. Should be `2026-09-10`** |
| Title / status / excerpt / term | *Roof Replacement in Youngsville, NC*, draft, Youngsville | ✅ |
| `proline_project_id`, product fields, referral code | empty | ✅ Expected — nothing populates these yet |

The pin was the one that could have stopped the project, and it is right.

#### Why the date was empty

**CompanyCam returns timestamps as Unix epoch seconds, as an integer.** Not an
ISO string. Every `*_at` field in the webhook payload saved under
`docs/vendor/companycam/` is one — `created_at: 1790047740` — and `captured_at`
is no different.

`Curate` did this:

```js
completionDate: String(cover.captured_at || '').slice(0, 10),
```

which produced `"1789049525"` — the first ten digits of an epoch integer. The
plugin's `skybird_projects_sanitize_date()` checked it against
`^\d{4}-\d{2}-\d{2}$`, correctly rejected it, and stored `''`.

**Nothing errored, at any layer.** n8n was happy, the REST write returned 201,
and the plugin did exactly what it was built to do — *"a malformed date from
the import is a bug to leave blank, not to publish as 1969"*. The sanitiser
worked. It was the only thing standing between this and a project page reading
*"Completed January 1970"*.

The sort escaped by luck. `new Date(1789049525)` reads the value as
milliseconds and lands on 1970-01-21, but the mapping is monotonic, so the
oldest-first ordering came out correct anyway. It was wrong and right at the
same time.

`docs/01` §1 listed `captured_at` and what it was for, but never its **type**.
That is the third time in this phase an API's shape was recorded one level too
shallow — after the `project.label_added` payload nesting (§11) and the array
splitting (§15.4–15.5).

#### The fixture certified the bug

`tests/test-workflow.js` passed throughout. Its photo fixture used ISO strings,
because it was built from an MCP tool that normalises timestamps on the way
out — so the suite asserted `completionDate === '2026-09-10'` against input
that never occurs in production.

**A fixture in the wrong shape is worse than no fixture: it certifies the bug
and reports green.** The fixture now uses epoch integers, and with the old code
restored the suite fails three assertions with the exact live symptom,
`"1789049525"`.

Fixed in `Curate` with a `capturedMs()` helper that multiplies an integer by
1000, still parses an ISO string if the endpoint ever returns one, and emits
`''` rather than `1970-01-01` when there is no usable timestamp. Tests cover
all three.

#### The dangling gallery ID

`gallery` still lists `1175`, which no longer exists. `wp_get_attachment_image()`
returns an empty string for a missing attachment, so the page renders a short
gallery rather than breaking — but the draft is carrying a reference to the
file that had to be deleted.

Regenerating is not as simple as re-running: `Already Drafted?` will now find
post 1177 and correctly drop the delivery. Either edit the two fields by hand,
or delete the draft first and re-run.

### 16.8 Phase 4 complete — and an invisible headline

Second run, 2026-09-29 02:22. Three photos this time; the checklist was
untagged in CompanyCam, so it correctly did not come through.

| Check (`docs/06` §3) | |
|---|---|
| Title, excerpt, draft status | ✅ *Roof Replacement in Youngsville, NC*, draft |
| `completion_date` | ✅ **2026-09-10** — the epoch fix holds |
| Eyebrow on the page | ✅ "Completed September 2026", town not repeated from the H1 |
| Cover photo | ✅ The aerial, rendering in the real theme |
| Gallery | ✅ Two photos, oldest first — old shingles, then the tear-off |
| Service area | ✅ Youngsville, and the "Back to all Youngsville projects" link resolves |
| Share button | ✅ Absent, as designed — no referral code exists yet |
| **Pin** | ✅ **0.2377 mi (1,255 ft), bearing 281°** |
| PII | ✅ None anywhere |

**Phase 4's goal is met: one real CompanyCam project, one real WordPress
draft, nothing published automatically.**

#### The offset is drawn fresh every time, and that matters

Run 1 landed 0.2500 mi out at 121°. Run 2, same project, 0.2377 mi at 281°.

That is not cosmetic. A *fixed* offset would be reversible: anyone with two
published projects could solve for the vector and recover every real address on
the site. `docs/04-pin-precision-research.md` §4 specifies a random bearing and
a random distance within the annulus per project, and two runs against the same
project now demonstrate it on real data rather than in a test.

#### The H1 was invisible

The rendered page had no visible headline. Dragging a selection across the
blank space above the eyebrow revealed it: present, correctly worded, white on
white.

The cause is not in this plugin. skybirdroofing.net emits this inline in the
`<head>` of every page, from the theme Customizer:

```css
.h1, h1 {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 60px;
  color: #ffff
}
```

**Every `h1` on the site is white.** It goes unnoticed because Hub's own pages
put their H1 inside a dark WPBakery hero row. A project page has no hero — the
title sits on the plain white content area. This is the first page on the site
to do that.

(`#ffff` is the 4-digit `#RGBA` form, so it is valid and opaque white either
way. It reads like `#fff` with a slipped keystroke, set once and never looked
at again.)

**Fixed here** with `color: #181b31` on `.skybird-project__title` — Hub's own
default heading colour, which is what the Customizer replaced. Specificity
rather than `!important`: the site rule reaches this element through its bare
`h1` selector (0,0,1), so one class (0,1,0) wins regardless of load order.

**The better fix is Euan's**, and it is one character: correcting the
Customizer value would make every light-background H1 on the site visible,
not just ours.

#### The test for it was wrong, and only the regression check found that

Three assertions now read the stylesheet. The first version passed **with the
bug reintroduced** — twice.

The rule is documented with a comment quoting the offending
`h1 { color: #ffff }`, and the naive `\{(.*?)\}` match stopped at the first `}`
*inside that comment*, so the assertions were reading the quoted bug as if it
were the rule's own declarations. The "not white" check then passed by
accident, because `#ffff` fails a `#fff\b` match on the fourth `f`.

Two wrongs cancelling into green. The fix is to strip comments before matching;
both assertions now fail correctly when the colour is deleted or set to white.

**Worth keeping:** a test is not verified by watching it pass. It is verified
by breaking the thing it guards and watching it fail. That step has now caught
a real defect in three consecutive pieces of work — the workflow wiring, the
epoch fixture, and its own assertions.

#### Left over

- Media accumulates on every re-run. WordPress dodges the filenames still on
  disk, so the second run produced `…-cover-1.jpeg`. Attachments 1173, 1174 and
  1176 are orphans now. Re-running is not free, and nothing cleans up.

### 16.9 The photos carried the coordinates — 2026-09-29

A second opinion on the checklist design (Grok, via Jacob) raised something
neither of us had checked:

> Strip photo GPS. CompanyCam photos carry the exact location inside the image
> file, so strip it before upload. Otherwise the quarter-mile pin offset is
> pointless.

It was right, and it was live.

`Skybird-roof-youngsville-110848078-1.jpeg`, published on the site, carried a
GPS IFD reading **36.071200, -78.558250** — **17.6 feet** from the homeowner's
front door. The offset pin sat 1,267 ft away. Right-click, save image, read the
header, and the offset is worth nothing.

Everything in this system exists to protect that number. The pin is offset
0.2–0.3 mi and redrawn per project so the vector cannot be solved for
(§16.8). The street address is never stored. The plugin has no field for true
coordinates and `tests/test-plugin.php` asserts none is ever added. And the
photo carried the answer in its own header the whole time.

#### Why a spot check would have missed it

Three of the four photos were clean. The drone shots had **no GPS block at
all**; the one that did was a phone close-up of the old shingles, taken by a
crew member with location services on.

So the failure mode is invisible to sampling. Check three photos, find nothing,
conclude the pipeline is safe. The distribution is roughly the opposite of
where attention goes — the hero shots are clean, the incidental ones are not.

#### Fixed: `includes/exif.php`

Hooked on `wp_generate_attachment_metadata`, applied to the full-size file, the
pre-scaled original and every generated size.

**Not `wp_handle_upload`,** which was the obvious place. WordPress reads EXIF
*orientation* during `wp_create_image_subsizes()` and rotates the image to
match. Strip EXIF before that and every portrait photo lands sideways with
nothing left to say it should not be. Stripping afterwards means the rotation
has already been baked into the pixels.

**APP1 only, and only its two location-bearing flavours:**

- **Exif** — the GPS IFD.
- **XMP** — an Adobe/XML block carrying its own copy of the coordinates. Drones
  write both, so removing Exif alone would leave the location in the very next
  segment.

ICC colour profiles (APP2) and JFIF (APP0) survive, so nothing shifts. The
segments are cut out of the byte stream rather than re-encoded, so there is no
generation loss — verified on the real file: 492 bytes removed, GPS gone, the
entropy-coded scan data **byte-identical**.

Default is every image uploaded to the site, not only the automation's. On a
roofing company's site every photo is of somebody's house, and the manual
path — dragging a phone photo into the media library — is the likeliest to
carry coordinates. A `skybird_projects_strip_exif` filter narrows it.

#### What it cost to find

Nothing, this time. The file was deleted and the cache purged within minutes
and the remaining two were verified clean from outside the network.

What it cost to *miss*: the photo was public from 01:19 on 2026-09-28 until
03:0x on 2026-09-29 — around 26 hours, across both runs.

**Rule earned, and it is §16.3's again in a third costume:** *a control is only
as good as the channel you checked.* The pin offset was verified twice, to six
decimal places, on the field it governs. Nobody asked what else in the payload
knew the same fact. Invisible on the page, stripped from the API, and sitting
in the file.
