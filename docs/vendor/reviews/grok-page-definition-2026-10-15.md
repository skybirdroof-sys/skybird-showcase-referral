# What makes a Skybird project page worth publishing: review and amended definition

*Skybird Roofing, Wake Forest NC. Prepared 15 Oct 2026. Anything marked **[Judgment]** is my opinion, not something a source says. Sources are listed at the end, and I opened every one of them for this review.*

---

## The short version: what's wrong today

1. **Nobody would share the page as it stands.** It has one generic sentence, a few photos with no captions, and an empty specs table. A past customer has no reason to post it, and a friend who clicks through learns nothing about the house, the job or Skybird.
2. **The specs table is empty even though the data exists.** Manufacturer, product line, colour and warranty are on file for all 201 jobs. Leaving them blank makes the page look abandoned. Fill them in this week.
3. **The share button is hidden from the person most likely to share.** It only appears once a referral code exists. Your referral loop depends on the customer sharing, so the customer has to get a working share link that already includes their code. Don't expect them to find a button.
4. **The page doesn't say anything specific.** The title ("GAF Timberline HDZ Roof Replacement in Youngsville, NC") is written for search engines. 200 pages with that title and one boilerplate sentence look mass-produced. Google's own self-check asks whether content is "mass-produced… so that individual pages… don't get as much attention or care". [G-HC]
5. **Photos have no captions and probably have unchecked alt text and filenames.** That's a missed SEO opportunity. It's also a privacy risk if a filename or alt text includes a street name, or if the photo's embedded GPS data (EXIF) is still in the file. **[Judgment]** Photos from a phone or a job-photo app usually carry GPS coordinates. If those aren't stripped, the quarter-mile pin offset does nothing.
6. **There are no breadcrumbs, no story, and nothing for a friend to do next.** A referred visitor lands on the page, finds no reason to trust it and no obvious next step, and leaves.
7. **Nobody has defined the Facebook preview.** Without Open Graph tags, Facebook "uses internal heuristics to make a best guess about the title, description, and preview image." [M-WM] That guess could easily be the photo that shows the house number.

---

## 1. What belongs on a page someone would actually share

A shareable page answers three questions within ten seconds: *what was done, does it look good, and why trust these people?*

**Must have (all missing or empty today):**

| Element | Why | Status today |
|---|---|---|
| **One or two human-written sentences about this specific job** (what the roof needed, what we did, one detail that applies only to this house) | It's the only thing that separates this page from the other 200 | Missing (one generic sentence) |
| **Filled specs:** manufacturer, product line, colour, warranty, completion month | The friend wants to know "what is that colour?" The data already exists | Empty |
| **A finished hero photo** that makes the house look its best | It's what people share. It's also the og:image | Present, but not chosen with privacy or flattery in mind |
| **3 to 6 gallery photos, each with a real caption** (e.g. "New ridge vent along the full ridge line", "Step flashing replaced where the roof meets the dormer wall"), using only details in the job record or visible in the photo | Captions turn photos into proof of workmanship. Google also takes image subject matter from nearby captions [G-IMG] | Photos present, no captions |
| **A credentials line:** fifth-generation family roofer, GAF Master Elite. Use those words and nothing more | The friend has never heard of Skybird. This is the trust step | Missing |
| **A next step for the visitor:** "Get a roof estimate", with the referral code carried through | Referral is the point of the page. Without a next step, the page does nothing for leads | Missing or unclear |
| **Breadcrumbs:** Home › Service areas › Youngsville › this project | Helps strangers and Google place the page. Google recommends breadcrumbs "that represent a typical user path to a page" [G-BC] | Missing |
| **An approximate location** (town, plus a neighbourhood-level area if the customer agrees) | Neighbours care that it's nearby | Town only |

**Nice to have, but only if it's real:** a short quote from the customer, used word for word, with written permission and attributed only as "the homeowner". Never write one, paraphrase one, or turn it into star ratings. Google's structured-data policy specifically calls out fake reviews. [G-SD]

---

