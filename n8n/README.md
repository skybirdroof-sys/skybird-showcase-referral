# n8n — CompanyCam Showcase → WordPress draft

`companycam-showcase-to-wordpress.json` — importable n8n workflow, 24 nodes.

## Status

| | |
|---|---|
| Valid JSON | ✅ |
| Structure | ✅ 24 nodes, all reachable from the Webhook, every IF wired on both branches, every `$('Node')` reference resolves |
| Embedded JS syntax | ✅ `node --check` clean on all 7 Code nodes |
| Variable scope | ✅ no `$json` in a Run-Once-for-All-Items node |
| **Imported into n8n** | ❌ never |
| **Executed** | ❌ never |

`app.n8n.cloud` is blocked from the build environment and there is no n8n connector in this session, so this has not been round-tripped through n8n. **Expect to fix small things on import** — node `typeVersion`s move between n8n releases, and if yours is older or newer than what this targets (Webhook v2, Code v2, IF v2.2, HTTP Request v4.2) a node may import with a warning and need re-picking from the panel. The logic and the Code node bodies are the part worth having; the wiring is a convenience.

## Import

1. n8n → **Workflows** → **Import from File**.
2. Set three environment values (Settings → Variables, or your instance's env):
   - `COMPANYCAM_API_KEY` — the Read-only Application Key
   - `COMPANYCAM_WEBHOOK_TOKEN` — the webhook signing token, **shown once at create time**
   - `WP_BASE` — e.g. `https://skybirdroofing.net` (no trailing slash)
3. Create one credential: **HTTP Basic Auth** named `WordPress skybird-sync` — username `skybird-sync`, password the Application Password. Attach it to the four WordPress HTTP nodes (`Already Drafted?`, `Upload Media`, `Get Area Term`, `Create Draft`); the JSON carries a placeholder credential ID that won't resolve.
4. **Activate the workflow**, then copy the **Production** webhook URL from the Webhook node.
5. Create the CompanyCam subscription against that URL, scope `project.label_added`, and capture the token it returns into `COMPANYCAM_WEBHOOK_TOKEN`.
6. Set an **Error Workflow** (workflow Settings). Several nodes throw deliberately — without one, those throws are silent.

**The mistake that costs an afternoon:** n8n gives a workflow a Test URL and a Production URL. The Test URL only listens while the editor is open. A subscription pointed at it appears to work once during a manual execution, then silently accrues delivery failures toward CompanyCam's **25-error disable**.

## What it does

```
Webhook (200 immediately, raw body)
  → Verify Signature (HMAC-SHA1, timing-safe)      → drop if invalid
  → Check Label  [+ Fetch Project Labels fallback]  → drop if not Website Showcase
  → Already Drafted?                                → drop if a draft exists
  → Get Project · Get Showcase Photos · Get Cover Photo
  → Curate (filter, sort, split cover, compute pin offset)
  → per photo: Download → Upload Media
  → Get Area Term → Build Payload → Create Draft (status: draft)
```

Three of those are "drop quietly" — the normal outcome for most deliveries, not errors.

## Things in here that are decisions, not defaults

- **Respond immediately.** CompanyCam disables a webhook after 25 total errors (`docs/01-api-audit.md` §1.3), so nothing downstream may run before the 200.
- **Raw body, hashed as received.** `JSON.parse` then re-stringify changes key order and whitespace, so the digest never matches. The compare is `timingSafeEqual` — a plain `===` leaks how much of the digest matched, which is the reason the header exists.
- **The label filter is load-bearing.** `project.label_added` fires for *any* label, and this account has eight (`Website Showcase`, `Gutter Cleaning`, `JobNimbus Job`, `Pipedrive Deal`, four `… Lead`). Without the filter, tagging a project `Pipedrive Deal` builds a WordPress draft. There is a fallback branch that fetches `/projects/{id}/labels`, because whether the webhook payload includes labels is **not verified**.
- **Idempotency check.** Because the trigger fires on every label change, a project showcased last month generates another delivery next time anyone touches any label. `Already Drafted?` uses the lookup the plugin adds. It stops rather than updating: a reviewer may have already edited the copy, and silently overwriting their work is worse than doing nothing.
- **Two filtered photo calls**, not one call plus client-side tag filtering. The photo objects from that endpoint did **not** include a `tags` array in the responses inspected on 2026-09-16, so filtering on inline tags would silently return nothing.
- **`Curate` throws** on no cover, more than one cover, or an empty gallery. Those are curation problems whose fix is in CompanyCam — `docs/06-trigger-design.md` §3's answer to a failed check is to pull the label. A throw surfaces that instead of shipping a half-formed page.
- **The pin offset is computed here**, and only the offset travels onward. `docs/05-data-model.md` §1 forbids the true coordinates reaching WordPress at all; the plugin has no field for them and its tests assert none is added. Drawn from an **annulus** (0.2–0.3 mi), not a disc, so every pin is displaced by at least 0.2 mi — a uniform draw over a disc would occasionally land the pin almost on the house.
- **Filenames** are built from the area slug and project ID, never the CompanyCam project `name` — which is usually the customer's name. `docs/06-trigger-design.md` §3 forbids PII in image filenames.
- **Title and body are deliberately thin.** The locked SEO title format needs manufacturer and product line and nothing populates those (no CompanyCam→ProLine bridge, `docs/07-phase-4-preflight.md` §2.4.2), so the automation writes `Roof Replacement in {Area}, NC` and one factual sentence. The copy rules forbid invented specifics; an automation with no product data has nothing true to say beyond the town and the service. Finishing the copy is the reviewer's job at the gate. **A thin draft a human finishes beats a fluent one that invents details.**

## What it deliberately does not do

- **Publish.** `status: draft`, always.
- **Send the homeowner anything.** Phase 5, and gated on Jacob seeing the message first.
- **Write `ambassador_referral_code` or `proline_project_id`.** Nothing can populate either yet.
- **Set alt text.** Generated at render time from the product fields by `skybird_projects_image_alt()`, so it can never be derived from CompanyCam data.
- **Comment back on the CompanyCam project** with the draft link. Worth adding — the curator otherwise has no signal a draft appeared — but it needs a *write* scope where Phase 4 is read-only, so it's a scope decision rather than a freebie. `docs/10-n8n-workflow.md` §10 has the call.

## The four things a first run has to prove

From `docs/07-phase-4-preflight.md` §2.3 — this leg has never been proven, because the 9/14 test was a manual pull with no webhook registered:

1. Delivery fires on a label add.
2. The filter rejects the other seven labels.
3. `X-CompanyCam-Signature` validates against the raw body.
4. n8n acks 200 fast enough that the error counter never moves.

Test project: `Bill Najdecki #2561`, CompanyCam ID **110848078**, already labelled, 4 photos tagged `Showcase`, 1 tagged `Showcase Cover`.
