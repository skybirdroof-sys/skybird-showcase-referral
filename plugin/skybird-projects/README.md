# Skybird Projects

WordPress plugin. Registers the `project` post type, the `service_area` taxonomy, and the fields the Showcase automation writes to. Ships the project page template and the per-service-area map shortcode.

**Owned by Skybird** (agreed with Euan, `docs/09-euan-answers.md` §1), installed by Pitch Peak. Versioned here so every schema change in Phases 5–6 is a commit rather than a ticket on the agency's queue.

---

## Status

| | |
|---|---|
| PHP syntax | ✅ `php -l` clean on all 8 files |
| JS syntax | ✅ `node --check` clean |
| Registration + validation | ✅ 108 assertions passing — `php tests/test-plugin.php` |
| Loads and activates on real WordPress | ✅ 2026-09-17, TasteWP sandbox — no fatal, `Projects` menu registered, 8 service areas seeded with correct slugs, ACF-missing notice behaves as designed |
| REST write verified on real WordPress | ⏳ **three bugs found across two runs**, all fixed — awaiting a third run |

**First real install: 2026-09-17**, on a TasteWP sandbox. Activation succeeded with no fatal error, the `Projects` menu registered, all eight service areas seeded with the expected slugs, and the ACF-missing admin notice appeared and read correctly.

The real install found two bugs the stub harness structurally could not, and the second one matters:

**Coordinates were never stored at all.** `approx_lat` and `approx_lng` were registered as `type => 'number'` with a `default` of `''`. WordPress validates a registered field's default against its own schema, so the mismatch dropped both fields from the REST schema entirely — they were silently absent rather than erroring. They are now `string`, which is also the right type on its own merits: a `number` single meta returns `0` when unset, and `0` is exactly the sentinel the sanitiser rejects, so absent and invalid would be indistinguishable. A numeric string makes `''` unambiguously "not set".

Worse, the self-test *passed* its own 0,0-rejection check while this was broken, because an absent field reads as empty. That check now requires the key to be present **and** empty.

**The coordinate REST schema rejected numbers.** The fix above created a new failure on the next run: `rest_invalid_type: meta.approx_lat is not of type string`. REST validates an incoming value against the field's schema **before** `sanitize_callback` runs, so a `string`-only schema rejects a JSON number outright and the sanitiser never gets to cast it. A coordinate is naturally a number where it is calculated — n8n's offset code produces one — so forcing every caller to stringify first is a footgun. The schema now accepts `["string", "number"]` and the sanitiser normalises either to a stored string. The self-test sends latitude as a number and longitude as a string **in the same request** so both paths are exercised.

**Taxonomy labels fell back to category wording**, twice. A first pass defined the fifteen obvious labels and the admin still read "Filter by category", "No categories", "Categories list" — WordPress fills any omission from the hierarchical (category) defaults, and those are the labels nobody thinks to set. The rule: define the whole set or accept category wording somewhere you are not looking.

The suite now asserts every field's default matches its declared type, that the coordinates are strings, and that the full label set is present with no label containing "category".

Still unverified: that the REST write survives a **re-run** with both fixes in, that Application Passwords authenticate over HTTP, and that rewrite rules flush cleanly. The first is what `plugin/skybird-selftest/` re-runs; the other two are properties of the host and can only be answered on the real site — which is Euan's outstanding security-plugin question.

## Install

1. Copy `skybird-projects/` into `wp-content/plugins/`.
2. Activate. Activation seeds the eight service-area terms and flushes rewrites.
3. Confirm `/wp-json/wp/v2/projects` responds and that `meta` appears on the schema.
4. Add `[skybird_project_map area="wake-forest"]` to each service-area page, in a WPBakery text or raw-HTML element — one line per page, matching the slug.

Deactivating flushes rewrites and leaves all content alone.

**Requires:** WordPress 6.0+, PHP 7.4+. ACF (free is fine) is optional — without it the data still saves and the automation still works, but the reviewer-edited fields lose their form and the admin shows a notice.

## Decisions baked in, and where they come from

| Choice | Why |
|---|---|
| `has_archive => false` | Euan: a hub per service area, **not** one master projects page (§3.5). The default would publish an indexable `/projects/` archive competing with the eight service-area pages |
| Taxonomy `public => false` | Same reason — a public taxonomy creates `/service-area/{slug}/` term archives, a second set of competing hubs. `show_in_rest` stays true so n8n can still assign terms |
| `supports` includes `custom-fields` | Not cosmetic. Registered meta is only exposed in REST on a post type declaring this. Without it every field registers cleanly and is then invisible to the n8n write |
| Native meta, not ACF fields | ACF here is free tier — no Gallery field — and the gallery is machine-populated so it needs no UI. Native meta is also one predictable REST write instead of ACF's separate `acf` object (§3.1) |
| ACF group registered in PHP | So it's versioned here rather than clicked together in an admin UI that nobody can reproduce on a second install. `show_in_rest => false` on the group, so fields have exactly one write path |
| Template via `template_include` | Keeps it in this repo. The theme still wins if Pitch Peak ever adds `single-project.php` to Hub Child |
| Map ships as a shortcode | The site runs WPBakery, which is shortcode-based (§3.4). No custom WPBakery element development needed |
| Pin list is **server-rendered** | See below — this one is load-bearing |
| `-nc` URLs for back-links | Euan confirmed `-nc` is canonical and the bare form redirects. Linking to a redirect would add a hop to the exact internal link the SEO structure depends on |

### The map's pin list is server-rendered on purpose

`[skybird_project_map]` always outputs a real `<ul>` of real `<a>` links, in the HTML, before any JavaScript runs. The map then enhances that list and visually hides it (clipped, not `display:none`, so screen readers keep it).

