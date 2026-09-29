# 10 — n8n Workflow Build Spec

Skybird Project Showcase + Referral System · Phase 4
Written 2026-09-17. The automation half of Phase 4: `project.label_added` → WordPress draft.

**Status: built, imported and running — [`n8n/companycam-showcase-to-wordpress.json`](../n8n/companycam-showcase-to-wordpress.json) (23 nodes). This document is the reasoning behind it; [`n8n/README.md`](../n8n/README.md) has the import steps, and [`tests/test-workflow.js`](../tests/test-workflow.js) exercises its Code nodes.**

> **Correction, 2026-09-17.** An earlier version of this document said "Jacob builds and activates this in his own n8n account," and shipped only a spec on that basis. That misread him. Asked whether the workflow could be built in his own account or needed Pitch Peak, he answered *"I can build the workflow myself — I've built plenty in n8n before. That resolves whether this gets built independently"* — an answer about **permission and capability**, not a request to hand-build the nodes.
>
> The workflow is now generated as importable JSON. What genuinely remains his: importing it, attaching the credentials, creating the CompanyCam subscription, and activating. Creating it in the account directly isn't possible from here — no n8n connector, and `app.n8n.cloud` is egress-blocked. With that host allowed and an n8n API key, n8n's public API accepts a workflow POST and it could be created there instead.

**I have not tested any of this.** `app.n8n.cloud` is blocked from the build environment and there is no n8n connector in this session. Every HTTP call below is written from `docs/01-api-audit.md` and from what was verified live through the CompanyCam MCP connector; none of it has round-tripped through n8n.

---

## 0. The shape

```
[1] Webhook  (POST, raw body, respond 200 immediately)
      ↓
[2] Code: verify HMAC-SHA1 signature
      ↓
[3] IF valid ────────────────── false → [stop]
      ↓ true
[4] Code: is this the Website Showcase label?
      ↓
[5] IF ours ─────────────────── false → [stop]   ← fires for ALL 8 labels
      ↓ true
[6] HTTP: does a draft already exist?  (WP)
      ↓
[7] IF new ──────────────────── false → [stop]   ← idempotency
      ↓ true
[8]  HTTP: GET project            (CompanyCam)
[9]  HTTP: GET photos ?tag=Showcase
[10] HTTP: GET photos ?tag=Showcase Cover
      ↓
[11] Code: curate + compute pin offset
      ↓
[12] Loop: download photo → upload to WP media
      ↓
[13] HTTP: GET service-area term id  (WP)
      ↓
[14] Code: assemble the draft payload
      ↓
[15] HTTP: POST /wp-json/wp/v2/projects   → status: draft
      ↓
[16] HUMAN REVIEW  (docs/06-trigger-design.md §3) → publish
```

Steps 3, 5 and 7 are all "stop quietly." None of them is an error — they are the normal outcome for most deliveries.

---

## 1. Node [1] — Webhook

| Setting | Value | Why |
|---|---|---|
| HTTP Method | `POST` | |
| Path | `companycam-showcase` | |
| Respond | **Immediately** | `docs/01-api-audit.md` §1.3: CompanyCam requires exactly HTTP 200, retries with backoff, and **disables the webhook after 25 total errors**. Everything downstream must run after the response, not before it |
| Raw Body | **On** | The signature is computed over the raw bytes. Without this the body is parsed to an object and the original string is gone — see §2 |

**The gotcha that costs an afternoon:** n8n gives a workflow two webhook URLs — a Test URL that only listens while you have the editor open, and a Production URL that only works when the workflow is **Active**. The CompanyCam subscription must point at the **Production** URL, and the workflow must be activated. A subscription pointed at the Test URL appears to work once during a manual execution and then silently accrues delivery failures toward the 25-error disable.

---

## 2. Node [2] — Code: verify the signature

`docs/01-api-audit.md` §1.3: `X-CompanyCam-Signature` is the base64 HMAC-SHA1 of the raw body, keyed with the webhook's `token`.

The token is shown **once, at webhook-create time** and never again. Store it as an n8n credential or environment value — not in the workflow JSON.

