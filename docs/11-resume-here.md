# 11 — Resume Here

Skybird Project Showcase + Referral System · Phase 4
Last worked 2026-09-17 evening. Written as a pickup point, because the next session may be a fresh one with none of this in context.

---

## Where Phase 4 actually stands

Phase 4's goal: **one real CompanyCam project → one real WordPress draft, nothing published automatically.**

| Piece | State |
|---|---|
| CompanyCam side | ✅ Verified live. Tags, label, curated set, test project all real (`07` §1) |
| WordPress plugin | ✅ Built, 108 assertions, **installs and activates on real WordPress** |
| Plugin REST write | ✅ **27/27 on the fourth run, 2026-09-17.** Three bugs found and fixed along the way |
| n8n workflow | ✅ Built as importable JSON, 24 nodes. **Never imported or executed** |
| `project.label_added` webhook | ❌ Not created. The delivery leg has never been proven |
| End-to-end run | ❌ Not attempted |

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

**Done 2026-09-17: 27 passed, 0 failed.** What remains unverified is *rendering* — see the plugin README's status table. Nothing has ever loaded a project page, placed the map shortcode, or run with ACF active.

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

Then `php tests/test-plugin.php` should print **108 passed, 0 failed**.

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
