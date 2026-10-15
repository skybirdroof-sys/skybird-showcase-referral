# 13 — What a page has to be before it publishes

Written 2026-10-15, after Jacob corrected the North Star and asked for a
second opinion on my definition of "a page worth landing on".

Provenance: I wrote a definition, Jacob sent it to his Grok bot for review,
and the amended version came back. It is stored verbatim at
`docs/vendor/reviews/grok-page-definition-2026-10-15.md` — read it for the
reasoning, the Meta/Google citations, and the examples. **This file is the
decision record: what we adopt, what is still open, and what it changes
about work already done.**

The review is good. It found the thing I had got wrong, which is the same
thing `CLAUDE.md` now records as drift #1: I was designing for the search
visitor and the referred friend, and had never designed for **the customer
deciding whether to put their name on it.** That is the person the whole
referral layer depends on.

---

## 1. The one open decision: the storm date

**This contradicts a decision taken earlier the same day.** On 2026-10-09
Jacob asked:

> "Is there anything about how we went through the insurance company and
> hail was confirmed at this property from a certain storm date that could
> be valuable information for a reader finding this page?"

and then: *"Yes, add the storm date field and wire it up."* I built it
(`meta.php`, `acf-fields.php`, 4 assertions in `tests/test-plugin.php`) and
argued in the code comments that naming the storm a claim traces back to is
*reporting, not storm-chasing*.

The review says the opposite, and its argument is about the customer, not
about Google:

> "'Hail damage claim' tells their friends about their insurance claim and
> looks like storm-chaser marketing. Leave out claim language entirely,
> even when the job was a claim."

It then bans `hail`, `insurance claim` and `storm season` outright in the
boilerplate scan (§5 guard 4) and in the publish gate.

**I think the review is right and I was wrong,** for a reason I did not
weigh: an insurance claim is the homeowner's private financial business.
A page the homeowner shares with their own friends announces it. That it is
factually true does not make it theirs to publish.

**Current state of the code:** `storm_date` is stored and marked public in
REST, but **nothing renders it** — `templates/single-project.php` never
reads it. So nothing has leaked and the decision is still cheap.

**Settled 2026-10-15.** Jacob: *"Yes, lock the storm date to wp-admin and
move on."* Done:

- The field stays. It is real record data and it is how we know which jobs
  trace to which storm.
- `private: true` in `meta.php`, so `includes/rest.php` strips it for anyone
  who cannot edit the post. No template reads it.
- Relabelled "Storm date (internal)" in wp-admin, and the ACF instructions
  now say so rather than describing it as publishable.
- `CLAUDE.md` carries it as a hard rule and a closed decision, so the
  argument does not get re-run in six weeks.
- Guards: four assertions fail if the `private` flag is removed — the exact
  set of private fields, the flag itself, REST containment, and a scan for
  the date string anywhere in the public response. Verified by removing the
  flag and watching all four fail.

Still to build, when the gate becomes mechanical: "hail", "insurance claim"
and "storm" on the banned-phrase list (review §5 guard 4), so the words
cannot arrive through the hand-written copy either.

---

## 2. Adopted — no argument from me

These are now the spec. Nothing published until they hold.

1. **The customer sees the page, or at least the hero photo, before the
   share link reaches them.** No surprises. Finding a page about your own
   house that you did not approve reads as a privacy breach even when
   nothing private is on it.
2. **The hero photo is the og:image and is the thing that gets shared.**
   It is checked for house numbers, mailboxes, street signs, plates,
   people, and neighbours' house numbers — *at the 1.91:1 crop*, because
   the crop can pull in what the original framing left out.
3. **Shareable wins on everything a person sees. SEO gets the parts people
   don't see.** H1 and `og:title` are human. The `<title>` tag keeps
   product + town + NC.
4. **The specs table gets filled from the record** — manufacturer, product
   line, colour, warranty, completion month. No "N/A", no guesses. An empty
   table is what makes a page look abandoned. (`product.php` already does
   the vocabulary half of this.)
5. **Every gallery photo gets a real caption.** "Roof photo 2" is not a
   caption.
6. **One or two human-written sentences per page**, containing at least one
   detail that would not make sense on any other page.
7. **Breadcrumbs, visible, with matching `BreadcrumbList` JSON-LD.**
   (Already queued — see §4.)
8. **"Before" photos are optional and neutral.** Never captioned as
   shameful. "Rotted", "failing", "dangerous" make the homeowner look
   negligent on a page they are being asked to share.
9. **The banned-boilerplate scan** (review §5 guard 4). Mechanical, run at
   the gate, fails the page.
10. **The sibling check:** if the summary could be swapped with the three
    most similar pages and nobody would notice, it gets rewritten.
11. **No publishing all 201 at once.** Each page ships when it passes the
    gate. Consistent with `CLAUDE.md`'s "no artificial staging" — the pace
    is set by the gate, not by a calendar.

---

## 3. The one thing that must be tested before launch, not designed

The review flags this and could not resolve it from Meta's docs:

> "I couldn't find anything in the docs I opened that confirms whether the
> link in a posted share takes visitors to the URL that was shared (with
> `?ref=`) or to the `og:url`."

Meta says `og:url` must be the undecorated canonical URL with no
user-identifying parameters. The referral code is a user-identifying
parameter. So either the share carries the code and the canonical rule is
broken, or the canonical rule holds and **the code may be dropped on every
Facebook share** — which is the entire referral layer failing silently
while looking like it works.