```js
// Code node, Run Once for All Items.
const crypto = require('crypto');

const item = $input.first();

// With Raw Body on, the body arrives as a string (or a base64 buffer,
// depending on content type). Hash the bytes exactly as received — do NOT
// JSON.parse and re-stringify, because key order and whitespace will differ
// from what CompanyCam signed and the digest will never match.
const raw = typeof item.json.body === 'string'
  ? item.json.body
  : Buffer.from(item.binary?.data?.data ?? '', 'base64').toString('utf8');

const headers = item.json.headers || {};
const received = headers['x-companycam-signature'] || headers['X-CompanyCam-Signature'] || '';

const token = $env.COMPANYCAM_WEBHOOK_TOKEN;   // set in n8n, not here

const expected = crypto.createHmac('sha1', token).update(raw, 'utf8').digest('base64');

// Timing-safe compare. A plain === leaks how much of the digest matched,
// which is the whole reason this header exists.
let valid = false;
try {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  valid = a.length === b.length && crypto.timingSafeEqual(a, b);
} catch (e) {
  valid = false;
}

return [{ json: { valid, raw, payload: valid ? JSON.parse(raw) : null } }];
```

Node [3] is an **IF** on `{{ $json.valid }}`.

An invalid signature means someone is posting to the URL who shouldn't be. Stop; don't retry, don't alert on every one.

---

## 3. Nodes [4]–[5] — Is this actually our label?

**This is the step most likely to be skipped and the one that causes the most damage.**

`project.label_added` fires for **any** label added to **any** project. The account has eight project labels (verified 2026-09-16, `docs/07-phase-4-preflight.md` §2.3): `Website Showcase`, `Gutter Cleaning`, `JobNimbus Job`, `Pipedrive Deal`, and four `… Lead` labels. Without this filter, someone tagging a project `Pipedrive Deal` starts building a WordPress draft.

```js
// Code node, Run Once for All Items. Note $input.first().json, NOT $json —
// $json is not available in this mode and would throw at runtime.
const payload = $input.first().json.payload || {};

// `project.*` events carry the Project object (docs/01-api-audit.md §1.3).
const project = payload.payload || {};
const eventType = payload.event_type || '';

// Whether the payload includes the project's labels is NOT verified — the
// audit says the payload "matches the object", and the object does carry
// labels when requested with include=labels, but the webhook's exact shape
// hasn't been seen. So: use them if present, otherwise node [4b] fetches them.
const labels = Array.isArray(project.labels) ? project.labels : null;

const hasLabel = labels === null
  ? null                                             // unknown — go fetch
  : labels.some((l) => (l.value || '').toLowerCase() === 'website showcase');

return [{
  json: {
    eventType,
    projectId: String(project.id || ''),
    needsLabelFetch: hasLabel === null,
    isOurs: eventType === 'project.label_added' && hasLabel === true,
    project,
  },
}];
```

**Node [4b], only if `needsLabelFetch`** — an HTTP Request to
`GET https://api.companycam.com/v2/projects/{{ $json.projectId }}/labels`
then re-evaluate `isOurs` the same way. Build this branch even if the first delivery happens to include labels: the payload shape is undocumented and could change.

Node [5] is an **IF** on `isOurs`.

---

## 4. Nodes [6]–[7] — Don't create the same draft twice

Because the trigger fires on every label change, a project showcased last month generates another delivery the next time anyone adds any label to it. Without this check that means a second draft, then a third.

The plugin adds a lookup parameter for exactly this (`plugin/skybird-projects/includes/rest.php`):

```
GET {WP}/wp-json/wp/v2/projects?companycam_project_id={{ $json.projectId }}&status=any&per_page=1
```

Basic auth with the `skybird-sync` Application Password. `status=any` matters — the existing record is usually a **draft**, which an unauthenticated or default query won't return.

Node [7] is an **IF** on the result being empty. If a project already exists, stop. Don't update it either: a reviewer may have already edited the copy, and silently overwriting their work is worse than doing nothing.

---

## 5. Nodes [8]–[10] — Pull from CompanyCam

Auth: `Authorization: Bearer {Application Key}`, Read-only key, stored as an n8n credential.

> **Correction, 2026-09-28.** These three were originally drawn as node [8]
> fanning out to [9] and [10] in parallel, both feeding Curate. **That does not
> work.** Two branches into one input is not a join: n8n runs the node as soon
> as *either* arrives, so Curate fired before the cover fetch had run and threw
> `Node 'Get Cover Photo' hasn't been executed`. They now run in series —
> **[8] project → [10] cover → [9] showcase set → [11] Curate** — with the
> cover first because it returns exactly one item, so the showcase fetch runs
> once rather than once per photo. See `docs/07-phase-4-preflight.md` §15.5.

