# 09 — Euan's Answers

Skybird Project Showcase + Referral System · Phase 4
Received 2026-09-17 17:30 UTC, in the 9/14–9/17 sign-off thread. Answers given inline in red.
Closes most of `01-api-audit.md` §2.2 and the outstanding items in `08-euan-questions.md`.

---

## 0. Headline

1. **Staging exists, but it is not usable as-is.** WP Staging **free**, at `skybirdroofing.net/shenzhou/`. Giving our sync user access needs the Pro upgrade at **$159/year** (§3.2). This is a decision, not a blocker — there are two alternatives that cost nothing.
2. **ACF is installed but is NOT Pro.** The exact thing flagged as worth watching for. `05-data-model.md` §1's `gallery` field has no ACF-free equivalent — Gallery and Repeater are Pro-only. Recommendation in §3.1: **don't buy Pro**, and the reason is not just the $49.
3. **The security-plugin question was not answered.** His SEO answer landed in the security bullet's slot and the SEO bullet was left blank (§2). This is the one that causes 401s, so it needs a one-line follow-up.
4. **Two answers change the build shape in ways worth catching now**: the page builder is WPBakery (§3.4, the map widget has to be a shortcode) and there is to be **no global projects hub** (§3.5, the CPT archive should be disabled).
5. **Everything contentious is settled**: plugin ownership, pin precision, flat URLs, and the reference model are all agreed.

---

## 1. What he answered

| Question | Answer |
|---|---|
| Flat URLs + per-area map widget | "Yes, aligned here." |
| Staging site? | Yes — `https://www.skybirdroofing.net/shenzhou/wp-admin/`, **WP Staging free**. Multi-user access needs Pro, **$159/yr**, which also adds staging→live push |
| Dedicated sync user | "We can create a new user here with Editor access, but would need to create a new email account that it uses" — `skybirdroof@gmail.com` is taken by Jacob's own account |
| Should the CPT live in a plugin? | "Yes, this should live in a plugin so if there are future theme updates, those will reflect across." |
| Who owns the plugin? | "Agree." — Skybird owns it |
| Pin precision, 0.2–0.3 mi offset | "Aligned with this." |
| Theme / page builder | **Hub Child** theme, **WPBakery Page Builder** |
| ACF? Pro? | "ACF is installed, but it is not Pro. Pro is $49/year if you want to purchase it so you own it." |
| SEO plugin | **All in One SEO** (not Yoast, not Rank Math) |
| Security plugin | **Not answered** — see §2 |
| `/projects/` free? | "This URL path is free." |
| `-nc` suffix canonical? | `/service-areas/franklinton/` **redirects to** `/service-areas/franklinton-nc/`. The **`-nc` form is canonical** |
| Mr Roofing as the target | "Yes, this is exactly what I was visualizing **but instead of one main projects 'hub', there would be a 'hub' for each service area location**." |

On ownership he added: *"I'm assuming Claude is saying that 'we own it', but really, you control your Claude AI so you still do 'own it', Claude just does the heavy lifting for you."* No action — the outcome is the one we asked for. Recorded only so the phrasing isn't mistaken later for a different arrangement.

---

## 2. The one question he missed — security plugin

Looking at the raw message, the red answer *"SEO plugin is All in One SEO."* sits against the **security plugin** bullet, and the SEO bullet above it has no answer at all. He answered the SEO question and skipped the security one.

So: **SEO plugin is known. Whether a security plugin restricts the REST API or Application Passwords is still unknown.**

That matters more than the others in this block — `01-api-audit.md` §2.2 names it as "the common cause of 401s," and it is the failure that appears only once we try to authenticate, i.e. at the worst moment. Worth a one-line follow-up rather than discovering it mid-build:

> One from the last list got skipped — is there a security plugin on the site (Wordfence, iThemes/Solid, Sucuri, or similar), and does it restrict the REST API or Application Passwords?

---

## 3. What his answers change

### 3.1 ACF is not Pro — and the recommendation is still not to buy it

`05-data-model.md` §1 specifies `gallery` as an array of attachment IDs, and `01-api-audit.md` §2.1 assumed ACF Pro's Gallery and Repeater would cover it. ACF **free** has neither.

What ACF free *does* have, and it matters: text, textarea, number, select, image, URL, date picker, true/false. That covers **every field a human reviewer actually edits** — `manufacturer`, `product_line`, `color`, `warranty`, `city`, `neighborhood`, `zip`, `completion_date`. Per `07-phase-4-preflight.md` §2.4.2, those are exactly the fields the reviewer fills by hand while the ProLine read path is unresolved.

