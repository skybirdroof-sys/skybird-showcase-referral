# n8n — CompanyCam Showcase → WordPress draft

`companycam-showcase-to-wordpress.json` — importable n8n workflow, 23 nodes.

## Status

| | |
|---|---|
| Valid JSON | ✅ |
| Structure | ✅ 23 nodes, all reachable from the Webhook, every IF wired on both branches, every `$('Node')` reference resolves |
| Embedded JS syntax | ✅ `node --check` clean on all 7 Code nodes |
| Variable scope | ✅ no `$json` in a Run-Once-for-All-Items node |
| **Imported into n8n** | ❌ never |
| **Executed** | ❌ never |

`app.n8n.cloud` is blocked from the build environment and there is no n8n connector in this session, so this has not been round-tripped through n8n. **Expect to fix small things on import** — node `typeVersion`s move between n8n releases, and if yours is older or newer than what this targets (Webhook v2, Code v2, IF v2.2, HTTP Request v4.2) a node may import with a warning and need re-picking from the panel. The logic and the Code node bodies are the part worth having; the wiring is a convenience.

## Import

Built for **n8n Cloud, Community (free)**, which is the constraining case:
`$env` is blocked on Cloud entirely, and `$vars` (Variables) is gated to Pro
and above. Neither is used. Every secret is an n8n **credential**; the one
non-secret value is a **Config** node.

1. n8n → **Workflows** → **Import from File**.
2. Create three credentials (Credentials → Add):

   | Credential | Type | Settings |
   |---|---|---|
   | `CompanyCam Webhook Auth` | Header Auth | Name `Authorization`, Value `Bearer <shared secret you generate>` |
   | `CompanyCam API` | Header Auth | Name `Authorization`, Value `Bearer <Read-only Application Key>` |
   | `WordPress skybird-sync` | Basic Auth | Username and Application Password for the target site |

   The JSON carries placeholder credential IDs (`REPLACE_ME_*`) that will not
   resolve — open each flagged node and pick the credential from the list.

   - `CompanyCam Webhook Auth` → the **Webhook** node
   - `CompanyCam API` → `Fetch Project Labels`, `Get Project`,
     `Get Showcase Photos`, `Get Cover Photo`
   - `WordPress skybird-sync` → `Already Drafted?`, `Upload Media`,
     `Get Area Term`, `Create Draft`

3. Open the **Config** node and set `wpBase` to the target site, no trailing
   slash. The sandbox while proving this out; production afterwards. It is the
   only place that URL appears.
4. **Activate the workflow**, then copy the **Production** webhook URL from the
   Webhook node.
5. Create the CompanyCam subscription against that URL, scope
   `project.label_added`, with `authorization_header` set to the *same*
   `Bearer <shared secret>` value as the `CompanyCam Webhook Auth` credential.
6. Set an **Error Workflow** (workflow Settings). Several nodes throw
   deliberately — without one, those throws are silent.

### Why Header Auth rather than the HMAC signature

`docs/06-trigger-design.md` specified verifying `X-CompanyCam-Signature` — a
base64 HMAC-SHA1 of the raw body. That is still the stronger scheme on paper,
and it is what the first build did, in three nodes.

It cannot be done safely on this plan. The signing token has to be readable
from inside a Code node, and Code nodes cannot read credentials. With `$env`
blocked and `$vars` unavailable, the only remaining place to put it is
**plaintext inside the workflow JSON** — where it would travel into this repo,
into every export, and into every screenshot of the node.

CompanyCam can instead send a static `Authorization` header on every delivery
(`authorization_header` at create time), and n8n's Webhook node authenticates
that natively, rejecting anything without it **before the workflow runs**. The
secret stays in n8n's encrypted credential store.

The trade: a shared bearer proves the caller knows the secret; the HMAC also
proves the body was not altered in flight. Over TLS, to an authenticated
caller, that difference is small — and it is bought at the cost of a secret
committed in plaintext, which is not a trade worth making. **If the account
moves to Pro**, `$vars.COMPANYCAM_WEBHOOK_TOKEN` becomes available and the
HMAC trio can be restored; git history has the three nodes.

**The mistake that costs an afternoon:** n8n gives a workflow a Test URL and a Production URL. The Test URL only listens while the editor is open. A subscription pointed at it appears to work once during a manual execution, then silently accrues delivery failures toward CompanyCam's **25-error disable**.

## What it does

```
Webhook (200 immediately, raw body, Header Auth)
  → Config (wpBase) → Parse Body
  → Check Label  [+ Fetch Project Labels fallback]  → drop if not Website Showcase
  → Already Drafted?                                → drop if a draft exists
  → Get Project · Get Showcase Photos · Get Cover Photo
  → Curate (filter, sort, split cover, compute pin offset)
  → per photo: Download → Upload Media
  → Get Area Term → Build Payload → Create Draft (status: draft)
```

Two of those are "drop quietly" — the normal outcome for most deliveries, not errors. A request that fails Header Auth never reaches the workflow at all.

## Things in here that are decisions, not defaults

- **Respond immediately.** CompanyCam disables a webhook after 25 total errors (`docs/01-api-audit.md` §1.3), so nothing downstream may run before the 200.
- **Authentication happens in n8n, not in a node.** The Webhook node's Header Auth credential rejects an unsigned request before any node runs, so `Parse Body` is not a trust boundary and does not pretend to be one. See *Why Header Auth rather than the HMAC signature* above.
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