**[8] The project** — `GET https://api.companycam.com/v2/projects/{{ $json.projectId }}`

Needed for `coordinates` (input to the offset), and `address.city` / `state` / `postal_code` for the display location. **Never** use `address.street_address_1`, `name`, or `primary_contact` — those are PII (`docs/06-trigger-design.md` §3). The project `name` is usually the customer's name.

**[9] The curated set** — `GET /v2/projects/{{ $json.projectId }}/photos?tag_ids={SHOWCASE_TAG_ID}&per_page=100`

**[10] The cover** — same endpoint with `tag_ids={SHOWCASE_COVER_TAG_ID}`

Tag IDs verified live 2026-09-16: `Showcase` = **27372163**, `Showcase Cover` = **27372182**.

Two separate calls rather than reading each photo's inline tags, deliberately: the photo objects returned by this endpoint did **not** include a `tags` array in the responses inspected on 2026-09-16, so filtering client-side on inline tags would silently return nothing. Two filtered calls is how the set was confirmed by hand, and it works.

Prefer resolving the IDs at runtime via `GET /v2/tags` matched on `value` if you want resilience against the tags being recreated; hardcoding is fine and faster, but leave a comment with the names so a future 404 is diagnosable.

---

## 6. Node [11] — Curate and compute the pin

```js
// Code node. Reads nodes [8], [9] and [10], which now run in series ahead of
// it (see the correction in section 5).
//
// .all(), NOT .first().json: an HTTP Request node splits a JSON array response
// into one item per element, so .first().json is the first PHOTO, not the
// list. Reading it as a list gives "showcase.filter is not a function".
// The .id filter drops the empty sentinel item that "Always Output Data"
// emits when a fetch comes back with nothing — which is what makes the throws
// below fire instead of the branch ending quietly
// (docs/07-phase-4-preflight.md sections 15.4 and 15.5).
const photosFrom = (node) =>
  $(node).all().map((item) => item.json).filter((p) => p && p.id);

const projectRaw = $('Get Project').first().json;
const project  = projectRaw.data || projectRaw;
const showcase = photosFrom('Get Showcase Photos');
const covers   = photosFrom('Get Cover Photo');

// Hard filters from docs/01-api-audit.md §1.5 and §6.
const usable = showcase.filter(
  (p) => p.internal !== true && p.processing_status === 'processed'
);

// Oldest first: before → during → after, which is the order the page reads in.
usable.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));

const capped = usable.slice(0, 20);

// The cover is also tagged Showcase, so it appears in both lists. Decided
// 2026-09-17: cover becomes featured_media, gallery is the set MINUS the
// cover, so no photo appears twice (docs/07-phase-4-preflight.md §1.3).
const cover = covers[0] || null;
const gallery = capped.filter((p) => !cover || p.id !== cover.id);

// Fail loudly rather than guessing. docs/06-trigger-design.md §3 requires a
// human to confirm the cover is a genuine hero shot — they cannot confirm a
// cover the automation picked at random.
if (!cover) {
  throw new Error(`Project ${project.id}: no photo tagged "Showcase Cover".`);
}
if (covers.length > 1) {
  throw new Error(`Project ${project.id}: ${covers.length} photos tagged "Showcase Cover" — expected 1.`);
}
if (gallery.length === 0) {
  throw new Error(`Project ${project.id}: no gallery photos after filtering.`);
}

// --- Pin offset ---------------------------------------------------------
// Generated HERE, once, and only the offset is sent onward. The true
// coordinates are never written to WordPress at all — docs/05-data-model.md
// §1. The plugin has no field for them and its tests assert none is added.
const lat = project.coordinates?.lat;
const lon = project.coordinates?.lon;

if (typeof lat !== 'number' || typeof lon !== 'number') {
  throw new Error(`Project ${project.id}: no coordinates to offset.`);
}

const R = 3958.8;                                // Earth radius, miles
const bearing = Math.random() * 2 * Math.PI;

// An annulus, not a disc: at least 0.2 mi, at most 0.3 mi
// (docs/04-pin-precision-research.md §4). A uniform draw over a disc would
// sometimes land the pin almost on the house, defeating the offset entirely.
const miles = 0.2 + Math.random() * 0.1;

const d = miles / R;
const la = (lat * Math.PI) / 180;
const lo = (lon * Math.PI) / 180;

const la2 = Math.asin(
  Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(bearing)
);
const lo2 = lo + Math.atan2(
  Math.sin(bearing) * Math.sin(d) * Math.cos(la),
  Math.cos(d) - Math.sin(la) * Math.sin(la2)
);

const city = project.address?.city || '';

return [{
  json: {
    companycamProjectId: String(project.id),
    city,
    areaSlug: city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
    zip: project.address?.postal_code || '',
    approxLat: Number(((la2 * 180) / Math.PI).toFixed(6)),
    approxLng: Number(((lo2 * 180) / Math.PI).toFixed(6)),
    coverUrl: (cover.uris || []).find((u) => u.type === 'original')?.uri,
    galleryUrls: gallery.map(
      (p) => (p.uris || []).find((u) => u.type === 'original')?.uri
    ),
    // captured_at is Unix epoch SECONDS, not ISO. Slicing it gives
    // "1789035125". See the correction in section 5 and docs/07 section 16.7.
    completionDate: new Date(cover.captured_at * 1000).toISOString().slice(0, 10),
  },
}];
```