The only gap is `gallery`.

**Recommendation: register `gallery` as native post meta, keep ACF free for the human-edited fields. Don't buy Pro.**

Reasoning, beyond the $49:

- **The gallery is machine-populated, so it doesn't need an editing UI.** It comes from the `Showcase` tag in CompanyCam. ACF Pro's Gallery field buys a drag-and-drop admin interface for data no human is meant to be authoring.
- **Native meta is a cleaner REST write for n8n.** `register_post_meta` with `show_in_rest` and an array-of-integer schema is written directly in the post body. ACF's REST integration goes through a separate `acf` object with its own field-key conventions — more surface area, for no gain here.
- **It avoids a licence dependency on a plugin we don't control.** The `skybird-projects` plugin is ours (§1); an ACF Pro licence would sit with whoever bought it, and expire.

**The tradeoff, stated honestly:** if a reviewer ever wants to reorder or drop one photo from a gallery by hand, they will have no UI for it. That is acceptable because it matches the correction path `06-trigger-design.md` §3 already defines — pull the `Showcase` tag in CompanyCam and re-run, or remove the `Website Showcase` label and fix the curation. Editing the photo set in WordPress was never the intended repair. If that turns out to be wrong in practice, $49 buys the UI later and nothing has to be rebuilt.

### 3.2 Staging is WP Staging free, on a subdirectory of the live domain

Two separate limitations, and the second is the one that actually bites:

1. **User access.** WP Staging free restricts the clone to logged-in administrators. Our Editor-level `skybird-sync` user would not be able to reach it — which is precisely what Euan is flagging with the $159 upgrade.
2. **No staging→live push on free.** So anything proven on staging has to be redone on production anyway.

*Both of these are the expected behaviour of the free tier rather than something verified from here — egress is still blocked (`07-phase-4-preflight.md` §3), so this is stated as the thing to confirm, not as established fact.*

**Recommendation: don't buy WP Staging Pro for this.** What Pro mostly sells is migrating *content changes* from staging to live. Our deliverable is a small plugin file plus n8n configuration — there is nothing to migrate. Paying $159/yr to move a file we can install directly is the wrong shape of purchase.

Two alternatives that cost nothing:

- **(a) Prove the plugin on a throwaway WordPress instance we control** — local or a free sandbox. The plugin's CPT/taxonomy/meta registration and the n8n REST write are both fully testable against any WordPress. No Pitch Peak dependency, no waiting. Then install the proven plugin on production.
- **(b) Work on production, drafts only.** Bounded more tightly than it sounds: a draft is not public, and registering a new CPT does not touch existing pages or URLs. The genuine risks are plugin *activation* (a fatal error can white-screen the site) and a permalink flush — both mitigated by doing (a) first.

**(a) then (b)** is the recommendation. It is also faster than either paid route, since it needs nothing from Pitch Peak.

Worth raising with Euan separately, unrelated to us: a staging clone at `/shenzhou/` on the live domain should be noindexed and blocked from crawlers. WP Staging normally handles that, but it is cheap to confirm and expensive to discover in the index later.

### 3.3 SEO plugin is All in One SEO, not Yoast or Rank Math

`01-api-audit.md` §2.2 assumed one of Yoast or Rank Math, both of which accept SEO meta through REST straightforwardly.

**AIOSEO is different in a way that matters:** it keeps much of its per-post SEO data in its own database table (`wp_aioseo_posts`) rather than purely in postmeta. Writing the SEO title and meta description may therefore not be a simple meta write in the same REST call that creates the draft.

Flagging as **unverified** — this is from general knowledge of AIOSEO, not checked against Skybird's install, and I can't check while egress is blocked. It goes on the list for the §4.1 pass rather than being assumed either way.

Practical impact on Phase 4 is small: the human review gate already includes an SEO-title check (`06-trigger-design.md` §3), so a reviewer can set the SEO fields in the AIOSEO panel while creating the draft is automated. Automating them is a refinement, not a Phase 4 requirement.

### 3.4 WPBakery means the map widget must be a shortcode

WPBakery is shortcode-based: page content is stored as shortcodes in `post_content`. The eight service-area pages are built with it.

**So the per-service-area map widget should ship as a shortcode** — `[skybird_project_map area="wake-forest"]` — registered by our plugin. That drops into a WPBakery text or raw-HTML element with no custom WPBakery element development, and no Pitch Peak involvement beyond pasting one line per page.