**This is the highest-risk unknown in the project**, because it is the North
Star itself: a lead arriving with a code attached.

The fallback the review proposes is sound and I would build it as the
primary mechanism rather than the fallback: a path-based share URL,
`/r/ABC123`, which records the referral server-side and then redirects to
the clean canonical page URL. A path is part of the URL, not a parameter,
so it survives anything that strips query strings, and `og:url` on the
destination page stays clean.

**Test with one real share before any share link goes to a customer.**

---

## 4. What this changes about queued work

| Already queued | Changed by the review? |
|---|---|
| Crawlable HTML links in the map shortcode | No change. Still needed. |
| Breadcrumbs + `BreadcrumbList` | No change — the review makes it item 1 of the outline. |
| Back-link falls through to a hub that exists | **Reinforced.** The review adds "More roofs we've done in {town}" sibling cards alongside it, so this is now two links that must not 404. |
| `storm_date` wired to the page | **Stop.** See §1. Settled — locked to wp-admin. |
| Referral code in the URL as `?ref=` | **Re-plan as `/r/CODE`.** See §3. |

### Built 2026-10-15

All three of the items that blocked the first page from passing its own
gate. Commits `c5787df`, `8fa870a`, `2543f00`.

1. **Per-photo captions and per-photo alt text.** Captions live on the
   attachment in WordPress's own caption field, editable from the project
   screen. Alt resolves per photo: explicit attachment alt, then the
   caption, then the generated project sentence. Before this, every photo
   on a page carried one identical alt attribute.
2. **Open Graph tags**, with a dedicated 1200×630 hard crop as its own
   registered image size — so the declared dimensions match a real file,
   and so `includes/exif.php` strips it alongside the original. The admin
   box shows the reviewer *the crop*, not the photo they approved, because
   a centred 1.91:1 crop pulls in what the original framing left at the
   edge of the frame.
3. **Breadcrumbs and `BreadcrumbList`**, which closed the flagged 404: six
   of the fourteen service areas have no hub page, and both the crumb and
   the footer back-link now resolve against a real page before rendering.

Also landed with them: `includes/copy-guard.php`, the banned-phrase scan
from §5 guard 4. It warns rather than blocks, and it scans only what a
human typed — never fields read from the job record.

### Two things now waiting on Jacob

- **The H1.** §3 of this document wants it human; `docs/06` §3 locks the
  post title keyword-first, and `docs/01`–`06` are ground truth unless
  flagged. So the human share title is used as the H1 **only when someone
  has written one** — a project without one renders exactly as before.
  Whether the human H1 becomes the default is Jacob's call.
- **The credentials sentence.** It ships *empty*. The review's example names
  a generation count and a manufacturer programme, and "no invented
  specifics" covers claims about ourselves too. One confirmed sentence and
  it goes live site-wide.
- **Which SEO plugin the site runs.** If it is Yoast, Rank Math or AIOSEO,
  the plugin stands down and prints no preview tags at all, because two
  sets of `og:title` is worse than one set we did not choose. Wiring the
  1200×630 crop into whichever one is installed has to be written against
  the real plugin.

New work the review adds, not previously on the list:

- Open Graph tags, with a dedicated 1200×630 JPEG export per page
  (separate file, EXIF stripped, versioned filename, declared
  `og:image:width`/`height`).
- Captions as a per-photo field, which the upload gate does not collect yet.
- A human-summary field with an author initial stored against it.
- The banned-phrase scan, as a mechanical check.
- A customer preview/approval step before the share link is sent.
- A credentials line: *fifth-generation family roofer, GAF Master Elite.*
  Those words, nothing more.

---

## 5. The publish gate

Binding. Copied from the review's gate, with the storm-date line reflecting
§1 above. A reviewer clicks Approve only when every line is true.

- [ ] No homeowner name, address, phone or email in copy, alt text,
      filenames, captions, URL slug or JSON-LD.
- [ ] Every photo checked — **including the 1200×630 og crop** — for house
      numbers, mailboxes, street signs, plates, people, neighbours' house
      numbers.
- [ ] EXIF/GPS stripped from every published image.
- [ ] Map, if shown, is offset and zoomed to area level.
- [ ] Specs filled from records. Nothing invented, no "N/A".
- [ ] One to two human-written sentences with a job-specific detail, past
      the sibling check.
- [ ] Every gallery photo has a real caption and plain alt text.
- [ ] Banned-phrase scan passes: no prices, no "free roof", **no storm,
      claim or hail framing**, no urgency, no years in business, no reviews
      or quotes that aren't real.
- [ ] No shaming "before" content.
- [ ] `og:title` / `og:description` / `og:image` set, dimensions declared,
      run through Meta's Sharing Debugger, preview looks right.
- [ ] Referral link tested: a real share click lands with the referral
      attributed (§3).
- [ ] Customer has seen the page, or at least the hero photo.
- [ ] Breadcrumbs visible and matching the JSON-LD.
- [ ] The reviewer would be comfortable if it were their own house.

---

## 6. What this means for draft 1183

Draft 1183 has sat unpublished since 2026-09-29, and `CLAUDE.md` records
that as the top item. This definition does not change that. It changes what
"finish it" means: 1183 fails most of the gate above today — no captions,
no human summary, no breadcrumbs, no OG tags, no customer preview, empty
specs table.

The fastest honest route to the first published page is to take 1183
through this gate by hand, one line at a time, and let what is painful
about doing it manually decide what gets automated next. Not the reverse.
