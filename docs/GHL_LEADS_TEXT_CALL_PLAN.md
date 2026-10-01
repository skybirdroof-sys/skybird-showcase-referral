# Skybird new leads — texting and calling plan

Date: 2026-10-01
Companion to `GHL_CHAT_REBUILD.md`. Same rules: spend nothing, don't touch
ProLine, and don't buy a new tool. Goal for every new lead: **a booked
inspection, or name + number + job in front of Jacob**, the same as the chat.

Status: **plan only. Nothing changed in HighLevel.**

---

## 1. What the account shows (read-only API, last ~100 opportunities, Sep 7 – Oct 1)

| Source | Leads | Booked or sold (pipeline stage) | Notes |
|---|---|---|---|
| Google Business Profile (phone calls) | 42 | 3 | Mostly inbound calls, and those get answered |
| Meta Ads form | 27 | 4 | Every one gets the same auto-text with a booking link |
| Website quote form | 11 | 6 | |

Stages can lag behind reality. A job booked by phone may never get its stage
moved. Treat these as a baseline, not a verdict.

**Inbound calls: corrected after Jacob's note (2026-10-01).** An earlier
version of this plan said inbound calls were "fine". That was wrong. Most
of the answered calls were HighLevel **Voice AI** ("Jessica"). Jacob disabled
her because she was that bad. Across all 88 inbound calls since April:
- Mid-June to early July: John and Jacob answered directly. Many calls went
  to voicemail or no-answer (week of Jun 22: 2 answered, 9 missed).
- Aug 25 – Sep 30: 35 calls are marked Voice AI. Transcripts show 16 were
  Jessica ("Hey. You have reached Skybird Roofing. How can I help you
  today?"). The rest were people (Margaret, Jacob, Jose) on the same line,
  or voicemail. Her last call was Sep 29.

What Jessica did on those 16 calls:
- **Transfer to a person works.** "Can I talk to an employee" and "I need
  to speak with somebody" both got transferred, and Jacob picked up. Keep
  this.
- **Cancel or reschedule fails.** Two callers trying to cancel an estimate
  were told "I don't see any upcoming appointments", and one call ended there
  with nothing created for a person. The bot only sees its own calendar.
  Inspections booked on a personal calendar or in ProLine are invisible to
  it.
- **Booked outside the area.** She offered times and took an address in
  Tarboro (over an hour from Raleigh) with no service-area check.
- **Loops on off-topic asks.** She asked a satellite-dish caller the same
  clarifying question again instead of handing off.
- **Says "free inspection".** That's OK per the calendar, but she has no
  $1,500 repair-minimum line and no insurance wording.
- **Short or silent calls** (greeting only, under a minute) leave no note
  for anyone.

**Text replies:** Jessica (the Conversation AI bot) texts the booking link
5 minutes after a new lead unless Jacob adds the tag "Jacob". The fast
replies sent as Jacob are Jacob himself, by hand.

**Meta form leads are the leak:**
- 37 of 38 form leads got the same first text: *"{name}, this is {name}, an AI
  Assistant with Skybird Roofing. If you're ready to schedule an appointment,
  click this link: …"* It drops a link, asks nothing, and puts all the work
  on the homeowner.
- Only **3 of 27** Meta leads texted back.
- Only **7 of 27** have a call from a team member logged in HighLevel (median
  about 30 minutes after the lead came in). Calls from personal cell phones
  don't show up here, so the real number may be higher. That gap is itself a
  problem: nobody can see who's been called.
- When leads *do* text back, someone answers fast (median under a minute; 11
  of 17 replies were sent as Jacob).
- "Meta Leads - Auto Texts 1-5 Day Nurture" is a **draft**. There's no
  follow-up after the first text.

---

## 2. Fix 2 — texting new leads

**Same bot, new channel.** Don't build a second bot. Turn on SMS for "Skybird
Website Chat (new)" (`nUr4lwciitjDcYsL0N2Z`) once the chat tests pass, so
chat and text share one prompt and one set of rules ($1,500, Jacob handoff,
service area). Add a short SMS section to `docs/ghl-bot/prompt.md`: the lead
already gave a name and number, so don't ask again. Keep texts to one or two
sentences.

**Replace the opening text.** It should start a conversation instead of
dropping a link:

> "Hi {first name}, this is Skybird Roofing in Wake Forest. Got your request
> about your roof. Is it a leak, storm damage, or are you thinking about a
> replacement?"

Their reply goes to the bot, which books or hands off, the same as the chat.
Don't sign texts with a person's name (like "this is John") unless that
person really sent them.

**Follow-ups, if they don't reply** (the bot's follow-up settings, which the
API supports):
- After about 4 hours: a light check-in.
- Next day: offer the next two open inspection times.
- Day 3: a last note ("We'll leave it here. Text us anytime."). Then stop.
- Stop the moment they reply, book, or say stop.
- Send only between 8 AM and 8 PM Eastern.

**Keep the 5-minute grace period, drop the tag.** The new bot pauses itself
for 24 hours as soon as anyone on the team texts the lead by hand
(`sleepOnManualMessage`). So Jacob just replies, and no "Jacob" tag is
needed. If nobody replies within 5 minutes, the bot sends the opening
question, not a link.

**Wiring (UI, since the workflows API is read-only):** in "Meta Lead Form
Submission - Send Email to Euan/Jacob + SMS to contact", replace the SMS step
with the new opening text and then **assign the new bot** to the contact. Keep
the email to Euan/Jacob. Do the same for the website quote form workflow.

---

## 3. Fix 3 — answering calls (Voice AI rebuilt, people first)