For the project page itself, the template should be registered **by the plugin** via `template_include` rather than added as `single-project.php` in the Hub Child theme. Hub Child is already a child theme so it wouldn't be lost to a parent update, but keeping the template in the plugin keeps it in our repo and versioned, consistent with the ownership decision in §1.

### 3.5 No global projects hub — disable the CPT archive

His refinement on the reference model: *"instead of one main projects 'hub', there would be a 'hub' for each service area location."*

This lines up exactly with `03-structure-signoff.md` §2 (one widget per service area, not one sitewide) and §4's decision to retire `/gallery/`. But it has a concrete implication not yet written down anywhere:

**Register the CPT with `has_archive => false`.** Individual pages still resolve at `/projects/{slug}/`; there is simply no `/projects/` archive listing every project. The eight service-area pages are the hubs.

Left at the WordPress default, we would ship exactly the "one main projects hub" Euan just said he doesn't want — and it would be indexable, competing with the service-area pages the whole structure is designed to funnel into.

Note the mild irony worth keeping straight: `/projects/` being *free* (§1) is what makes the slug available for individual project URLs. It is not an invitation to build a page there.

### 3.6 The sync user needs its own email address

Euan's one constraint on creating `skybird-sync`: WordPress requires a unique email per user, and `skybirdroof@gmail.com` is taken by Jacob's account.

**No new mailbox needed — plus-addressing solves this.** `skybirdroof+wpsync@gmail.com` is a distinct string to WordPress, so it satisfies uniqueness, while Gmail delivers it to Jacob's existing inbox. Password resets and notifications for the sync user land where he can see them, with nothing new to administer.

---

## 4. Now closed

| Item | Source | Resolution |
|---|---|---|
| Plugin ownership | `01-api-audit.md` §2.2 | **Skybird owns `skybird-projects`.** Euan agreed |
| Pin precision | `03-structure-signoff.md` §4 item 4, `04-pin-precision-research.md` | **0.2–0.3 mi stored random offset.** Euan aligned. The last genuinely open item from September |
| Theme / page builder | `01-api-audit.md` §2.2 | Hub Child + WPBakery |
| ACF | `01-api-audit.md` §2.2 | Installed, **not Pro** → §3.1 |
| SEO plugin | `01-api-audit.md` §2.2 | All in One SEO → §3.3 |
| `/projects/` collision | `01-api-audit.md` §2.2 | Free |
| `-nc` canonical | `03-structure-signoff.md` §4 flag | **`-nc` is canonical**; the bare form redirects to it. Project pages link back to `/service-areas/{area}-nc/` |
| Staging exists? | `01-api-audit.md` §2.2 | Yes, but see §3.2 |

`01-api-audit.md` §2.2 is now fully answered **except** the security-plugin question (§2).

---

## 5. Gate — what's needed before code

**Decided 2026-09-17 (Jacob) — both money questions answered no:**

| # | Decision |
|---|---|
| 1 | **No ACF Pro.** `gallery` is native post meta; ACF free covers the reviewer-edited fields (§3.1). $49 buys the UI later if reviewers turn out to want it, and the meta field stays either way — nothing gets rebuilt |
| 2 | **No WP Staging Pro.** Prove the plugin and the n8n REST write on a throwaway WordPress instance we control, then install the proven plugin on production and create drafts only (§3.2) |

Together these mean **Phase 4 needs nothing further from Pitch Peak to begin** — no purchase, no staging provisioning. The only remaining Pitch Peak dependency is the `skybird-sync` user, and that is needed to *test against production*, not to write or prove the plugin.

**Actions outstanding:**

3. **Follow-up to Euan** — the skipped security-plugin question (§2), the `skybird-sync` user with `skybirdroof+wpsync@gmail.com` (§3.6), and the `/shenzhou/` noindex check. One short message.
4. Egress allowlist (`07-phase-4-preflight.md` §3) — still needs a new session.
5. Create the `project.label_added` webhook and prove the four delivery steps (`07-phase-4-preflight.md` §2.3).

**The plugin is now fully specified and unblocked.** Per the project's working rule it is not being written unasked — but nothing is waiting on a decision any more:

```
skybird-projects/
  CPT `project`        rest_base `projects`, /projects/{slug}/, has_archive => false  (§3.5)
  Taxonomy             service_area, 8 terms, show_in_rest
  Native meta          gallery (int[]), approx_lat, approx_lng,
                       companycam_project_id, proline_project_id (unpopulated, §2.4.2 of 07)
  ACF free fields      manufacturer, product_line, color, warranty,
                       city, neighborhood, zip, completion_date   (reviewer-edited)
  Template             single-project via template_include, not the Hub Child theme  (§3.4)
  Shortcode            [skybird_project_map area="..."] for the WPBakery pages  (§3.4)
```

