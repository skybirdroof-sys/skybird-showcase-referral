# 11 — Resume Here

Skybird Project Showcase + Referral System · Phase 4
Last worked 2026-09-28. Written as a pickup point, because the next session may be a fresh one with none of this in context.

**Read the last section first** — *Where it stands, 2026-09-28* — it supersedes
the dated sections above it. Those are kept because the traps they record still
bite.

---

## Where Phase 4 actually stands

Phase 4's goal: **one real CompanyCam project → one real WordPress draft, nothing published automatically.**

| Piece | State |
|---|---|
| CompanyCam side | ✅ Verified live. Tags, label, curated set, test project all real (`07` §1) |
| WordPress plugin | ✅ Built, 127 assertions, **installs and activates on real WordPress** |
| Plugin REST write | ✅ **27/27 on the fourth run, 2026-09-17.** Three bugs found and fixed along the way |
| Project page rendering | ✅ **Verified on a real render, 2026-09-18** — desktop and phone width, top and bottom (`11` §Rendering) |
| n8n workflow | ✅ Imported into n8n Cloud 2026-09-18, 23 nodes, active, executing |
| Workflow Code nodes | ✅ 30 assertions, `node tests/test-workflow.js` (added 2026-09-28) |
| `project.label_added` webhook | ✅ Webhook `282006`, delivering, authenticating, 200 |
| WordPress auth from n8n | ✅ Resolved 2026-09-28 — it was a missing `www` (`07` §15.1) |
| **End-to-end run** | ✅ **Phase 4 goal met, 2026-09-29 02:22.** One real project → one real correct draft, verified field by field and on the rendered page (`07` §16.8) |
| **PII review** | 🔴 **Failed, then contained.** One curated photo was a signed checklist carrying the homeowner's name and address. Public for ~2 hours; deleted and cache-purged, verified gone (`07` §16) |
| **Pin offset** | ✅ **0.2500 mi, bearing 121°** on the real draft (`07` §16.7) |
| Draft fields | ⚠️ All correct except `completion_date`, which landed empty — CompanyCam sends epoch integers, not ISO (`07` §16.7). Fixed in the repo, **not yet in n8n** |

**Nothing is blocked on a decision.** Every open item is an action.

---

## Pick up exactly here (about 15 minutes)

The TasteWP sandbox from 9/17 has expired. That cost nothing — it was disposable on purpose, and both bugs it found are already fixed in this repo.