The problem isn't that an AI answers. It's that Jessica answered *instead of*
people, with no rules, no handoff note, and a calendar she couldn't see.
Rebuild her with the same rules as the chat bot, and put her behind the team:

1. **People ring first.** Weekdays 8–5: the call rings the team first (the
   existing IVR / call routing). Voice AI only answers if nobody picks up
   within ~20 seconds, and nights and weekends.
2. **Same rules as chat and text.** Same facts: $1,500 minimum said
   naturally, service area (about an hour from Raleigh, NC only), insurance
   claims, fast leak response with a tarp, Jacob handoff, no years in
   business. One prompt source in the repo, adapted for speaking: short
   sentences, read times slowly, confirm the address back.
3. **Book only on the inspection calendar**, and only after the address
   passes the service-area check.
4. **Anything she can't do goes to Jacob, with a note:** cancellations,
   reschedules she can't find, HOA or commercial jobs, off-topic asks, or
   any confusion after two tries. During the day: live transfer to Jacob
   (already works). After hours: "Jacob will call you first thing in the
   morning", plus a task and a summary on the contact.
5. **Every call leaves a trace:** a call summary on the contact, the
   opportunity in the right stage, and a `voice_ai` tag. A greeting-only or
   silent call gets a text-back: "Sorry we got cut off, this is Skybird
   Roofing. What's going on with your roof?" That hands off to the
   text bot.

**Cost:** Voice AI is billed per minute. Skybird already ran it, so this
isn't a new tool, but Jacob should confirm the minutes are OK. Putting her
behind the team means fewer minutes than before.

**Access:** add `voice-ai-agents.readonly`, `voice-ai-agents.write`,
`voice-ai-agent-goals.readonly`, `voice-ai-agent-goals.write` and
`voice-ai-dashboard.readonly` to the token. Then Claude can read Jessica's
current setup and call logs and build the new voice agent switched off, the
same way as the chat bot. Phone routing (ring people first) is UI-only.

**Outbound calls to new form leads** (the earlier call-bridge idea) are
optional and separate. HighLevel's Call action rings a team member and then
dials the lead, logged in HighLevel. Do it later if Jacob wants it. An AI
voice placing outbound calls is *not* recommended: per-minute cost, plus FCC
written-consent rules for AI-voice calls to cell phones.

## 3a. Spam leads, and Euan's "Jessica calls Meta leads" idea

**Spam.** 5 of the last 27 Meta leads are tagged `spam call` or `bad lead`,
all in September. Excluding them, the real baseline is **4 of 22 Meta leads
booked**. Rules for every bot: a contact tagged `spam call` or `bad lead`
gets no follow-up texts and no calls, and the bot stops. Cheapest fix
upstream: in Meta Ads Manager, set the Instant Form type to **Higher
intent** (adds a review step before submit). That's free and cuts junk.

**Euan's idea has two parts:**
1. *Pick up a call Jacob misses:* **yes.** That's Fix 3 (people first,
   Voice AI as overflow and after hours). The caller dialed us, so there's
   no consent issue. Do this first.
2. *Jessica calls Meta leads:* calling fast is the right instinct. Speed to
   first contact is the biggest lever on set rate. Doing it with an AI voice
   needs three things first:
   - **Consent.** Under the FCC's 2024 ruling, AI-voice calls to a cell
     phone are "artificial voice" calls under the TCPA and need the lead's
     prior express consent, written consent for sales calls. The Meta form's
     disclaimer has to name Skybird and cover calls and texts, including
     automated or AI. Jacob or Euan to send a screenshot of the form's
     privacy / custom disclaimer screen.
   - **Spam screen.** A spam lead often has someone else's real number on it.
     An AI call to that person had no consent at all, and that's where TCPA
     exposure is ($500–$1,500 per call). Only call leads that aren't tagged
     spam, and preferably ones that have replied to the first text.
   - **Minutes.** Per-minute Voice AI cost on every lead, spam included.

   **Proposed test:** the first 2 weeks after the text bot launches, use the
   free HighLevel **Call** bridge (rings Jacob, then dials the lead, logged)
   within a minute on weekdays. Then, if the consent wording checks out, turn
   on Voice AI outbound for nights and weekends only, for leads that pass
   the spam screen. Compare booked per real lead against 4/22. Honest
   caveat: at about 7 real Meta leads a week, a month of data only shows a
   big difference, not a small one.

## 4. Decisions needed from Jacob

1. **Calls:** who rings first on weekdays before Voice AI picks up (just
   Jacob, or the team)? And are Voice AI minutes OK?
2. **First text:** OK to say "this is Skybird Roofing" with no person's name?
3. **Follow-ups:** is three texts over three days right?
4. **Order:** ship texting right after the chat bot passes, then calling? (I
   recommend this order. Texting reuses the bot, so it's mostly a channel
   switch.)

## 5. How we'll know it worked

Same report, re-run four weeks after launch: Meta-lead reply rate (baseline
3/27), logged calls within 5 minutes on weekdays (baseline: median ~30 min,
7/27 logged), and Meta leads reaching "Appointment Booked" (baseline 4/27).

## 6. Access

- The texting changes are mostly the bot's settings: done through the API with
  the current token, plus the one workflow SMS-step swap in the UI.
- The call bridge and the missed-call workflow are UI-only. Jessica or Grok Bot
  can build them, with Claude writing the exact steps.
- Optional, to read Voice AI and phone-number settings: add `voice-ai-agents.readonly`
  and `phonenumbers.read` to the token. Not needed for the plan above.
