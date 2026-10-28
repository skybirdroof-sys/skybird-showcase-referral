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