The three `throw`s are intentional. A project with no cover, two covers, or no gallery photos is a **curation** problem — the fix is in CompanyCam, not in a draft that papers over it. `docs/06-trigger-design.md` §3's answer to a failed check is "remove the `Website Showcase` label and address the underlying issue," and these throws surface exactly that case instead of publishing a half-formed page.

---

## 7. Node [12] — Photos into the Media Library

Never hotlinked from CompanyCam (`docs/01-api-audit.md` §1.5): SEO wants the images on skybirdroofing.net, and the photo URL lifetime is undocumented.

Per photo, in a Split In Batches loop:

1. **Download** — HTTP Request, `GET {photo url}`, Response Format **File**, binary property `data`.
2. **Upload** — HTTP Request, `POST {WP}/wp-json/wp/v2/media`
   - Body: Binary File, input property `data`
   - Header: `Content-Disposition: attachment; filename="{{ $json.filename }}"`
   - Basic auth, `skybird-sync`

**Filename matters more than it looks.** `docs/06-trigger-design.md` §3 forbids homeowner PII "including in image filenames/alt text." CompanyCam filenames are opaque hashes so there is nothing to leak — but don't construct one from the project `name` either, because that is usually the customer's name. Use the pattern:

```
skybird-roof-{areaSlug}-{companycamProjectId}-{n}.jpeg
```

Collect the returned media `id`s; keep the loop's output order, since that is the `captured_at` sequence.

Alt text is **not** set here. It is generated at render time from the product fields by `skybird_projects_image_alt()` — see `plugin/skybird-projects/includes/template.php` and `docs/07-phase-4-preflight.md` §2.4.1 for why it is derived from ProLine-sourced fields and never from CompanyCam.

---

## 8. Node [13] — Resolve the service-area term

```
GET {WP}/wp-json/wp/v2/service-areas?slug={{ $json.areaSlug }}
```

Take `[0].id`. If empty, the project's city isn't one of the eight service areas — a real condition worth throwing on rather than filing the project into the wrong area or leaving it unfiled, which would drop it out of every map widget.

> **Correction, 2026-09-28.** "Take `[0].id`" hides the same trap as §6. This
> endpoint returns an **array**, so n8n hands the next node one item per term
> and `.first().json` is a single term, not the list — `Array.isArray()` on it
> is false and the code silently concludes there is no term. Read it with
> `$('Get Area Term').all().map((i) => i.json).filter((t) => t && t.id)`.
> The node also needs **Always Output Data**: without it the no-match case is
> zero items, the rest of the branch is skipped, and the run reports success
> having created nothing rather than throwing the error described above
> (`docs/07-phase-4-preflight.md` §15.5).

The eight slugs are seeded by the plugin on activation: `franklinton`, `goldsboro`, `greenville`, `knightdale`, `raleigh`, `rolesville`, `wake-forest`, `youngsville`.

---