The security-plugin answer (§2) affects whether Application Passwords will *authenticate* against production. It does not affect the plugin's code, so it gates testing, not writing.

---

# Second reply — Euan, 2026-09-18 15:53

Answers to the 2026-09-17 follow-up. All three questions answered, plus
confirmation on the two paid options and the hub structure. **Everything in
`01-api-audit.md` §2.2 is now closed.**

## 1. Security plugin — "No security plugins on the site"

The last §2.2 unknown, and the answer removes the most likely cause of a 401
against production. Nothing is restricting the REST API or Application
Passwords. `07-phase-4-preflight.md` §4.2's remaining escalation is discharged.

## 2. The sync user exists

`skybird-sync`, **Editor**, `skybirdroof+wpsync@gmail.com`, created by Euan on
**both the published site and the staging site**, with an Application Password
issued.

**The password is not recorded in this repo, and must not be.** See
§4 below — it needs replacing before it is used against production.

## 3. `/shenzhou/` staging — "already set as noindex and blocked from crawlers"

Confirmed. Raised as a courtesy, not a dependency; closed.

**This changes where the first run should happen.** The plan of record
(`09` §3.2, from Euan's first reply) was to prove the plugin on a throwaway
instance we control, because no staging was available to us. One now is, the
sync user is already on it, and it is a clone of the live site — same Hub
Child theme, same WPBakery, same plugin set, same WordPress version.

A TasteWP sandbox proved what a sandbox can prove: registration, the REST
write, and rendering under *a* theme. It cannot prove the parts that only fail
on the real stack — the template under Hub Child rather than a block theme,
the shortcode inside WPBakery, and interaction with whatever else is
installed. Staging can.

**Revised target for the first end-to-end run: the `/shenzhou/` staging
clone**, not TasteWP and not production. Drafts only either way.

## 4. The Application Password arrived in plain email — treat it as burned

Euan sent the Application Password in the body of an email. It now exists, in
plaintext, in at least: his Sent items, Jacob's inbox, the PDF export of that
thread, and the Claude session transcript that PDF was read into. None of
those is a credential store, and email is not a channel that can be un-sent.

It is an **Editor**-role credential on the **live production site**. Editor can
publish, edit and delete any post, and upload media — so this is not a
read-only exposure.

**Recommended, in order:**

1. Revoke that Application Password in `skybird-sync`'s WordPress profile
   (Users → skybird-sync → Application Passwords → Revoke). Revocation is
   immediate and does not affect the user account.
2. Generate a replacement **and paste it straight into the n8n credential**,
   so it never passes through email or chat. WordPress shows it once.
3. If a password is needed for the staging run before that happens, the
   exposed one is tolerable **against `/shenzhou/` only** — a noindexed clone
   — and never against the live site.

This is a process point, not a criticism of Euan: the request did not say how
to send it, and it should have. Any future credential request from this
project should name the channel.

### A likely transcription problem, flag not a fix

The password as received contains a `%`. WordPress generates Application
Passwords with `wp_generate_password( 24, false )` — the `false` suppresses
special characters, leaving `[a-zA-Z0-9]` only. A `%` cannot appear in one.

So either the PDF/email mangled the string, or a character was substituted in
transit. **Do not assume the received value is correct.** If it 401s, that is
the reason, and the answer is a fresh password rather than debugging the
request. Since it is being replaced anyway (§4), this mostly matters for not
losing an hour to a mysterious 401 first.

## 5. Both paid options — confirmed skipped

"Sounds good" to both: no ACF Pro, no WP Staging Pro. The reasoning in the
first reply stands unchanged.

## 6. Hub structure — "Yes, aligned"

`/projects/{slug}/`, no global all-projects page competing with the service
areas, each project linking back to its area, `-nc` URLs canonical. That is
what `03-structure-signoff.md` §2 specified and what the plugin implements;
the back-link verified on a real render 2026-09-18 builds exactly this path.

## What this closes, and what is left

| Was open | Now |
|---|---|
| Security plugin (`01` §2.2, `07` §4.2) | ✅ None installed |
| `skybird-sync` user | ✅ Exists, Editor, both sites |
| `/shenzhou/` noindex | ✅ Confirmed |
| Where to prove the first run | ✅ **Staging**, revised from "a throwaway" |
| Application Password handling | ⚠️ **Exposed — revoke and reissue** |

Nothing is now waiting on Pitch Peak. The remaining Phase 4 work is n8n
configuration, the webhook subscription, and the first run.