## 2. Audience 1: the customer deciding whether to put their name on it

The customer isn't on the page by name, but **sharing it attaches their name.** Their friends know whose house it is. The test is simple: *would they be happy for their mother-in-law to see this?*

**What makes them proud to share it [Judgment, all of it]:**
- The house looks its best: a clean, bright, finished shot from a flattering angle, with the yard tidy or cropped out.
- The copy is about the house and the result, not about Skybird selling something. "A new Pewter Gray roof on a two-story home in Youngsville" reads as *their* news.
- A small, true detail that shows care, e.g. "we matched the new drip edge to the existing gutters". It tells their friends they picked well.
- They know about the page before anyone else does. They saw it, approved the hero photo, and got the link from a person.
- Sharing takes one tap, and the preview looks good in their feed on the first try.

**What makes them quietly decide not to share:**
- **Their house number, mailbox, street sign, car plate, kids, pets or neighbours' houses are visible** in any photo, especially the hero/og:image.
- **The old roof is shown as shameful.** "Before" photos captioned "rotted", "failing" or "dangerous" make the homeowner look negligent. If a before photo is used at all, caption it neutrally ("Original roof, 20+ years of service" only if the record supports it; otherwise just "Before").
- **An insurance or storm framing.** "Hail damage claim" tells their friends about their insurance claim and looks like storm-chaser marketing. Leave out claim language entirely, even when the job was a claim.
- **Mess:** dumpsters, tarps, debris, torn-up landscaping, a cluttered garage, or laundry in a window.
- **Ad copy with their house as the prop:** "Is YOUR roof next?", "Don't wait until it's too late", prices, offers, urgency. If the page reads like a flyer, sharing it makes them a billboard.
- **Surprise.** Finding a page about their house that they didn't approve feels like a privacy breach even when no personal information is on it.
- **Too much accuracy:** a map pin that, even offset, lands on a recognisable cul-de-sac with three houses on it.

