# 04 — Pin Precision: How Others Handle It

Skybird Project Showcase + Referral System · Research, 2026-09-14
Resolves open item #4 from `03-structure-signoff.md` (pin precision method)

---

## 0. The short answer

**Use a fixed, randomized offset from the true location — generated once per project and stored permanently — capped at a radius of roughly 0.2–0.3 miles.** This is the same underlying approach Airbnb uses (blurred-circle placement), adapted to Skybird's lower-risk situation. Details and reasoning below.

## 1. Who actually solves this problem, and who doesn't

**Zillow / Redfin turned out to be the wrong comparison.** Their whole business model depends on showing the *real* address — a buyer needs to find the actual house. They don't obfuscate location at all for active listings. Not useful precedent here; move past it.

**Airbnb is the real precedent**, because their problem is structurally the same as Skybird's: show enough to market the thing, without exposing precisely which house it is.

- Airbnb shows a **fuzzy shaded circle** on the map, not a pin, for any listing before booking. The real address only appears after a reservation is confirmed.
- The circle's underlying mechanism: the **true coordinates are offset by a random distance within a fixed radius**, generated once and then held stable for that listing (it doesn't move between page loads).
- **Documented radius: roughly 0.3–0.7 miles**, depending on the source and market density.
- **Known weakness, worth knowing about even though it likely doesn't apply here:** researchers were able to re-identify ~94% of Airbnb hosts in a sample by cross-referencing the approximate circle with public voter-registration records (matching on host's first name + town, then picking whichever registered voter lived closest to the circle's center). The attack works because Airbnb listings pair the fuzzy location with other identifying information — the host's first name, photos, sometimes enough detail to narrow down a small candidate pool.

## 2. Why Skybird's threat model is meaningfully lower risk than Airbnb's

This matters for deciding how much complexity is worth building:

- Skybird's project pages **already exclude the homeowner's name, phone, email, and exact address** by the brief's own hard rule (§24). Airbnb's re-identification attack depends on having a name to search against — Skybird's pages give an attacker nothing to search with in the first place.
- Airbnb's stakes are personal safety (guests showing up at a host's actual home). Skybird's stakes are homeowner comfort/privacy about "everyone knows this is my house" — lower severity, though still worth taking seriously and it's still the brief's explicit rule.
- Given that gap, **Skybird doesn't need Airbnb's exact radius or their more defensive posture** (Airbnb has had to react to public re-identification research; Skybird is designing before any such pressure exists). A simpler version of the same idea is proportionate here.

## 3. The academic alternative, and why it's probably overkill

There's a more sophisticated technique in the privacy-engineering literature called **pinwheel obfuscation** — instead of a uniform random offset in a circle (which produces a predictable, symmetric blur that's easier to statistically reverse), the point is shifted along a random angle at a random radius up to some max, producing an asymmetric, less predictable displacement. It's measurably more resistant to naive re-identification.

Worth knowing this exists, but it's built for adversarial contexts (public health data re-identification, regulatory circumvention) — a meaningfully higher threat model than a roofing company's marketing site. Recommend not building this; the simpler fixed-radius offset is proportionate to what's actually being protected against here.

## 4. Practical recommendation for Phase 2

1. **Generate the offset once, at the point the project is tagged for showcase**, using the CompanyCam project's `coordinates` field (already available per `01-api-audit.md` §1.2) as the true starting point.
2. **Store the offset coordinates**, not a formula to compute them on the fly — the pin needs to stay in the same place every time the map loads, not jitter around on refresh.
3. **Radius: ~0.2–0.3 miles**, randomized direction and distance within that circle. Tight enough to still land the pin in a recognizable part of the right neighborhood (useful for the "look how much work we've done near you" impression the map is going for), loose enough that it's not pointing at the actual house.
4. **One offset per project, not one offset per street/neighborhood** — this keeps multiple nearby projects visually distinct as separate clickable pins, which the widget design requires (a shared neighborhood centroid would stack multiple projects on the exact same point, breaking the click-through UX Euan asked for).
5. This is an internal implementation detail — no need to disclose the mechanism publicly, but it's worth being able to say plainly "we show an approximate area, not the exact address" if a homeowner or a regulator ever asks, which the brief's existing privacy language already supports.

This closes open item #4. Recommend treating this as settled unless Euan or Jacob wants a different radius — it doesn't require his sign-off the way the URL/widget structure did, since it's purely a data-handling decision on Skybird's side of the system.