1. **New sandbox.** [tastewp.com](https://tastewp.com) → create a free site. No signup.
2. **Upload two plugins** (Plugins → Add Plugin → Upload):
   - `dist/skybird-projects.zip`
   - `dist/skybird-selftest.zip` — sandbox only, never the live site
   Activate both.
3. **Optional:** install **Advanced Custom Fields** (free) from the plugin directory. Clears the admin notice and confirms the field group registers.
4. **Tools → Skybird Self Test → Run the checks.** Copy the plain-text box.

**Done 2026-09-17: 27 passed, 0 failed.**

## Rendering — done 2026-09-18

A project page has now been loaded on a real WordPress install, at desktop
and at phone width, top and bottom. Four defects came out of it, all fixed:

| Defect | How it surfaced | Fix |
|---|---|---|
| Page rendered outside the site chrome | Block-theme sandbox fell through to the deprecated theme-compat stubs | Theme-aware `skybird_projects_header()` / `_footer()` wrappers |
| Subtitle restated the H1 verbatim | First render | Replaced with an eyebrow carrying location + completion date |
| Eyebrow *still* restated the H1 | Second render, on a project with **no completion date** — the first fix only hid it when a date happened to be set | Print the area only when the title does not already contain it |
| Unparseable `completion_date` would render as "December 1969" | Found while extracting the rule; `date_i18n( 'F Y', false )` renders the epoch rather than failing | Guard `strtotime()` before formatting |

The recurring lesson, third time now: **the stub suite is a regression net,
not evidence the thing works.** 121 passing assertions still shipped an
eyebrow that duplicated its own H1, because the template's *source* was
correct and only its *output* was wrong. That is why the eyebrow rule now
lives in `skybird_projects_meta_line()` rather than inline in the template —
a function the suite can exercise, rather than markup it can only grep.

Still unverified: the **map shortcode** (never placed on a page) and the
**ACF field group** (ACF has been inactive on every run so far).

If the zips aren't to hand, rebuild them:

```bash
python3 - <<'PY'
import zipfile, os, pathlib
for name in ('skybird-projects','skybird-selftest'):
    src = pathlib.Path('plugin')/name
    out = f'dist/{name}.zip'
    os.makedirs('dist', exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(src.rglob('*')):
            if p.is_file():
                z.write(p, arcname=str(pathlib.Path(name)/p.relative_to(src)))
    print(out)
PY
```

Then `php tests/test-plugin.php` should print **127 passed, 0 failed**.

---

## After that, in order

| # | Step | Needs |
|---|---|---|
| 2 | Import `n8n/companycam-showcase-to-wordpress.json`, attach credentials, activate | `n8n/README.md` has the steps. Sandbox URL as `WP_BASE` |
| 3 | Create the `project.label_added` webhook pointed at the **Production** URL | **Capture the signing token — shown once** |
| 4 | Remove and re-add the `Website Showcase` label on project `110848078` | Proves the four steps in `07` §2.3 |
| 5 | Review the draft against the checklist in `06` §3 | |
| 6 | Repeat on production, drafts only | Euan's `skybird-sync` user |

Step 4 is the real milestone — it is the first time the trigger has ever fired.

---

## Waiting on other people

- **Euan** — two questions sent 2026-09-17, unanswered: is there a security plugin restricting REST or Application Passwords, and can he create `skybird-sync` (Editor, `skybirdroof+wpsync@gmail.com`). Neither blocks steps 1–5 on a sandbox; both block step 6.
- **John/Jacob** — who owns `handsome-salmon-665.convex.site`, which receives every photo created in Skybird's CompanyCam (`07` §2.3). Not blocking, still unexplained.
- **ProLine read path** — `01` §4.2 Q2, now answerable only from the ProLine account directly. Parallel work; the reviewer fills product fields by hand until then.
- **Production HQ sheet retrofit** — Grok Bot, in progress, explicitly not to be built against (`07` §2.4.3.1).

---

## The one lesson worth carrying forward

The plugin had **105 passing assertions** and still shipped two real bugs, both found within minutes of a real install:

1. `approx_lat`/`approx_lng` registered as `number` with a `''` default — WordPress silently dropped both from the REST schema, so the coordinates were never stored at all. The self-test's own 0,0-rejection check *passed* while this was broken, because an absent field reads as empty.
2. Taxonomy labels fell back to category wording. Twice — the first fix defined fifteen labels and missed the six nobody thinks to set.

Both were invisible to the harness because it records registration arguments without validating them the way WordPress does, and never renders admin copy. Assertions were added for both, and the type-mismatch one was verified by reintroducing the bug on purpose and watching it fail.

**So: the harness is a regression net, not evidence the thing works.** Every remaining step in the table above is an install-and-run step for the same reason. Don't let a green suite stand in for a real run — and be suspicious of a check that passes when the thing it checks is missing entirely.

---

## Environment note

`skybirdroofing.net`, `app.n8n.cloud`, `api.companycam.com` and the sandbox hosts are all **blocked** from the build environment. The account has one environment, `Default — trusted network access`, and that preset permits a fixed list of development hosts with no per-domain additions (`07` §3). Changing it requires switching the environment's network setting, not adding domains — and then a new session.

Consequence: the checks above have to be run by a person, or the environment changed. The CompanyCam MCP connector is unaffected and is how everything in `07` §1 was verified.


---

## The plugin needs re-uploading

`dist/skybird-projects.zip` carries the storm-date lock and the three
page-definition items below. Upload it (Replace current with uploaded)
before reviewing any project.

## Next action, 2026-09-18 — Task 2: credentials and Config

The workflow is imported and on the canvas. It was reworked that same day for
**n8n Cloud, Community (free)**, where `$env` is blocked and `$vars` is
Pro-only — see `n8n/README.md` for why and what changed. **Re-import the
current JSON first**; the copy already on the canvas is the old `$env` build
and every config reference in it is dead.

Then, in order — `n8n/README.md` § Import has the full table:

1. Create three credentials: `CompanyCam Webhook Auth` (Header Auth),
   `CompanyCam API` (Header Auth), `WordPress skybird-sync` (Basic Auth).
2. Attach each to its nodes; the `REPLACE_ME_*` placeholders will not resolve
   on their own.
3. Set `wpBase` in the **Config** node to the sandbox URL.
4. Activate, copy the **Production** webhook URL — not the Test URL.
5. Create the CompanyCam subscription on `project.label_added` against that
   URL, with `authorization_header` matching the webhook credential exactly.

### Resolved 2026-09-21 by Euan's second reply (`09`, Second reply)

- **Which WordPress: the `/shenzhou/` staging clone.** `skybird-sync` now
  exists as an Editor there and on the live site, and staging is a clone of
  the real stack — Hub Child, WPBakery, the real plugin set. That exercises
  what TasteWP could not. **The plugin has to be installed on staging first**;
  it has only ever run on a sandbox. Set `wpBase` to the staging URL.
- **No security plugins on the site**, so nothing should block Application
  Passwords or the REST API.

### Before using the sync credential

The Application Password came through in the body of a plain email and is now
in two mailboxes, a PDF and a session transcript. It is an **Editor**
credential on the **live** site. **Revoke it, generate a replacement, and
paste the replacement straight into the n8n credential** — see `09` §4. The
exposed one is tolerable against `/shenzhou/` only, never production.

Also: the received value contains a `%`, which
`wp_generate_password( 24, false )` cannot emit. If it 401s, that is why —
get a fresh one rather than debugging the request.

### Still waiting on Jacob

- **Who creates the CompanyCam subscription.** It needs the shared bearer
  secret in two places, n8n and CompanyCam. Claude has CompanyCam write tools
  and can create it, but would have to be told the secret, which would put it
  in the session transcript — exactly what went wrong with the WordPress
  password. **Recommend Jacob creates it himself.**

### Still true

Nothing has been executed. The four things a first run has to prove are in
`n8n/README.md`, and the test project was re-verified on 2026-09-18 (`07` §9)
and is ready: one label, four Showcase photos, one of them the cover.


---

# Where it stands, 2026-09-22 00:45

The first real end-to-end run happened tonight. It got 19 of 23 nodes deep and
stopped on something that is not ours to fix.

## Proven on real data — no longer assumed

| | |
|---|---|
| CompanyCam webhook `282006` | Created, `project.label_added`, `authorization_header_set: true` |
| **Delivery fires on a label add** | ✅ CompanyCam's log: `success: true`, **200 in 542 ms** |
| **Header Auth on the webhook** | ✅ A real delivery authenticated and ran |
| **Payload parse** | ✅ Shape captured and corrected — see `07` §11, payload saved under `docs/vendor/companycam/` |
| **Label filter** | ✅ `isOurs: true` for Website Showcase, `false` for Pipedrive Deal, on live data |
| **Plugin on production** | ✅ Installed, active; `projects` and `service-areas` routes both answer |

## Blocked — WP Engine ticket #8642797 (escalated, reply by email)

Every WordPress write fails because Application Passwords never authenticate.
The `Authorization` header is not reaching PHP. Both production and the
`/shenzhou/` clone, fresh passwords on each. Full diagnosis and everything
ruled out: `07` §12.

**This is not a code problem and no change to this repo can fix it.** Do not
build a custom-header auth shim as a workaround without recording that decision
first — `07` §12.5 says why.

## When WP Engine replies

If they pass the header through, the remaining path is short — the workflow and
plugin are already configured and saved:

1. Fire the trigger: remove `Website Showcase` from Bill Najdecki
   (`110848078`), confirm it cleared, add it back.
2. Watch Executions. The next four nodes are all first-time:
   `Already Drafted?` → `Get Project` (first real test of
   `api.companycam.com/v2`, which the audit calls legacy) → `Curate` →
   `Upload Media` → `Create Draft`.
3. Check **Last Used** on the production Application Password. It populating is
   the proof the credential path works.

## Current n8n state

- Workflow active, 23 nodes, all nine credentials attached
- `Config.wpBase` = `https://skybirdroofing.net` (production)
- **`Already Drafted?` URL is still the `users/me` diagnostic.** Restore it
  before the next run:
  ```
  {{ $('Config').first().json.wpBase }}/?rest_route=/wp/v2/projects&companycam_project_id={{ $json.projectId }}&status=any&per_page=1
  ```
- `CompanyCam API` credential holds the `webhook-setup` key (read+write). Swap
  to the read-only `Skybird Website Sync` key and delete `webhook-setup` once
  the run passes — `01` §1.6 specifies read-only for Phase 4.

## Traps that cost time tonight, so they don't again

- **n8n retry replays upstream node outputs.** Change `Config` → fire a fresh
  delivery. Change the failing node or a credential → retry is fine. (`07` §12.3)
- **Removing a label in CompanyCam's UI can silently not take.** Verify the
  label list before concluding a trigger failed. (`07` §11.5)
- **A rejected delivery leaves no execution at all.** Header Auth is enforced
  before the workflow runs, so check CompanyCam's delivery log, not n8n.
- **Read the resolved URL under an HTTP node's URL field.** It shows what was
  actually requested. A double slash from an empty expression looks exactly
  like a dead API host.


---

# Where it stands, 2026-09-28

The auth block is gone, and so are the two bugs behind it. What is left is a
short list of n8n runtime behaviours that each cost one delivery to find.
**All four are fixed in this repo and covered by tests. The workflow in n8n
Cloud has only the first two.**

## Fixed and already applied in n8n

| | |
|---|---|
| `wpBase` missing the `www` | `https://skybirdroofing.net` 301s to **`http://www.…`** — a scheme downgrade, and every HTTP client drops `Authorization` across one. Six days of "the header never arrives" was this. (`07` §15.1) |
| `Is New?` reading `[]` wrong | An empty array is *zero items*, so the run reported success and built nothing. `Always Output Data` + `{{ !$json.id }}`. (`07` §15.4) |

## Fixed in this repo — **must be re-imported into n8n**

| | |
|---|---|
| `Curate` fired before the cover fetch ran | Two branches into one input is not a join. The fetches now run in series: `Get Project → Get Cover Photo → Get Showcase Photos → Curate`. (`07` §15.5) |
| `Curate` and `Build Payload` read a list with `.first().json` | An array response is *N items*; `.first().json` is the first element. Now `.all()`. Would have thrown `showcase.filter is not a function` the moment the wiring was fixed. |

`Get Cover Photo`, `Get Showcase Photos` and `Get Area Term` also gained
**Always Output Data**, so an empty response produces the intended loud error
instead of a silent success.

## Pick up exactly here

1. **Re-import the workflow.** n8n → Workflows → Import from File →
   `n8n/companycam-showcase-to-wordpress.json`. **Into an empty workflow**, not
   on top of the existing canvas — importing over live nodes creates `Curate1`,
   `Config1` and friends while every `$('Node')` reference keeps pointing at the
   originals. Nothing errors; the run just quietly uses the old ones.
2. **Re-attach the credentials** — the JSON carries placeholder IDs. Webhook →
   `CompanyCam Webhook Auth`; `Fetch Project Labels` / `Get Project` /
   `Get Showcase Photos` / `Get Cover Photo` → `CompanyCam API`;
   `Already Drafted?` / `Upload Media` / `Get Area Term` / `Create Draft` →
   `WordPress skybird-sync`.
3. **Set `Config.wpBase` to `https://www.skybirdroofing.net`** — with the `www`.
   This is the one that cost six days.
4. **Activate**, and point webhook `282006` at the production URL if the import
   changed it.
5. **Fire it:** remove `Website Showcase` from Bill Najdecki (`110848078`),
   confirm the label list is actually clear, add it back. Do **not** retry the
   old execution — a retry replays stored upstream output and will not see any
   of this.

## Then verify the draft before anything else

`https://www.skybirdroofing.net/wp-admin/edit.php?post_type=project`

Expected: title *Roof Replacement in Youngsville, NC*, status **draft**,
featured image set, 4 media items, `Youngsville` service area,
`companycam_project_id` `110848078`, `completion_date` `2026-09-10`.

**The one that stops everything if it is wrong:** `approx_lat` / `approx_lng`
must be **0.2–0.3 mi** from the real coordinates `36.07117, -78.55830`. Equal
values mean the true location was published. The test suite proves the maths
over 2,000 draws; this confirms it survived the trip through WordPress.

Also confirm no PII anywhere: not the homeowner's name, street address,
phone or email, and nothing of the sort in any image filename or alt text.

## Still open after the draft lands

- Swap `CompanyCam API` to the **read-only** `Skybird Website Sync` key and
  delete the `webhook-setup` key (read+write) — `01` §1.6 specifies read-only.
- Revoke the `auth test` admin Application Password — it went through two
  support chats in plain text.
- Render `[skybird_project_map area="youngsville"]` — the shortcode has never
  been on a page.
- Tell Euan that non-`www` redirects to **`http://`**, not `https://`. That is
  a live misconfiguration on the real site, not just an n8n inconvenience.
- ProLine read path (`01` §4.2 Q2) — until it exists, titles stay town-only and
  the specs table stays empty.


---

# 2026-09-28, 01:19 — it ran, and it leaked

Every node worked. The pipeline published a homeowner's name and street address
anyway, because one of the four `Showcase`-tagged photos was a photograph of a
signed post-install checklist. Full account: `07` §16.

## Do these in order

1. ~~Delete attachment 1175~~ — **done 2026-09-28.**
2. ~~Purge the cache~~ — **done.** The delete alone was not enough: Cloudflare
   held the `-scaled` copy on a one-year TTL and kept serving it. A WP Engine
   *Quick clear all cache* fixed it. Verified 404 from outside.
3. ~~Untag the photo in CompanyCam~~ — **done 2026-09-28.**
4. ~~Read the draft's `approx_lat` / `approx_lng`~~ — **done, and it passes.**
   `36.069334, -78.554441` is **0.2500 mi (1,320 ft)** from the real location,
   bearing 121°. The offset works.

## Then decide the thing that actually matters

**A draft does not protect its attachments.** Media is served straight off disk
the moment `POST /wp/v2/media` returns — before `Create Draft` runs, before any
human sees anything. "Nothing publishes automatically" was only ever true of
the *post*.

`07` §16.4 lays out three options. The only one that closes it is splitting the
workflow so a human approves the photo set **before** anything uploads. That
changes the shape of the Phase 4 deliverable, so it is Jacob's call, not a
change to make quietly.

Until then the control is entirely manual: **look at every photo in CompanyCam
before adding the `Website Showcase` label.** Not the filenames — the pictures.

## Also open from this run

- **Something on the live site writes AI alt text onto uploads**, describing
  image contents. The plugin generates alt at render time from product fields
  and assumed nothing else did (`07` §16.5). Find the plugin; decide whether it
  should touch `project` media at all.
- The four filenames, the cover choice, the gallery order and the draft status
  were all correct. The failure was upstream of the code and downstream of the
  gate.


---

# 2026-09-28, 02:10 — what is left

The pin passes. That was the one that could have ended the project.

## In the repo, not yet in n8n

**`Curate` mishandled `captured_at`.** CompanyCam sends Unix epoch seconds as
an integer; the code sliced it as if it were an ISO string and produced
`"1789049525"`, which the plugin's date sanitiser correctly threw away. That is
why `completion_date` is empty on post 1177.

Re-paste the `Curate` body from
`n8n/companycam-showcase-to-wordpress.json` — it now has a `capturedMs()`
helper at the top of the sort block. Nothing else changed.

## Post 1177 needs two hand edits, or a clean re-run

| | |
|---|---|
| `completion_date` | empty → `2026-09-10` |
| `gallery` | `[1176, 1174, 1175]` → `[1176, 1174]` — 1175 is the deleted checklist |

Neither field is in the ACF panel, so either edit them via the REST API as a
logged-in admin, or **delete the draft and re-run the trigger** once `Curate`
is updated. A plain re-run without deleting does nothing: `Already Drafted?`
will find 1177 and correctly drop the delivery.

## Still open

- **The upload gate** (`07` §16.4) — the real decision. Media is public the
  moment it uploads; the review gate sits after it.
- **Per-project detail** (`docs/12`) — every page is currently the same
  sentence with the town swapped, which is the shape search engines treat as
  doorway pages. The capture field already exists (CompanyCam's Project
  Description, already in the payload) and is empty. Proposed, not built.
- **Whatever writes AI alt text onto uploads** (`07` §16.5). Imagify is
  installed and is the likely culprit.
- ~~`approx_lat` / `approx_lng` have no admin UI~~ — **built.** A read-only
  **Map pin** box now sits in the sidebar of the project edit screen: the two
  values, a link to see where the pin lands, and a red warning when there is
  no pin or when it falls outside North Carolina (a swapped lat/lng or a
  dropped minus sign). It says plainly that it *cannot* confirm the offset —
  the true coordinates are never stored, by design, so there is nothing to
  measure against. **Needs the plugin re-uploading**: `dist/skybird-projects.zip`.
- Swap `CompanyCam API` to the read-only key; delete `webhook-setup`.
- Revoke the `auth test` admin Application Password.
- Render `[skybird_project_map area="youngsville"]`.
- Tell Euan about the non-`www` → `http://` redirect.
- ProLine read path (`01` §4.2 Q2).


---

# 2026-09-29, 02:35 — Phase 4 is done

**One real CompanyCam project → one real WordPress draft, nothing published
automatically.** Verified on the rendered page and field by field in `07` §16.8.

Pin landed **0.2377 mi at bearing 281°**, against run 1's 0.2500 mi at 121° —
a fresh draw per run, which is the property that makes the offset
irreversible.

## One thing needs re-uploading

`dist/skybird-projects.zip` — the project H1 was rendering **white on white**.
Not our bug: the theme Customizer sets `h1 { color: #ffff }` site-wide, which
is invisible on any light background. Hub's own pages hide it by putting every
H1 inside a dark hero row; a project page has none.

**Tell Euan.** A one-character fix in the Customizer makes every
light-background H1 on skybirdroofing.net visible, not just ours.

## Next session, in order

1. **The upload gate** (`07` §16.4) — the real decision, and the one that
   stands between this and a workflow that can run unattended. Media is public
   the moment it uploads; the review gate sits after it.
2. **Credential hygiene** — swap the n8n `CompanyCam API` credential to the
   read-only key and delete `webhook-setup`; revoke the `auth test` admin
   Application Password, which went through two support chats in plain text.
3. **Media accumulates on every re-run** (`07` §16.8). 1173, 1174 and 1176 are
   orphans; nothing cleans up, and re-running is not free.
4. **`docs/12`** — the notes path, for pages that aren't all the same sentence.
5. Whatever writes AI alt text onto uploads (`07` §16.5).
6. Render `[skybird_project_map area="youngsville"]` — needs a published
   project, so it waits on the first real publish.


---

# 2026-10-14 — the upload gate is built

**The biggest open item is closed.** Media is no longer uploaded before anyone
looks at it. Full account in `07` §17.

`Build Payload` now sends candidate photo URLs instead of uploading. The draft
arrives with no featured image, no gallery, and nothing on the server. A
**Photos awaiting approval** box on the project edit screen renders the
candidates straight from CompanyCam; only what you tick is ever fetched, and
it comes in through WordPress's own sideload path so the EXIF stripper runs on
every one.

Four n8n nodes deleted: `Prepare Photo Items`, `Download Photo`,
`Upload Media`, `Collect Media`. 23 → 19.

## To put it live

1. **Upload `dist/skybird-projects.zip`** (Replace current with uploaded).
2. **Re-import the workflow** from
   `n8n/companycam-showcase-to-wordpress.json` into an empty workflow, re-attach
   the credentials, set `Config.wpBase` to `https://www.skybirdroofing.net`.
   Four nodes are gone, so pasting single node bodies will not do it this time.
3. Delete draft 1183 and the leftover media, then re-fire the label.

## Blocked, and not on us

**n8n cannot read the Showcase Details checklist.** Advanced (conditional)
checklists have no public API — no endpoint, no webhook scope. Legacy
checklists have both, but the entire Core API they live on is deprecating in
early 2027.

A question is with CompanyCam (see the chat of 2026-10-14) asking whether
advanced checklists are coming to the public API and what the migration path
is. **Do not rebuild on legacy until they answer** — that would be building on
a stated end-of-life to get a content enhancement, while the pipeline already
works without it.

What this blocks: `manufacturer`, `product_line`, `color`, `warranty`,
`storm_date`, `package` and the checklist-derived copy. All the plugin-side
fields, containment and reviewer UI for them are built and tested; only the
read is missing.

## Still open

- Publish the first project. Phase 4 produced a correct draft on 2026-09-29
  and nothing has ever been published, so the map shortcode has still never
  rendered and the referral layer still has no page to live on.
- Credential hygiene: swap n8n to the read-only CompanyCam key, delete
  `webhook-setup`, revoke the `auth test` application password. **Also rotate
  the key that appeared in a screenshot on 2026-10-09.**
- Whatever writes AI alt text onto uploads (`07` §16.5) — likely Imagify.
- Tell Euan about the site-wide white `h1` and the non-`www` → `http://`
  redirect.

---

# 2026-10-15 — The North Star was corrected, and so was my definition of a page

Two things happened in this session that change the order of the work.

**1. `CLAUDE.md` now exists**, read automatically at the start of every
session. It is one page, and it records four drifts — all mine — including
that I wrote the North Star itself backwards in the first draft of that very
file. Read it before anything else.

**2. The referral layer is the goal.** Jacob:

> "The map and the pages are scaffolding. The thing that makes money is a
> past customer sharing a link and a lead arriving with a code attached."

The map is #2 and the dead `/gallery/` page is #3. I had them as #1 and #3
with the referral last.

**3. There is now a definition of a page worth publishing** —
`docs/13-page-definition.md`, with the external review it came from stored
verbatim at `docs/vendor/reviews/grok-page-definition-2026-10-15.md`.

The three things from it that matter most:

- **The audience I had never designed for is the customer deciding whether
  to put their name on it.** Everything else on the page serves that.
- **The storm date is now internal only.** I built the field on 2026-10-09
  and argued claim framing was legitimate reporting. The review said leave
  claim language out entirely, because a page the homeowner shares with
  their own friends announces their insurance claim. Jacob agreed, and
  `storm_date` is `private` as of this session: stored, visible in wp-admin,
  stripped from REST, never rendered. Four assertions fail if that is
  undone. `docs/13` §1.
- **The referral code may not survive a Facebook share, and nobody has
  tested it.** `og:url` must be undecorated, per Meta; `?ref=CODE` is
  exactly what that rule strips. If it is dropped, the referral layer fails
  silently while looking like it works. Build `/r/CODE` as a path instead,
  and test one real share before any link goes to a customer. `docs/13` §3.

## The plugin needs re-uploading

`dist/skybird-projects.zip` carries the storm-date lock and the three
page-definition items below. Upload it (Replace current with uploaded)
before reviewing any project.

## Next action

Take draft 1183 through the `docs/13` §5 gate by hand, one line at a time,
and publish it. It fails most of that gate today. Let what is painful about
doing it manually decide what gets automated next — not the reverse.

### Built since, same day

- **Per-photo captions and per-photo alt text** (`c5787df`). Every photo on
  a page used to carry one identical alt attribute. Captions are editable
  from the project screen and render under each photo.
- **The banned-phrase scan** (`includes/copy-guard.php`, same commit). Warns,
  never blocks; scans only what a human typed, never the job record.
- **Open Graph tags and a 1200×630 share crop** (`8fa870a`). The admin box
  shows the reviewer the actual crop, because that is what gets shared and
  the crop is not the photo.
- **Breadcrumbs + `BreadcrumbList`** (`2543f00`), which closed the flagged
  404 — six of the fourteen areas have no hub page, and the crumb and the
  footer back-link now both resolve against a real page first.

### Still queued, agreed, not started

- Crawlable HTML links in the map shortcode.
- The "more roofs nearby" sibling cards from `docs/13` §6 item 13.
- The six missing service-area hub pages. Nothing in code can fix this; the
  links are now invisible rather than broken, which is containment, not a
  fix. Euan's list.
- The `/r/CODE` referral path, and the one real Facebook share that has to
  be tested before any link goes to a customer (`docs/13` §3).

### Waiting on Jacob

1. **Does the human H1 become the default?** `docs/13` §3 says yes,
   `docs/06` §3 says keyword-first. Currently opt-in per project, so
   nothing changed for existing pages.
2. **The credentials sentence**, which ships empty. One confirmed sentence
   — generation count and programme name — and it goes live site-wide.
3. **Which SEO plugin the site runs.** If Yoast, Rank Math or AIOSEO is
   active, the plugin prints no preview tags at all rather than compete, so
   the share image needs wiring into whichever one it is.

---

# 2026-10-16 — What is actually on the live site

Checked from outside the network, not assumed.

## All in One SEO Pro is active

So `includes/open-graph.php` prints **nothing**. The stand-down is working as
designed — two competing sets of `og:title` would let Facebook pick between
them — but the effect is that yesterday's Open Graph work is dead code on the
live site until it is wired into AIOSEO.

**Built the same day** — `includes/aioseo.php`. Instead of competing, the
plugin hands AIOSEO our values through its own `aioseo_facebook_tags` and
`aioseo_twitter_tags` filters and lets it print them.

The array shape was read from the plugin source
(`app/Common/Social/Output.php`), not guessed. Three things only the source
tells you:

- `array_filter()` runs **after** the filter, so setting a value to `''` is
  how a tag gets removed.
- The view prints every value through `esc_attr()`, so we pass raw strings;
  pre-escaping would escape something about to be escaped.
- AIOSEO builds its image block with `+=`, which does not overwrite existing
  keys. Its `og:image:width`/`height` describe **its** image, so swapping in
  our crop without correcting them would declare 2016x1512 next to a 1200x630
  file. Meta reads those dimensions to render the first share.

It also closed a silent-nothing hole: `getFacebookMeta()` returns early,
before the filter, when AIOSEO's Facebook module is switched off. In that
state AIOSEO prints nothing, our filter never runs, and `open-graph.php` is
standing down — nobody emits anything and nothing says so. AIOSEO hooks
`wp_head` at priority 1, so a check at 99 prints our own tags if the filter
never fired. Deliberately narrow to AIOSEO: Yoast and Rank Math keep the
plain stand-down, because a fallback that guessed wrong would print the
duplicate tags the stand-down exists to prevent.

WP Rocket is also active. Clear its cache after any plugin change.

## The four photos are two photos

| File | Bytes | md5 (first 12) |
|---|---|---|
| `...-110848078-cover.jpeg` | 208,002 | `731dfc9d93dd` |
| `...-110848078-cover-1.jpeg` | 208,398 | `10770bb5c24c` |
| `...-110848078-2.jpeg` | 204,497 | `9069da074b87` |
| `...-110848078-2-1.jpeg` | 204,497 | `9069da074b87` |

`-2` and `-2-1` are **byte-identical**. `-cover` and `-cover-1` are the same
picture re-encoded. Both pairs are duplicates from two runs of the old
pre-gate pipeline — note the `-cover` suffix, which `photo-gate.php` never
produces (it numbers files `-1`, `-2`, …).

## They are clean

No GPS, no XMP, no DJI maker-note in any of the four. Each carries a 34-byte
Exif stub and nothing else. The 2026-09-29 GPS leak (`07` §16.9) is not
repeated here.

## Only one of the two is publishable

- **The cover** is a top-down drone shot of the finished roof. No house
  number, no people, no plates. Usable.
- **The other** is mid-tear-off: a crew member on the roof, underlayment
  exposed, debris across the lawn, tarps, a dumpster, torn-up planting, and a
  Skybird banner. `docs/13` §2 lists mess and in-progress shame as the things
  that make a homeowner quietly decide not to share. It should not go on the
  page as it stands.

So this project has **one** usable photo and the gate wants three to six
captioned ones. It cannot pass on photos alone.

Two things worth Jacob's judgement:

1. The usable shot is straight down. It shows the roof well and the *house*
   not at all, and an aerial outline plus a town name is findable on satellite
   view. A ground-level finished shot would serve the "would they post this"
   test better.
2. It is 1280×720 — just wide enough for the 1200×630 share crop. Any photo
   narrower than 1200px cannot make that crop at all.

---

# 2026-10-16 (later) — Shipping ONE page: project 110848078

Jacob: *"Stop building new backend features. Our next goal is to ship ONE
real, live project page end to end, then fix bugs from there."*

The job is **ProLine #2561**, Youngsville NC, CompanyCam project
`110848078`. Referred to by those IDs only — the homeowner's name, street,
phone and email are in the CompanyCam record and go nowhere near this repo,
the page, or a filename.

## The one blocker, and the one-line fix

Re-tagging on 2026-10-16 created a **new** tag:

| Tag | ID | Created |
|---|---|---|
| `Showcase` | 27372163 | 2026-09-14 |
| `Showcase Cover` | 27372182 | 2026-09-14 |
| **`Showcase Photos`** | **27817590** | **2026-10-16** |

No tag named "Showcase Photos" existed, so tagging made one. The workflow
was still querying 27372163, so the five correctly tagged photos would have
come back as **zero**, the gallery would have been empty, and the run would
have reported success. The silent-success shape again, arriving through a
tag vocabulary instead of through n8n.

`Get Showcase Photos` now queries **27817590**. One field. A test pins both
IDs, because they are invisible in the URL and nothing else checked them.

Querying only the new tag has a second effect worth keeping: the two photos
Grok flagged for removal (`3547119850` tear-off with crew, `3421903489`
inspection close-up) carry only the OLD `Showcase` tag, so they are excluded
automatically. **Untagging them by hand is hygiene, not a blocker.**

Note `3421903489` also carries true coordinates (36.0712, -78.55825) and is
the project's feature image — almost certainly the 2026-09-29 GPS leak
(`07` §16.9). Leaving it out matters.

## The six photos, verified

Pulled and looked at, not taken on trust. None shows a house number,
mailbox, street sign, plate, person or paperwork.

Gallery, in capture order (which is the order the page renders):

| Photo ID | Caption |
|---|---|
| `3552989639` | Shingled dormer with white trim and a double window |
| `3552991576` | Finished shingle roof planes and a white-trimmed gable |
| `3552997063` | Ridge caps where two roof planes meet over a brick gable |
| `3627107072` | Brick gable with a copper roof over the window below |
| `3627107263` | Standing-seam copper roof over a bay window in a brick gable |

Cover: `3553007383`, the overhead drone shot. Captured 2026-09-10 14:12,
which is where `completion_date` comes from.

**Correction to the tagger's report.** It said there is no ground-level
cover. `3627107072` *is* ground level — brick gable, window, shutters, new
copper, blue sky, 2048×1536. It is not a whole-house shot, but as a hero it
beats the drone photo on every test that matters: it is at eye level, it
shows the craftsmanship that makes this job distinctive, and it does not
hand anyone an aerial outline to match against satellite view.

Two judgement calls for Jacob, neither a blocker:

- `3552989639`, the dormer, shows the room through the window — it reads as
  a bathroom. Nothing identifying, but it is someone's interior.
- The copper in `3627107072` and `3627107263` still has protective film on
  some panels. Accurate to the day it was taken; slightly less than finished.

## What I cannot do

**I have no WordPress credentials, by design** — they live in the n8n
credential store and never in this repo (CLAUDE.md). So I cannot create the
draft, import the photos, or press Publish. Everything up to that point is
done; the publish steps are Jacob's, and they are written out in chat.

---

# 2026-10-28 — Twelve days on, checked rather than remembered

Nothing was committed between 2026-10-16 and today. Picking up where the
publish steps were handed over.

## Checked from outside the network

| | |
|---|---|
| `/wp-json/wp/v2/projects` | returns `[]` — **zero published project pages** |
| The four old media files | all 404 — deleted, so the cleanup step was done |
| `/service-areas/youngsville-nc/` | **200** |
| Both test suites | 368 + 36, green |

So: the media cleanup happened and then the run stopped. Whether a draft
exists cannot be seen from outside — an anonymous REST call returns only
published posts.

**Still nothing has ever been published.** Day 29 since the first correct
draft existed. This remains the top item in `CLAUDE.md`.

## The hub-page prediction, now verified

The six areas added from the Production HQ sheet were predicted to have no
hub page. Measured today:

| Hub page | |
|---|---|
| youngsville, wake-forest, raleigh, rolesville, franklinton, knightdale, goldsboro, greenville | **200** |
| pikeville, wilson, la-grange, winterville, durham, zebulon | **404** |

Exactly the original eight against the six that were added later. The
containment in `includes/breadcrumbs.php` holds: a project in one of those
six renders no area crumb and no back-link rather than two dead links. Six
hub pages still need building, and that is Euan's list, not code.

**For the first page this is a non-issue** — Youngsville is one of the
eight, so its breadcrumb and back-link will both resolve.

## Second candidate assessed: ProLine #1983, Raleigh

CompanyCam project `96150753`. Jacob asked to switch the first page to it.
Checked before switching. **I would not use it as page one**, and the
reasons are worth recording because they are a pattern, not a one-off.

**It is uncurated.** No `Website Showcase` label. Zero photos carrying any
of the three showcase tags, out of 205. Switching restarts the whole
curation step that was already finished for the other project.

**The job finished yesterday.** The signed post-installation checklist in
the album gives an install date of 2026-10-27 and an inspection date of
2026-10-28 — today. Two items are ticked **Needs Attn**: exposed nails to
be caulked, and leftover materials still on site awaiting supplier pickup.
A page for a job whose punch list is still open, photographed before the
site is clear, is not a page a homeowner is proud to share.

**The album contains the exact leak vector from `07` §16.1.** Three of the
newest photos were sampled; two carried the homeowner's name and one of
those also carried the full street address:

- a photographed **signed quality checklist on a clipboard** — printed
  homeowner name, full street address, install date, inspector signature;
- a **phone screenshot of a Notes list** headed with the homeowner's name.

Neither is tagged, so neither would reach the pipeline — the tag filter and
the approval gate both hold. But it confirms the hard rule is live: an
active job album is full of operational paperwork, and the newest photos on
any job are the most likely to be it. The sample was biased toward
paperwork by design (newest first, right after an inspection); it is not a
claim that two thirds of the album is PII.

**Recommendation.** Keep ProLine #2561 as page one — curated, captioned,
six photos verified clean, and the job is six weeks settled. Use #1983 as
page two once its punch list closes and someone goes back for finished
photographs.

One useful crumb from the materials list, to be confirmed against
Production HQ rather than taken from a screenshot: the shingle is logged as
"NS", which `includes/product.php` resolves to GAF Timberline Natural
Shadow.

## Why the selected photos look flat: the beauty shots do not exist

Jacob, on the five curated photos: *"I just don't like the photos that the
curation process selected."* Right instinct, wrong culprit.

I pulled contact sheets of **70 photos** across both completion windows —
the 2026-09-10 close-out run (40) and the 2026-10-01/02 copper and gutter
run (30) — and looked at every frame. The album contains three kinds of
photograph and no fourth:

1. **Workmanship close-ups** — ridge caps, step flashing, drip edge, vents.
2. **"No new damage" documentation** — windows, siding, the HVAC unit.
3. **Eave and gutter inspection frames**, shot down from a drone.

There is no shot of the house. Not one frame taken from the street, the
driveway or the lawn with the building in it. The curation picked sensibly
from what was there; what was there is a job file, not a portfolio.

**This is a process gap, not a curation bug, and it applies to all ~200
back-catalogue jobs.** Nobody has ever been asked to take a photograph for
a homeowner to be proud of — only photographs that prove the work was done
and nothing was broken. Those are different pictures.

### Best of what exists

| Photo | What it is | Verdict |
|---|---|---|
| `3553006512` | Gable peak and ridge cap against sunlit autumn trees | **Best frame in the album.** Clean, well-lit, nothing identifying |
| `3627107477` | Front porch — brick, white columns, front door | The only "house" shot. No number, mailbox, plate or person — but a neighbour would know that porch at a glance |
| `3553007383` | The drone overhead, currently the cover | Shows the roof, not the house |
| `3627107072` | Ground-level brick gable with new copper | Already tagged; still the strongest of the five |

### The 20-minute fix

Send someone back with a phone. The roof is seven weeks old and still looks
new. Three frames would change the page completely: the house from the
street or driveway at three-quarters; the front elevation with the new roof
in frame; the copper from the ground in good light. Late afternoon.

Worth turning into a standing closeout step, because the alternative is 200
pages of flashing close-ups.

### Two other things found in this album

- `3553086721` is a **photographed signed quality checklist** — homeowner
  name and full street address, same vector as `07` §16.1 and the same as
  the one found in #1983 yesterday. Untagged, so excluded, but the pattern
  is clearly universal: every job file has one.
- `3553086467` is a materials screenshot listing **1 bundle HDZ shingles,
  1 bundle Seal-A-Ridge, 26 pieces F7 drip edge, 5 Omni ridge vents**. It
  corroborates GAF Timberline HDZ for this job and gives real caption
  detail. Confirm against Production HQ before it reaches a specs table —
  a phone screenshot is not the record.

---

# 2026-10-28 (later) — Third candidate: ProLine #2574, and a new rule

CompanyCam project `111049681`, Youngsville, 601 photos. No
`Website Showcase` label and no tagged photos yet.

**This album has what the other two did not: real exterior photographs of
the house.** Contact-sheeted the newest 42 frames. Alongside the usual
documentation there is a short set of front-elevation shots taken from the
driveway in good light, and a lot of copper work — valleys, bay roofs and
gable caps over stone.

`3627148981` is the first frame across three albums that passes the bar in
`docs/13` §2: stone and siding, copper on three gables, bay window with
columns, blue sky, mature planting. Nothing staged, nothing in progress.

## The catch, and the rule it changes

**That photograph has the homeowner's surname carved in stone in the front
flowerbed.** A monogrammed marker, with the family name and what appears to
be the street number beneath it, plus a security-company yard sign and a
wheelie bin at the kerb.

At contact-sheet size the marker is an unreadable grey blob. It took a
2:1 zoom on the full-resolution file to see what it was.

And here is the part that matters:

> **The centred 1200×630 share crop removes it.** The Facebook preview is
> clean. The gallery image is not.

`docs/13` §4 warns that the crop can pull in what the original framing left
out, and tells the reviewer to check the crop. This is the inverse, and it
is worse: the thing the gate tells you to check looks fine, while the
full-size image published beside it carries the name. A reviewer following
the gate to the letter would have shipped it.

**New rule, added to the gate: check the full frame AND the share crop.**
Neither one clears the other.

## Consequence for this job

The front-elevation angle looks across that flowerbed, so the marker is
likely in most shots from the driveway — `3625094498` is the same framing
(and also carries a lens artefact). For this property a hero has to be
either cropped above the bed or shot from an angle that excludes it.

A crop to the top 1900px of 2880 keeps the house and loses the marker, the
bin and the sign. It is still 2160px wide, so it clears the 1200×630 share
crop comfortably.

The cleanest route is to crop before upload and tag the cropped copy — it
keeps the gate's semantics intact, where cropping inside WordPress after
import would create derivative files that never passed the Exif stripper
(harmless here, since the source is already stripped and WordPress
re-encodes from it, but not a habit worth forming).

## Also in this album

- A run of walkthrough photos with **a hand and wrist in frame** giving a
  thumbs-up (`3603490716`, `3603489792` and around a dozen more). Several
  show the house beautifully and are unusable as they stand.
- `3627148946` is the front door in close-up — no PII, but the most
  recognisable frame of the lot.
- A photographed **supplier order form**. Paperwork again, in a third
  consecutive album.

## Worth knowing

This property is a few doors from ProLine #2561 on the same street, both
Youngsville. Publishing both is fine — neither page names a street — but
they should not run as "more nearby" cards pointing at each other, and the
offset map pins must not be allowed to land on the same spot.

## Why every curation so far has looked wrong — the structural answer

The tagger picked five close-up copper returns for #2574 and Jacob called it
a terrible job. I assumed my prompt was at fault and went to curate by hand.
The prompt was weak, but it was not the cause. **The cause is who takes
which photographs, and when.**

Capture dates and photographers for the 84 newest photos on `111049681`:

| Date | Photographer | Count | What they are |
|---|---|---|---|
| 31 Aug | Jacob (22) + John (10) | 32 | **The estimate visit.** Wide, well-framed elevations of the whole house |
| 16 Sep | John | 14 | Copper returns and bay roofs |
| 25 Sep | John | 11 | Walkthrough — **hand and wrist in frame**, thumbs-up |
| 1–2 Oct | Charly (19) + Jacob (2) | 21 | Siding, windows, garage, patio documentation; one front elevation |
| 22 Oct | John | 6 | Copper close-ups |

**The beautiful wide photographs of the house exist. They were taken on
31 August, before the work.** Every frame I shortlisted as a hero from the
second contact sheet — `3523690158`, `3523690039`, `3523690558`,
`3536524399`, `3523692167` — is from that one burst at 19:27 on 31 August.
Publishing any of them as finished work would put the **old roof** on a page
celebrating the new one.

Caught by checking capture dates before recommending them. Nothing in the
photographs themselves says "before"; the roof is dark in both.

### The pattern, and it is not about this job

The salesperson photographs the house. The crew photographs the work.

- Estimate visit → wide establishing shots, good light, whole elevations,
  because the point is to show the property.
- After the job → close-ups of flashing, copper, ridge caps, gutters,
  because the point is to prove workmanship and that nothing was damaged.

So **the pretty pictures are all "before" and the "after" pictures are all
detail.** That is true of all three albums examined: #2561, #1983 and #2574.
It explains the drone overhead being the only whole-house frame on #2561,
and it explains the five copper returns here. The tagger was not choosing
badly; it was choosing from what the post-install set contains.

### Consequence for #2574

Post-install, this album has no photograph of the shingle roof *as a roof* —
only copper detail, siding documentation, and the one front elevation
(`3627148981`, 2 Oct, which needs the crop for the yard marker). A gallery
built strictly from finished-work photos will be copper-heavy, because that
is what was photographed.

### The fix, which is cheap and permanent

At closeout, **retake the estimate angles**. Jacob already framed them well
on 31 August; standing in the same places six weeks later costs twenty
minutes and produces the hero every one of these pages needs. Add two
roof-plane shots while there.

Worth making a standing step. Without it, all ~200 back-catalogue pages
inherit this, and every curation will keep looking wrong for a reason that
has nothing to do with curation.

---

# 2026-10-28 — Fourth candidate, and the one to use: ProLine #2601

CompanyCam project `111393392`, **Goldsboro** — one of the eight areas with
a live hub page, so the breadcrumb and back-link both resolve. 350 photos,
no label and no tags yet. The project record has **no primary contact**, so
unlike the others it carries no name, email or phone.

## Why this one works

The 84 newest photos are **all post-install** — 9 and 14 October, every one
by the crew, against an install date of 2026-10-08 from the job's own
checklist. No before/after ambiguity to untangle, which is what nearly
tripped us on #2574.

And the photography is clean: no debris, no tarps, no dumpster, no crew in
frame, no hands. Consistent light. The roof itself is handsome — crisp
charcoal shingle with strong hip and ridge geometry.

It still has no ground-level photograph of the house. **But for this album
that stops mattering**, because the roof shots are good enough to lead with.

### The tension this resolves

"A page the homeowner is proud to share" has been pulling against "no
recognisable house, no number, no neighbours" for four albums. A roof-led
hero settles it: it is more private, more on-topic for a roofing page, and
available today without another site visit. What it gives up is the
"look at my house" quality. For page one that is the right trade.

## The set

Cover — `3647602938`. Gable peak and ridge cap against white trim. Reads as
a house at thumbnail size, which the purely abstract frames do not.

Gallery, in capture order:

| Photo | Caption |
|---|---|
| `3647595681` | New shingles meeting the gable end above the shutters |
| `3647596386` | Hip roof over the bay window, shingles run to the eave |
| `3647599128` | Two roof planes meeting at the gable |
| `3647600839` | Ridge cap running the full length of the hip |

All six are 1280×720 — clear of the 1200×630 share crop, but with no margin.
Anything narrower than 1200 cannot make that crop at all.

Five photos is a five-minute job by hand. **No tagger needed**, which
removes the failure mode that produced five copper returns on #2574.

## Must not be tagged

- **The house number "108" is legible on the siding in at least four
  frames** — the ones looking at the front door and the bay window corner.
  Fourth album, fourth distinct PII hazard: paperwork, a yard marker, a
  bathroom window, and now a house number on the wall.
- A photographed **signed quality checklist**, carrying the homeowner's name
  and full street address. Fourth consecutive album.
- A **materials screenshot**.
- `3647600086` — a fine ridge photo that also shows **neighbouring houses**
  clearly, including an identifiable porch and fence.
- Air-conditioning units.

## Record data from the job's own materials list

4 bundles HDZ shingles, 2 bundles SAR ridge cap, 17 pieces F7 drip edge, one
box of Omni ridge pro vents, 2 rolls of felt-buster underlayment, 2 sheets
of OSB. That gives **GAF Timberline HDZ** with Seal-A-Ridge ridge cap.
Confirm against Production HQ before it reaches the specs table — a phone
screenshot is not the record.

## Jacob's own curation — the reference standard

Jacob tagged #2601 himself and said: *"The first several of these showcases
that we do, I can do all these by hand, and you can listen to my tone of
voice and look at how I write."* So his selection is now the standard, not
`docs/13` §2, wherever the two disagree. What he picked:

**Cover** — `3647589715`, a wide aerial of the finished house. Exactly one
cover tag, so `Curate` will accept it.

**Gallery — eight photos, and they sort into a story.** The gallery renders
oldest-first, and his set spans 4 Aug to 9 Oct, so it comes out as
**before → tear-off → during → finished** with no extra work:

| # | Photo | When | What |
|---|---|---|---|
| 1 | `3449794170` | 4 Aug | The old roof, wide aerial |
| 2 | `3646458147` | 8 Oct 12:03 | Tear-off, decking exposed |
| 3 | `3646461298` | 8 Oct 17:45 | Underlayment down, **Skybird tent in the yard** |
| 4 | `3646461630` | 8 Oct 17:45 | Underlayment, tarps out |
| 5 | `3646464851` | 8 Oct 21:50 | Crew finishing in the evening |
| 6 | `3647592458` | 9 Oct 13:36 | Finished — gable and garage |
| 7 | `3647595146` | 9 Oct 13:39 | Finished — planes and dormer |
| 8 | `3647599128` | 9 Oct 13:43 | Finished — planes and shutters |

`completion_date` reads from the cover's capture time → 2026-10-09, against
an install of 10-08. Correct.

### What this overrules in docs/13

Three of the review's §2 rules are now amended by the owner's own choice.
Recorded rather than argued:

1. **Mess is allowed, and wanted.** Tarps, ladders, debris and materials on
   the lawn appear in four of the eight. §2 listed those as reasons a
   homeowner does not share. Jacob's view is that the work in progress is
   the proof.
2. **Skybird branding is wanted.** The green tent with the logo is in frame
   deliberately, twice. §2 warned against the house as a prop for ad copy.
3. **A "before" photo opens the gallery**, where §2 made it optional and
   hedged. It is a neutral wide aerial, not a shaming close-up of rot, so
   the spirit of the rule — never make the homeowner look negligent — still
   holds.

What has NOT changed: no homeowner name, address, phone or email; no house
number; no paperwork. Checked across all nine — clean. Two items for Jacob
rather than blockers: **crew members are identifiable** on the roof in
`3646458147` and `3646464851` (employee consent is his call, not a
homeowner-PII question), and the before photo has a **white pickup** at the
kerb worth a look at full size for a plate.

### The gap his captions will hit

Jacob plans to write a description on each photo in CompanyCam. **The
pipeline throws those away.** `Curate` reads `project.description` only —
the notepad, which becomes the private `field_notes`. Per-photo
`description` is never carried: `pick()` returns a URI and nothing else.

For the first page this does not matter: the descriptions can be read back
through the API and handed over to paste into the captions box. Worth
automating once his wording has settled over a few pages, not before —
carrying a field is easy, and guessing the format he wants before he has
written any would be the same mistake as the tagger prompt.

## His voice, from the first nine captions

Pulled 2026-10-28 and recorded at `docs/captions/2601-goldsboro.md`. The
point of writing this down is that the next caption written by anything
other than Jacob should sound like it came from the same person.

What is actually in them:

1. **First person plural, present tense.** "We make sure to have tarps
   spread out." The crew is the subject of the sentence, not the roof.
2. **Conditions, not just objects.** "The sun's probably still coming up."
   "These mornings are always a little chilly." Time of day and weather earn
   their place; a label-style caption has nowhere to put them.
3. **Product names used naturally and exactly** — Cobra ridge vent, F8 drip
   edge, GAF HDZ, ice and water, 4/12 pitch, California cut, apron flashing.
   Never a generic noun where a real one exists.
4. **A brief why.** "Ice and water got laid on this low slope, with it being
   lower than a 4/12 pitch. Those details are super important."
5. **The mess is owned and reframed**, not hidden: "It's messy work, but
   it's a beautiful chaos."
6. **Small problems are volunteered with their fix.** "a little bit of
   plywood repair… we had it done in about 30 minutes." Confidence rather
   than defensiveness, and it is the most trust-building line in the set.
7. **Craft words as praise**: "clean parallel lines", "all horizontal and
   parallel", "nicely finished".
8. **Contractions throughout.** Spoken register, two to four sentences.
9. **The homeowner closes the thought** where one fits: "a nice finishing
   touch for the homeowner."

One line was flagged back to him — the inspection caption's "the opportunity
that he has" and "where we build trust with the homeowner". It reads as the
homeowner being sold to, it is the one sentence in nine about Skybird rather
than the roof, and on a claim job it is the same shape as the framing that
is off the page by hard rule, without containing a banned word. The scan
cannot catch that; only a reader can. His call.

### The cap was wrong, and it was mine

`SKYBIRD_PROJECTS_CAPTION_MAX` was 160, taken from the review's "one line per
photo" model. **Five of his nine ran past it**, the longest at 358. The cap
did not reject them — it cut mid-word: *"…keep things out of the ya"*.

Raised to 600, with his 358-character caption pinned in the suite as a
regression test. The lesson is not about the number: a constant chosen from
a style guide, before anyone had written in the real style, would have
silently mangled the best copy on the page.

### For the eventual automation

`description` on a CompanyCam photo is **an object, not a string** —
`{id, html_content, plain_text_content}` — or `null` when unset. Read
`plain_text_content`. Carrying it through `Curate` is a small change, still
deliberately not made: a few more pages of his writing first.

## The checklist blocker is gone — and the checklist now has a different problem

Jacob asked whether he also needs to fill in the Showcase Details checklist,
or whether Production HQ covers it.

### The blocker recorded on 2026-10-14 no longer holds

`docs/11` has said since 2026-10-14 that **advanced (conditional) checklists
have no public API**, that a question was with CompanyCam, and that we must
not rebuild on legacy until they answered.

Tested today against #2561: the connector lists the instance and returns all
**13 of 13 answered fields** with values, who completed each and when. The
read works.

One qualification that matters: **n8n talks to the REST API, not to this
connector.** So the automation still cannot read it. For the manual first
pages that is irrelevant — the answers can be pulled the same way the
captions were.

### What each source is actually for

| | |
|---|---|
| **Production HQ** | The record, and the authority: manufacturer, shingle line, colour, warranty, package, town, across 201 jobs. This is what fills the specs table |
| **Showcase Details checklist** | What Production HQ does not hold: why they called, what was under the old roof, what was fixed, house type, days on site, and the neighbour line |

So: both, for different fields. Where they disagree, Production HQ wins —
it is the record (`CLAUDE.md`, warranty).

### The checklist now collects answers we cannot publish

It was designed and filled on 2026-10-02. **The claim-language hard rule was
taken on 2026-10-15**, after. The checklist has not caught up, and three of
#2561's thirteen answers are unusable as written:

- *Why did they call us?* → "Active leak, **Storm damage or insurance
  claim**" — a supplied option.
- *Anything to add about what made it harder?* → "Slow **Insurance**
  Communications"
- *What would you tell a neighbour?* → "**Approved through insurance**,
  clean work, great folks"

Its own description warns against names, addresses, phones and emails, and
that was followed. It says nothing about claim language, because on the day
it was written there was nothing to say. The result is a form that invites
answers which cannot reach a page — and the last of those three is the
answer most likely to be lifted straight into page copy.

Fix before the next job: drop or reword the "Storm damage or insurance
claim" option, and add the claim rule to the checklist's own description
alongside the PII one.

### Two more things the read exposed

1. **Two checklist instances on #2561** — one completed 2026-10-02, one
   created 2026-09-29 and never filled. Anything reading checklists must
   pick the completed instance, not the first returned.
2. **The package option encodes a warranty**: "Essentials — GAF Timberline
   HDZ, Silver Pledge". `CLAUDE.md` closes warranty as *read from the
   record, never derived from the package*. Taking "Silver Pledge" off that
   label would break a closed decision. The package field stays internal;
   the warranty comes from Production HQ.

### For #2601 specifically

No checklist instance exists on it. **Do not create one for this page.** His
nine captions already carry what the checklist would have collected — the
plywood repair and how long it took, ice-and-water on a sub-4/12 pitch, the
Cobra vent, F8 drip edge, the California cut. Production HQ covers the specs
table. Adding a form to re-collect what he has already written by hand would
be work for its own sake.

Use the checklist from the next job, once its claim-language options are
fixed.

---

# 2026-10-28 — CompanyCam answered on 2026-10-14, and I had it wrong

Jacob remembered they replied. They did, the same afternoon, and the thread
sat unread while we worked around a blocker that had already been answered.
Support closed it on 2026-10-16 for no response.

## What they said

1. **The sunset is the Legacy API only.** *"That September 1, 2027 sunset is
   for our Legacy API only. The one documented at developers.companycam.com
   is the one we're keeping and actively building on."* They asked for the
   link to whatever said otherwise so they could fix it.
2. **The 404 was never a bug.** `/v2/projects/{id}/checklists/{id}` is the
   *classic* endpoint. Advanced checklists use **UUIDs, not numeric IDs**, so
   an advanced ID can never resolve there.
3. **Advanced checklist answers are readable today, through the MCP server
   (beta)** — full field tree, every answer, who ticked what and when, and
   links to media attached to a field. `list_checklists` with `updated_since`
   covers most of what webhooks would have given us.

Which is exactly what the read against #2561 did before the email was found.

## The error was mine, and it is the one CLAUDE.md warns about

`docs/01-api-audit.md` line 13 has been **correct since 2026-09-14**:

> "The publicly documented CompanyCam API is legacy and sunsets September 1,
> 2027. The current API lives at developers.companycam.com."

That is the same thing support said, six weeks earlier, confirmed by John
against the live page. On 2026-10-14 I wrote in this file:

> "the entire Core API they live on is deprecating in early 2027"

I compressed "the legacy API sunsets Sept 2027" into "the Core API deprecates
early 2027", which is a different and wrong claim, and then recorded a
decision on it: *do not rebuild on legacy until they answer.* `CLAUDE.md`
says treat `docs/01`–`06` as ground truth and **flag** a contradiction rather
than override it silently. I overrode it silently, in a summary, without
noticing the two statements were different.

Nothing shipped on the bad premise. It cost two weeks of treating a
non-blocker as a blocker.

The line at `docs/11` §"Blocked, and not on us" is superseded. There is
nothing to send CompanyCam — our own file was the only thing that said it.

## What this changes

- The checklist read is **supported, not a workaround**.
- Legacy checklists were never needed.
- Change detection is available without webhooks.
- n8n still cannot call MCP directly in our current setup, so the
  checklist read stays manual for the first pages. Whether n8n's MCP client
  node can do it is worth testing later — not before a page is live.

## 2026-10-29 — pre-flight before firing the label on #2601

Checked against the live site rather than assumed, while the run was going
out.

**Clear for this job.** The `goldsboro` term exists (id 24) with
`service_area_page` = `/service-areas/goldsboro-nc/`, and that page returns
200. So `Get Area Term` resolves, `Curate` will not throw, and both the
breadcrumb and the footer back-link will have somewhere real to point.

Also clear: exactly one `Showcase Cover`, eight `Showcase Photos`, every one
`internal: false` and `processing_status: processed`, cover captured
2026-10-09 so `completion_date` lands right, and the project's
`postal_code` is null — which the payload turns into an empty string rather
than tripping anything.

### But only 8 of the 14 service areas are actually in WordPress

| | |
|---|---|
| Seeded | franklinton, goldsboro, greenville, knightdale, raleigh, rolesville, wake-forest, youngsville |
| Missing | pikeville, wilson, la-grange, winterville, durham, zebulon |

The six added on 2026-10-15 are in `includes/taxonomy.php` and in the zip,
but never reached the database. Terms are seeded from
`register_activation_hook`, and uploading a plugin with "Replace current
with uploaded" does not re-run it.

**No impact today** — Goldsboro is one of the eight. The loud failure is
working as designed: a project in one of the six would throw in `Curate`
("No service_area term for slug …") rather than file itself nowhere.

Fix is a plugin deactivate-then-reactivate, which re-runs the seeder.
**Not while a run is in flight** — after the first page is published.

Those six still have no hub page either (`404`), so the containment in
`includes/breadcrumbs.php` would hide the crumb and the back-link. Seeding
the terms does not make the areas publishable; it only moves the failure
from "throws" to "renders with no area link".

### One thing checked and found fine

`/resource/service_area/goldsboro/` returns 301 and lands on the homepage.
The taxonomy is `public: false`, and there is no competing indexable term
archive — which is what `docs/09` §3.5 required.