`docs/handoff-buy-vs-build-decision.md` recorded that Roman Roofing's vendor-built project listing renders client-side — raw HTML full of placeholders and "Loading…" — and called it *"fragile for indexing."* Those internal links are the entire mechanism Euan signed off on. A link that only exists after JS executes is a link Google may never follow.

It also means the widget degrades to something useful with no API key, no JS, or a failed map load — and there is no API key yet (`docs/03-structure-signoff.md` §4 recommends the Google Maps JS API, which needs a key and billing set up separately). Until one exists the widget is a clean list of project links, which is a working state rather than a broken one.

Set the key via the `skybird_projects_maps_api_key` option or filter. **No credential goes in this repo.**

## The REST contract, for the n8n side

Create a draft — `POST /wp-json/wp/v2/projects`, Basic auth with the `skybird-sync` Application Password:

```json
{
  "status": "draft",
  "title": "GAF Timberline HDZ Roof Replacement in Youngsville, NC",
  "content": "<p>Two to four sentences. First one carries who/town/job.</p>",
  "excerpt": "One-line summary.",
  "featured_media": 501,
  "service-areas": [8],
  "meta": {
    "companycam_project_id": "110848078",
    "approx_lat": 36.074512,
    "approx_lng": -78.561238,
    "gallery": [502, 503, 504]
  }
}
```

Notes that will save a debugging session:

- **`status` must be `draft`.** Nothing publishes automatically — `docs/06-trigger-design.md` §3.
- **`service-areas`**, not `service_area`. The post body uses the taxonomy's `rest_base`.
- **Upload media first.** `POST /wp-json/wp/v2/media` with `Content-Disposition: attachment; filename="..."`, then use the returned IDs. Photos are downloaded into the Media Library, never hotlinked from CompanyCam (`docs/01-api-audit.md` §1.5).
- **`gallery` excludes the cover.** The cover goes in `featured_media`. The `Showcase Cover` photo is also tagged `Showcase`, so filter it out or it appears twice (`docs/07-phase-4-preflight.md` §1.3).
- **Fields the plugin silently drops** rather than storing wrong: a lat or lng of `0`, a referral code that isn't 6 valid characters, a malformed date, a non-five-digit ZIP, a negative attachment ID. If a value vanishes, it failed validation — check the value, not the plugin.
- **Product fields are left empty** by the automation for now and filled by the reviewer, because there is no CompanyCam→ProLine bridge (`docs/07-phase-4-preflight.md` §2.4.2).
- **Coordinates accept a number or a numeric string.** They are stored as strings so `''` can mean "not set" without colliding with a real `0`, but the REST schema is `["string", "number"]` so n8n can send either. See `includes/meta.php`.

### Idempotency lookup

`GET /wp-json/wp/v2/projects?companycam_project_id=110848078&status=any` — added because `project.label_added` fires for **any** of the account's eight project labels, so the workflow gets woken by an unrelated label on an already-showcased project and needs to know a draft exists. `status=any` matters: the existing record is usually a draft.

### The offset is n8n's job, not the plugin's

`docs/05-data-model.md` §1 is explicit: the true CompanyCam coordinates are **never written to WordPress at all**. So n8n computes the offset and sends only `approx_lat`/`approx_lng`. The plugin has no field for real coordinates and the test suite asserts that none is ever added.

Per `docs/04-pin-precision-research.md`, offset once and store; never recompute per view.

```js
// n8n Code node. Input: true lat/lon from the CompanyCam project.
const R = 3958.8;                                  // Earth radius, miles
const bearing = Math.random() * 2 * Math.PI;

// An annulus, not a disc: at least 0.2 mi, at most 0.3 mi. A uniform draw
// over a disc would sometimes land the pin almost on the house, which defeats
// the point of offsetting it at all. This guarantees a minimum displacement.
const miles = 0.2 + Math.random() * 0.1;

const d    = miles / R;
const lat1 = lat * Math.PI / 180;
const lon1 = lon * Math.PI / 180;

const lat2 = Math.asin(
  Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
);
const lon2 = lon1 + Math.atan2(
  Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
  Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
);

return {
  approx_lat: Number((lat2 * 180 / Math.PI).toFixed(6)),
  approx_lng: Number((lon2 * 180 / Math.PI).toFixed(6)),
};
```

## Tests

```bash
php tests/test-plugin.php
```

No PHPUnit — it runs anywhere PHP does. Each assertion maps to a decision in `docs/`, so a change that quietly reverses one fails here rather than on the live site. Notably it asserts that **no field for the true location or homeowner PII exists**, and that a `0` coordinate is rejected — the 0,0 pin being the signature of an offset step that didn't run, which `docs/06-trigger-design.md` §3 currently asks a human to catch by eye.

The harness already earned its keep once: it caught `absint()` turning a negative attachment ID into a positive one, which would have put an unrelated image into a gallery instead of dropping the bad ID.

## Known limitations

- **Gallery images share one alt text.** There is no per-photo data to vary it with — every curated photo on the test project has `description: null`. One accurate description beats invented variation, but it isn't ideal for accessibility and is worth revisiting if per-photo captions ever exist.
- **SEO title and meta description aren't written.** The site uses All in One SEO, which keeps much of its per-post data in its own table rather than postmeta, so this may not be a simple meta write (`docs/09-euan-answers.md` §3.3 — unverified). The review gate already includes an SEO-title check, so a reviewer sets these by hand for now.
- **No `/projects/` index.** By design (§3.5). If a browse-all page is ever wanted it needs to be a deliberate decision with Euan, not a default.
