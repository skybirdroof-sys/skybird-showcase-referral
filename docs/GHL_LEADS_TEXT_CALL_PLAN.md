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

**Inbound calls are fine.** In the last 100 conversations, 17 of 19 inbound
calls were answered. One of the two misses got a text back within 3 minutes.
The "Missed Call Response SMS" workflow is a **draft**, so nights and weekends
aren't covered.

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

**Wiring (UI, since the workflows API is read-only):** in "Meta Lead Form
Submission - Send Email to Euan/Jacob + SMS to contact", replace the SMS step
with the new opening text and then **assign the new bot** to the contact. Keep
the email to Euan/Jacob. Do the same for the website quote form workflow.

---

## 3. Fix 3 — calling new leads

**Recommended, no added cost: speed-to-lead call bridge.** HighLevel
workflows have a **Call** action: it rings a team member's phone first, and
when they pick up, it dials the lead. Add it to the Meta form and website form
workflows:
- **Weekdays 8–5:** within 1 minute of the form. Ring the person on duty
  (to decide: Jacob, or the inspection rotation John / Anas / Henry). If
  nobody picks up, try once more after 5 minutes, then create a task.
- **Nights and weekends:** no call. The text conversation (Fix 2) holds the
  lead, and a task for Jacob is due at 8:30 AM the next business day.
- Every call goes through HighLevel, so it's logged on the contact. That
  fixes the "who called them?" gap.

**Missed inbound calls:** publish a cleaned-up "Missed Call Response SMS".
On a missed call, text *"Sorry we missed your call, this is Skybird Roofing.
What's going on with your roof?"* and hand the reply to the same bot. This
mainly covers nights and weekends.

**Not recommended yet: an AI voice agent that calls leads.** HighLevel's Voice
AI is billed per minute, which breaks the no-spend rule. And under the FCC's
2024 ruling, AI-voice calls to a cell phone need prior express written consent
from the lead. Using it would mean checking the exact consent wording on the
Meta and website forms first. Revisit only if the call bridge isn't fast
enough.

---

## 4. Decisions needed from Jacob

1. **Who gets rung for new-lead calls on weekdays:** Jacob, or the John /
   Anas / Henry rotation?
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