**Practical rule:** the customer gets a preview link and approves (or simply doesn't object to) the hero photo before the page goes live and before any share prompt is sent. **[Judgment]** This is the cheapest way to raise share rates and avoid complaints.

---

## 3. Where "shareable" and "ranks well" pull against each other, and which wins

**Shareability wins on everything a person sees. SEO gets the parts people don't see, plus one descriptive line.** Referral is the stated business goal. And Google's guidance points the same way: it asks "Is this the sort of page you'd want to bookmark, share with a friend, or recommend?" and warns against "content… primarily made to attract visits from search engines." [G-HC]

| Tension | Shareable instinct | SEO instinct | Resolution |
|---|---|---|---|
| Headline | Warm, house-first ("A new Charcoal roof for a family home in Youngsville") | Keyword-first ("GAF Timberline HDZ Roof Replacement in Youngsville, NC") | **H1 and og:title are human. The `<title>` tag keeps product + town + NC.** Google wants a title that's "a descriptive, helpful summary" and that doesn't exaggerate [G-HC]. Both versions can meet that. |
| Location detail | Neighbourhood name gets neighbours interested | More place names, more local terms | **Town plus a broad area name, and only with customer consent. Never a street.** Privacy beats both. |
| Copy length | Short, a sentence or two | Longer text, more keywords | **Short.** Google says outright that it doesn't prefer a word count. [G-HC] |
| Photos | Fewer, best ones, flattering crop | More images, more image-search hits | **3 to 6 good photos with real captions.** Quality and captions help image SEO too. [G-IMG] |
| Alt text | Not something people think about | Keyword-rich | **Describe the photo plainly, no keyword stuffing** (Google: stuffing "may cause your site to be seen as spam") [G-IMG]. No street names. |
| "Before" photos | Often hurt sharing (see §2) | More content | **Optional and neutral. Leave them out if the customer would wince.** |
| Map | Fun for neighbours | Local signal | **Area-level map, zoomed out, offset pin, or none.** **[Judgment]** No real SEO benefit is worth a privacy complaint. |

---

## 4. Share button and Facebook preview

### What Meta's docs say (pages opened 15 Oct 2026)
- Basic tags: `og:url`, `og:title`, `og:description`, `og:image`. `og:title` should be "the title of your article without any branding such as your site name". `og:description` should be "a brief description… usually between 2 and 4 sentences". `og:url` is the canonical URL and "should be the undecorated URL, without session variables, user identifying parameters, or counters." [M-WM]
- Image: minimum 200×200. Maximum 8 MB. "Use images that are at least 1200 x 630 pixels for the best display on high resolution devices". Below 600×315 you get a small preview. Stay "as close to 1.91:1 aspect ratio as possible". [M-IMG] The FAQ says images between 200×200 and 600×315 render as a small square, and that Facebook "tr[ies] to center the image around faces." [M-FAQ]
- Images are cached by URL. To change an image, publish it at a new URL and don't delete the old one. Set `og:image:width`/`og:image:height` so the first share renders properly. Otherwise "the first person who shares a piece of content won't see a rendered image" unless the URL was pre-scraped in the Sharing Debugger. [M-IMG]
- After a post gets more than 50 interactions, its title can't be changed. [M-FAQ]
- All links with the same `og:url` are treated as one resource "for the purpose of metrics and metadata". [M-CANON]
- Google's advice on `og:image` matches: pick a representative image, avoid logos and "an image with text", avoid extreme aspect ratios. [G-IMG]

### ⚠ Referral-code risk, test before launch
The referral code probably lives in the URL (e.g. `?ref=ABC123`). Meta says `og:url` should not contain user-identifying parameters [M-WM], so `og:url` should be the clean page URL. **[Judgment]** I couldn't find anything in the docs I opened that confirms whether the link in a posted share takes visitors to the URL that was shared (with `?ref=`) or to the `og:url`. **Test it with a real share before relying on it.** If the code gets dropped, fall back to a path-based referral URL that redirects to the page and records the referral first (e.g. `/r/ABC123` → 302 to the page with the code stored server-side), or a similar mechanism. Without this test you may get shares and no attributed leads.

### Specification
- **og:url:** the clean canonical page URL, absolute, no `?ref=` (the share link itself carries the referral).
- **og:title** (no "Skybird Roofing" suffix, per Meta): `A new Charcoal roof in Youngsville, NC` or `A Pewter Gray GAF roof for a Youngsville home`. Use the colour and product line from the record, and the town. Keep it to about 60 characters **[Judgment]**. Get it right before anyone shares, because it freezes after 50 interactions.
- **og:description:** 2 sentences (Meta's guidance is 2 to 4), drawn from the human-written summary, plus the credentials. Example structure: "[Human sentence about this job.] Installed by Skybird Roofing, a fifth-generation family roofer and GAF Master Elite contractor in Wake Forest." No prices, offers, urgency or claim language.
- **og:image:**
  - **1200×630 JPEG** (1.91:1), under 8 MB (aim for a few hundred KB **[Judgment]**), with `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/jpeg`, and an `og:image:alt` that describes the roof without any address details.
  - **Content:** the finished roof, from a flattering angle, in good light, filling most of the frame. No text overlay, no logo, no badge (Google advises against text and logos in og:image [G-IMG]). No people, since Facebook crops around faces [M-FAQ].
  - **Must not show:** the house number, mailbox, street sign, licence plates, people, or a neighbouring house number. Crop it out first. Blur only as a last resort, because blurring looks suspicious **[Judgment]**. Check the image at 1.91:1, because the crop can bring in things the original framing left out.
  - Make the file a separate export with no EXIF/GPS data, and a filename like `youngsville-nc-charcoal-roof-share-v1.jpg` with no street. If it changes, bump to `-v2` (new URL, per Meta).
- **Before sending any share link:** run the URL through the Sharing Debugger (https://developers.facebook.com/tools/debug/, login required) to check the tags and pre-cache the image. [M-WM][M-IMG]

### Button placement and wording
- **Show the button whenever the visitor arrived with a referral code** (that's the customer, or a friend re-sharing). **Also send the customer their personal share link directly** by text or email after page approval. **[Judgment]** Most customer shares will come from that message, not from a button they stumble across.
- **Placement:** directly under the hero/summary block, and again at the bottom after the gallery. Don't make it sticky or a pop-up. **[Judgment]**
- **Wording (customer view):** "Share your new roof". A secondary text link: "Copy link". Avoid "Refer a friend and earn…" unless a real referral reward exists in policy, and never invent one.
- **Wording (visitor view):** no share button needed at the top. The main action is "Get a roof estimate". A small "Share this project" at the bottom is fine.
- **Implementation:** Meta's Share Dialog (`facebook.com/dialog/share?...&href=`) [M-SD], with `href` set to the referral share URL.

---

## 5. Why 200 pages look generated, and how to stop it

**What gives it away [Judgment]:** the same sentence with the town swapped; the same title pattern; identical caption-less galleries; spec tables that are empty or say "N/A"; the same stock credibility paragraph on every page; superlatives like "stunning transformation"; dates without a single concrete detail. Google's guidance flags "extensive automation to produce content" and "automatically generating pages from feeds… without manual oversight" as low effort. [G-HC]

**Guards:**
1. **Per-job fields that actually differ** (pulled from records, never invented): town; completion month; manufacturer; product line; colour; warranty; plus any of these that are in the record: house style/storeys, roof features touched (ridge vent, skylights, chimney flashing, gutters, dormers, valleys), tear-off vs overlay, crew lead first name (with the employee's consent). If a field isn't in the record, it doesn't appear. No "N/A", no guesses.
2. **One or two human-written sentences per page.** They're written by someone who was on the job or reviewed the photos, and they include at least one detail that wouldn't make sense on any other page. Store them in a field with an author initial for internal auditing.
3. **Real captions** on every gallery photo, describing what's visible. "Roof photo 2" is not a caption.
4. **Banned boilerplate list.** The page fails review if the visible copy contains any of: "stunning", "transformation", "dream roof", "another happy customer", "we're proud to announce", "peace of mind", "protect your biggest investment", "top-quality", "state-of-the-art", "#1", "best in", "don't wait", "before it's too late", "storm season", "hail", "insurance claim", "free roof", "free" (unless it's a documented live offer), any $ figure, any number of years in business, any star rating.
5. **A sibling check:** before approving, the reviewer looks at the 3 most similar pages (same town or same product line). If the summary could be swapped between them without anyone noticing, rewrite it. **[Judgment]** A simple text-similarity flag in the CMS makes this cheap.
6. **Varied hero shots:** not every page uses the same front-elevation angle.
7. **Don't publish all 201 at once.** Publish backfill pages as each one passes the gate. A thin backlog page is worse than no page. **[Judgment]**

---

## 6. Page outline, top to bottom

1. **Breadcrumbs:** Home › Service areas › Youngsville › *[this project's short name]*. Visible HTML, with matching `BreadcrumbList` JSON-LD (at least two `ListItem`s; the last item can leave out `item`). [G-BC]
2. **Eyebrow:** "Completed September 2026 · Youngsville, NC"
3. **H1 (human):** e.g. "A new Charcoal roof for a two-story Youngsville home". Product line goes in the subhead if not in the H1.
4. **Hero photo:** the finished roof, privacy-checked, with descriptive alt text.
5. **Summary (1 to 2 human-written sentences)** about this job.
6. **Share row (customer/referral view):** "Share your new roof" (Facebook) · "Copy link".
7. **Specs table (filled):** Manufacturer · Product line · Colour · Warranty · Completed. Add optional rows only if they're in the record.
8. **Gallery:** 3 to 6 photos, each with a real caption and descriptive, keyword-light alt text. Filenames like `youngsville-nc-charcoal-ridge-vent-03.jpg`. EXIF stripped. A neutral before photo only if it passes §2.
9. **Customer quote (optional):** word for word, written permission, attributed only as "the homeowner". Not marked up as a Review.
10. **Who did the work:** one line, the same on every page by design, kept short: "Skybird Roofing is a fifth-generation family roofer in Wake Forest, NC, and a GAF Master Elite contractor." Link to About.
11. **Area map (optional):** zoomed to town/area level, offset pin per policy, no street view. **[Judgment]** In rural areas or on small cul-de-sacs, leave it out.
12. **Primary call to action:** "Thinking about your own roof? Get an estimate" (carries the referral code). No urgency.
13. **More nearby:** "More roofs we've done in Youngsville" (2 to 3 sibling cards) plus a link to the Youngsville service-area page.
14. **Secondary share:** "Share this project".
15. **Head/meta (not visible):** `<title>` "GAF Timberline HDZ Roof Replacement in Youngsville, NC | Skybird Roofing", meta description, canonical URL, og:* tags per §4, `primaryImageOfPage` or og:image pointing to the hero [G-IMG], and BreadcrumbList JSON-LD. Structured data only describes what's visible: no Review/AggregateRating unless real and shown, nothing hidden. [G-SD]

---

## Publish gate: the minimum before a reviewer clicks Approve

- [ ] **Privacy:** no homeowner name, address, phone or email in copy, alt text, filenames, captions, URL slug or JSON-LD.
- [ ] **Every photo checked** (including the 1200×630 og crop) for house numbers, mailboxes, street signs, plates, people and neighbours' house numbers.
- [ ] **EXIF/GPS stripped** from every published image.
- [ ] **Map** (if shown) is offset and zoomed to area level.
- [ ] **Specs filled from records:** manufacturer, product line, colour, warranty, completion month. Nothing invented and no "N/A".
- [ ] **One to two human-written sentences** with at least one job-specific detail, which pass the sibling check.
- [ ] **Every gallery photo has a real caption and descriptive alt text** (no keyword stuffing).
- [ ] **Banned-phrase scan passes:** no prices, no "free roof", no storm/claim/hail framing, no scare or urgency copy, no years in business, no reviews or quotes that aren't real.
- [ ] **No shaming "before" content.**
- [ ] **og:title / og:description / og:image set** as in §4, with image dimensions declared. URL run through the Sharing Debugger and the preview looks right.
- [ ] **Referral link tested:** a real share click lands with the referral attributed.
- [ ] **Customer has seen the page** (or at least the hero photo) before the share link goes to them.
- [ ] **Breadcrumbs visible** and matching the JSON-LD. Rich Results Test is clean.
- [ ] **Reviewer would be comfortable if it were their own house.**

---

## Sources opened for this review (15 Oct 2026)

**Meta.** WebFetch returned 403, so I read these pages in a headless browser.
- [M-WM] A Guide to Sharing for Webmasters: https://developers.facebook.com/docs/sharing/webmasters/
- [M-IMG] Images in Link Shares: https://developers.facebook.com/docs/sharing/webmasters/images/
- [M-FAQ] Link Sharing FAQ: https://developers.facebook.com/docs/sharing/webmasters/faq/
- [M-CANON] Specify a Canonical URL: https://developers.facebook.com/docs/sharing/webmasters/getting-started/versioned-link/
- [M-BP] Sharing Best Practices: https://developers.facebook.com/docs/sharing/best-practices/ (≥1080px width recommendation, pre-caching via the debugger)
- [M-SD] Share Dialog: https://developers.facebook.com/docs/sharing/reference/share-dialog/
- Meta Web Crawlers: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ (OG tags must be within the first 1 MB, gzip/deflate required, the page must be crawlable within a few seconds)
- Sharing Debugger: https://developers.facebook.com/tools/debug/ (requires a Facebook login; I opened the landing page only)

**Google**
- [G-IMG] Image SEO best practices: https://developers.google.com/search/docs/appearance/google-images
- [G-HC] Creating helpful, reliable, people-first content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- [G-BC] Breadcrumb (BreadcrumbList) markup: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- [G-SD] General structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies

*No statistics or study figures appear in this document. Example titles and captions are illustrative and must be replaced with details from each job's record.*