## 9. Nodes [14]–[15] — Create the draft

```json
{
  "status": "draft",
  "title": "Roof Replacement in Youngsville, NC",
  "content": "<p>Skybird Roofing completed a full roof replacement in Youngsville, NC.</p>",
  "excerpt": "Roof replacement in Youngsville, NC.",
  "featured_media": 501,
  "service-areas": [8],
  "meta": {
    "companycam_project_id": "110848078",
    "approx_lat": 36.074512,
    "approx_lng": -78.561238,
    "gallery": [502, 503, 504],
    "city": "Youngsville",
    "zip": "27596",
    "completion_date": "2026-09-10"
  }
}
```

**On the title and copy — deliberately minimal, and this is a real limitation.**

`docs/06-trigger-design.md` §3 locks the SEO title format as *one job, one town, roof replacement* — e.g. *GAF Timberline HDZ Roof Replacement in Wake Forest, NC*. That format needs the manufacturer and product line, and **nothing populates those** (no CompanyCam→ProLine bridge, `docs/07-phase-4-preflight.md` §2.4.2). So the automation writes the town-only form and the reviewer upgrades it after filling the product fields.

The body copy is one factual sentence for the same reason. The locked copy rules forbid invented prices, "free roof," city-stuffing and storm claims, and an automation with no product data and no job notes has nothing true to say beyond the town and the service. Writing the 2–4 sentence description is the reviewer's job at the gate until the ProLine read path exists. **Better a thin draft a human finishes than a fluent one that invents specifics.**

Field notes:
- `service-areas`, not `service_area` — the post body uses the taxonomy's `rest_base`.
- Values the plugin **silently drops** rather than storing wrong: a `0` coordinate, a referral code that isn't 6 valid characters, a malformed date, a non-five-digit ZIP, a negative attachment ID. If a value vanishes it failed validation.
- Don't send `ambassador_referral_code` — Phase 5 owns it, and there are no ambassadors yet.
- Don't send `proline_project_id` — nothing can populate it.

Capture `id`, `link` and `slug` from the response.

---

## 10. Optional node [16] — Tell the curator

The person who added the label has no way to know a draft appeared. One line closes that loop:

```
POST https://api.companycam.com/v2/projects/{id}/comments
{ "content": "Website draft created: {{ $json.link }}" }
```

Not required by `docs/06-trigger-design.md`, and it needs a **write** scope where Phase 4 is otherwise read-only — so it is a genuine scope decision, not a freebie. Worth it if reviewers would otherwise have to poll wp-admin.

---

## 11. Failure handling

- **Every error path returns 200 first.** The webhook already responded (node [1]); a later failure is n8n's problem, not a delivery failure. This is what keeps the 25-error disable from ever triggering on a logic bug.
- **Set an Error Workflow** on this workflow so a thrown curation error reaches someone. A throw with no error workflow is a silent no-op — and the throws in node [11] are the ones you most want to hear about, because they mean a project is sitting in CompanyCam labelled and unprocessed.
- **Retries:** CompanyCam retries with exponential backoff, max 10 attempts. Since node [1] responds immediately, a retry should never be a duplicate — but the idempotency check at [6]–[7] covers it if the response is ever made conditional.
- **Rate limits** are not a concern: one project is ~4 CompanyCam API calls plus ~4 CDN downloads, against 240 GET/min (`docs/01-api-audit.md` §1.5).

---

## 12. Before it can run

| Needed | From | Status |
|---|---|---|
| Plugin installed and activated | anywhere writable | Built, **never loaded by WordPress** — `plugin/skybird-projects/README.md` |
| `skybird-sync` user + Application Password | Euan | Asked 2026-09-17 |
| Security plugin: does it block REST or App Passwords? | Euan | Asked 2026-09-17 — the likely cause of a 401 |
| CompanyCam Application Key (Read only) | Jacob — has it | Paste into an n8n credential, never into this repo |
| Webhook created + signing token captured | Jacob | Token is shown **once**, at create time |
| Production webhook URL, workflow Active | Jacob | Not the Test URL — see §1 |

The four proof steps this has to demonstrate are in `docs/07-phase-4-preflight.md` §2.3: delivery fires on a label add, the label filter rejects the other seven labels, the signature validates against the raw body, and n8n acks 200 fast.
