# Skybird website chat — GoHighLevel rebuild pack

Date: 2026-09-30
For: whoever builds it in GoHighLevel (Jessica, or Claude once it has GHL access)
Rules carried from the handoff: spend nothing, do not touch ProLine, ProLine stays
the CRM of record, no HubSpot, and no new chat vendor.

Status (2026-10-01): **new bot created in HighLevel, switched OFF, no
channels.** Agent "Skybird Website Chat (new)", id `nUr4lwciitjDcYsL0N2Z`.
The live workflow and live bot are untouched. The prompt lives in
`docs/ghl-bot/prompt.md`, and the settings and actions in
`docs/ghl-bot/agent.config.json`. Push changes with
`node scripts/ghl-agent.mjs push` and read the bot back with `show`.

---

## 1. Why the current chat dies

Live tests by Jessica and Grok Bot (Sep 30 – Oct 1) are enough to replace it.
No more tests on the old bot are needed. What they showed:

- Only one path books: small leak → yes to the $850 minimum → "in the next
  2 weeks".
- These all get "All good, thanks for your time…" with no person involved:
  "No, that's more than I want to spend", and "Full re roof" → "Compare for
  now but needs to be done sooner than later" (same as Zachary Barnhardt,
  Sep 29).
- "I want to book an inspection tomorrow" gets misrouted to repairs and stops
  at the $850 question.
- "can someone call me" → "anytime" ends with no handoff.
- Every chat opens with a booking link and "Give us a minute to assign you
  the best person", but no step assigns, texts, or tasks anyone.
- Replies are slow, often 30–90 seconds.

The live chat is the workflow **"Jessica Conversation AI Workflow"**
(`dd528ebe-d751-4f93-aa69-9f9a92245a1e`). It runs a chain of **Conversation AI
workflow actions**. Each one is a router: it asks one question and sends the
reply down a named branch. HighLevel's docs say that action is *not free-form*,
and it always has two branches you can't remove:

- **Time Out**, when the contact doesn't reply
- **No Condition Met**, when the reply matches no branch *or* the action hits
  its **Bot responses limit**

In the live flow, the No Condition Met branches lead to "End conversation". So
any sentence that isn't a clean Yes, No, or service name ends the chat.
Jessica's three tests all failed this way.

Adding more branches won't fix it. What fixes it is changing which kind of bot
runs the conversation.

## 2. The fix

Use one **prompt-based Conversation AI bot** (AI Agents → Conversation AI) with
**Bot Goals → Appointment Booking** and **Human Handover** turned on. Put it on
the existing website chat widget. The bot handles the whole conversation, and
the workflow only does bookkeeping around it.

| Piece | Where | What it does |
|---|---|---|
| Prompt-based bot | AI Agents → Conversation AI | Reads any reply, asks follow-ups, offers calendar slots, books the inspection |
| Bot Goals | same bot → Bot Goals | Collects name, phone, and email, and books on one calendar |
| Human Handover | Bot Goals → Setup Your Actions → Human Handover | Assigns a person, sends a closing line, pauses the bot, creates a task, and tags `human_handover` |
| Workflow A: booked | Automations → Workflows | On Appointment Booked: internal notice, opportunity stage, and ProLine hand-off the way it's done today |
| Workflow B: handover | Automations → Workflows | On tag `human_handover` added: weekday text to the on-duty person, or a next-morning task after hours |

Prompt-based is the right mode. Per HighLevel's docs, guided and Flow Builder
bots are limited to a single calendar. Prompt-based bots also do reschedule
and cancel, and they're the mode that takes free text without a router.

### What happens to the old workflow

Don't delete it. **Unpublish it after** the new bot passes the test script in
§7. Keeping it gives an instant rollback: re-publish it and switch the widget
back.

---

## 2a. What the HighLevel account shows (read-only API check, 2026-09-30)

A Private Integration token is connected as an environment API credential.
Only reads were made, and nothing was changed.

- **Inspection calendar (likely F4):** "Skybird Storm & Leak Inspection",
  id `WUUK3NkRWQKjGdcppqnr`, slug `meta-calendar-bookings`. That's the same
  booking link the live workflow texts out. It's round robin across John
  Vollmer, Anas Elakri and Henry Styron: 60-minute slots, 15-minute buffers,
  bookable from 4 hours out up to 21 days ahead, 9 per day max, reschedule and
  cancel allowed. Its description says "complimentary inspection" (a hint for
  F5, but Jacob still needs to confirm the wording). The API showed about 11
  open slots per weekday next week.
- **Users who could take handoffs (F7/F8):** Jacob Vollmer, John Vollmer,
  Margaret Vollmer, Euan Swan (admins); Henry Styron, Anas Elakri, Kayla
  Rosal (users).
- **Pipeline:** "Skybird Roofing Pipeline (PPM)" already has the stages
  "Website Chat Form Submitted" and "Appointment Booked". Workflows A/B
  should use those, not new stages.
- **Existing published workflows to reuse, not duplicate:**
  "Appointment Booked - Henry", "Appointment Booked - John + Anas",
  "Appointment Booked - Reminder Sequence (2 hours before)",
  "Skybird Roofing - Chat Widget Leads". Read these in the builder before
  building Workflow A; it may already exist. "Send to Proline" is a
  **draft**.
- **Not visible to the API:** the live workflow
  `dd528ebe-…` is not in the workflow list (28 returned, including the
  SANDBOX draft), and the live bot `eCbg9EpJeVzGrb6e3Rad` returns "Agent not
  found" from the Conversation AI API. Agent search reports 1 agent but
  returns none. So the current chat bot can't be read or edited through
  the API, and it has to be checked in the UI.

## 3. Facts to fill in before building (the bot must not guess these)

**Answered by Jacob, 2026-10-01:** F4 = Skybird Storm & Leak Inspection
calendar. F7/F8 = Jacob. F3 = Raleigh and surrounding area, up to about an
hour from Raleigh, NC only, with homes near Wake Forest reached fastest. F5 =
same-day or next-day inspections and quotes; the calendar calls the
inspection complimentary. F9 = (919) 858-2895. F10 = respond fast and tarp
if needed. F11 = Skybird specializes in insurance claims and tells the
homeowner when there's an opportunity. F12 = **$1,500** repair minimum,
explained naturally, never as a yes/no gate. F2 isn't answered, so the bot
hands off instead of guessing. All of this is in `docs/ghl-bot/prompt.md`.

Open: Grok Bot's tests saw the live bot quote **$850**, not $1,500. Also,
skybirdroofing.net has a Greenville service-area page, and Greenville is
more than an hour from Raleigh.


The bot will make things up if these are blank. Each one needs a real answer
from Jacob.

| # | Fact | Answer |
|---|---|---|
| F1 | Services Skybird **does** (e.g. inspection, repair, full replacement, gutters, …) | ☐ |
| F2 | Services Skybird **does not** do (e.g. commercial flat roofs? solar? siding?) | ☐ |
| F3 | Service area: Wake Forest plus which towns/counties, and what to say to someone outside it | ☐ |
| F4 | Which HighLevel calendar the bot books inspections on (name + id), and its hours | ☐ |
| F5 | Is the inspection free, or is there a charge? One sentence exactly as Jacob wants it said | ☐ |
| F6 | Price questions: what the bot is allowed to say (suggested: "every roof is different, the inspector gives you a written number") | ☐ |
| F7 | Weekday handoff person(s) and hours (e.g. Mon–Fri 8–5 ET) | ☐ |
| F8 | After-hours owner: who gets the morning task | ☐ |
| F9 | Office phone number the bot may give out | ☐ |
| F10 | Emergency leak policy (active water coming in tonight: what should the bot say?) | ☐ |
| F11 | Insurance/storm claims: does Skybird help with them, and what may the bot say? | ☐ |
| F12 | The **$850 repair minimum** the live bot quotes: keep saying it? Before or after booking? And when someone says it's too much, should the chat end or go to a person? (Recommended: a person, since they may need a replacement or financing.) | ☐ |

Tone rules already set: local family company, fifth generation, GAF Master
Elite. Never say "free roof". No scare tactics. Never state a number of years
in business.

---

## 4. The bot prompt (paste into the prompt-based bot)

Replace every `{{F#}}` with the answer from §3 before publishing. If anything
is still in braces, the bot isn't ready.

```
You are the website chat assistant for Skybird Roofing, a local, family-owned
roofing company in Wake Forest, NC. The family has been roofing for five
generations and Skybird is a GAF Master Elite contractor. Never state a number
of years in business. Never promise a "free roof". Never use fear or pressure
("your roof could collapse", "act now"). Sound like a friendly person at a
local office: short messages, one question at a time, plain words.

YOUR JOB, IN ORDER OF PREFERENCE
1. Book a roof inspection on the calendar, OR
2. If they don't want to book yet, or want a person, collect their name, mobile
   number, and what the job is, and hand the conversation to the team.
Either outcome is a success. Ending the chat without one of them is a failure.

WHAT SKYBIRD DOES: {{F1}}
WHAT SKYBIRD DOES NOT DO: {{F2}}. If asked, say so kindly and do not book.
SERVICE AREA: {{F3}}. If the address is outside it, say so kindly, and still
offer to have someone call if they'd like.
INSPECTIONS: {{F5}}. Inspections are booked on the calendar; offer 2–3 real
open times from the calendar. Never invent a time.
PRICE: {{F6}}. Never quote a price, range, or discount.
INSURANCE / STORM: {{F11}}
ACTIVE LEAK / EMERGENCY: {{F10}}
OFFICE PHONE: {{F9}}

HOW TO READ REPLIES
People answer in normal sentences. Treat any reply that mentions a roof
problem, a project, a timeline, or a question as interest, never as a
"no". Examples:
- "comparing for now but it needs to be done sooner than later" = interested,
  not ready. Say an inspection is the easiest way to compare (they get a
  written assessment), and offer times. If they still don't want a time,
  collect name, phone, and job and hand off.
- "anytime" when you asked for a time = offer the next 2–3 open slots and
  let them pick one.
- "just a call first" or "can someone call me" = they want a person. Collect
  name, phone, and job, then hand off.
- "I want to book an inspection tomorrow" = book it. Offer tomorrow's open
  slots; if none, offer the nearest ones.
- "yes, but how much?" = answer the price question per the PRICE rule, then
  ask if they'd like a time. Do NOT treat this as a booking.

ONLY END THE CONVERSATION if the person clearly says no/stop, says they are not
interested, or is not a homeowner/customer (e.g. a vendor or wrong number). Then
thank them in one short line.

IF YOU'RE UNSURE WHAT THEY MEAN, ask one short clarifying question. After two
clarifying questions that don't make it clear, stop asking. Collect name, phone,
and job, then hand off to a person. Never say goodbye just because a reply
was unclear.

BEFORE BOOKING OR HANDING OFF, make sure you have: first and last name, mobile
number, property address or town, and one line describing the job (for example
"small leak over kitchen" or "full replacement, comparing quotes"). Ask only
for what you don't already have.

NEVER: claim an appointment is booked unless the calendar confirmed it; make up
availability, prices, warranties, or years in business; argue; send more than
one question per message.
```

### Bot settings

- **Mode:** prompt-based. **Status:** Suggestive first (a human approves each
  reply), then Auto-Pilot only after §7 passes.
- **Channels:** Live Chat (website widget `6a88728eadb97883f82cccae`). Add SMS
  later, only after chat passes.
- **Bot Goals → contact fields:** first name, last name, phone, email
  (optional), address.
- **Bot Goals → Appointment Booking:** Single Calendar = {{F4}}. Turn on
  reschedule and cancel. Turn on "pause bot after booking".
- **Wait time:** short (a few seconds), so it feels live.
- **Bot training / knowledge base:** add the facts from §3 as a short FAQ, and
  optionally skybirdroofing.net pages. Do NOT add any page that states a
  years-in-business number.

---

## 5. Human Handover settings

Bot Goals → Setup Your Actions → **Human Handover**. HighLevel has three
triggers built in. Use all three:

| Trigger | Setting |
|---|---|
| Human Requested | On. Example phrases: "can someone call me", "talk to a person", "real person", "just a call first", "call me" |
| Lack of Information | On |
| Failed to Resolve Issue | On (HighLevel caps this at 2 retries, which matches the two-clarification rule) |

After-handover actions:

- **Assign Conversation to a User:** {{F7}} (check "skip if already assigned")
- **Final Message:** one line that's true at any hour:
  > "Thanks, {{contact.first_name}}. I've passed this to our team. If it's
  > during office hours someone will reach out shortly; otherwise we'll call
  > you first thing in the morning."
- **Bot Pause Behaviour:** pause 1 day. The bot must not talk over a
  person, and a new chat the next day can start the bot again.
- **Create a Task:** On (HighLevel sets the due time to 24 h from the trigger)
- **Create Tags:** `human_handover` (the default), plus `website_chat`

Staff alerts on assignment are set per user under **Settings → My Staff →
Notification Settings**. Check that {{F7}} has them on.

---

## 6. Workflows around the bot (bookkeeping only, no questions asked)

**Workflow A — "Website chat: inspection booked"**
Trigger: Customer Booked Appointment, calendar = {{F4}}.
Actions: internal notification to {{F7}}; move the opportunity to the booked
stage; whatever step already pushes booked jobs toward ProLine (don't change
that mechanism).

**Workflow B — "Website chat: handover"**
Trigger: Contact Tag Added = `human_handover`.
Actions:
1. If/Else on current time (ET): weekday within {{F7}} hours →
   send internal SMS to the on-duty person with name, phone, and the last
   chat message.
2. Else (nights and weekends) → create a task for {{F8}}, due next business
   day 8:30 AM, titled "Website chat lead: call back".
3. Both branches: set the opportunity stage to the existing "needs call" /
   "Website Chat Form Submitted" stage.

Neither workflow contains a Conversation AI router action. The bot does all
the talking.

---

## 7. Test script (must pass before Auto-Pilot)

Rules for testing:
- Use a **new contact each run** (new phone and email). Jacob Test
  (`vSVECQiDAtQCWMol0cio`) is already known, so reusing it resumes the old
  thread instead of starting a new one.
- Test in the real widget on skybirdroofing.net with the bot in Suggestive
  mode. Or put the widget on a hidden test page first, so the live site keeps
  the old flow until the new one passes.
- A pass means the outcome in the table *actually happened in HighLevel*: an
  appointment on the calendar, or a task plus assignment plus tag. What the
  bot says in chat doesn't count on its own.

| # | Homeowner says | Must end in |
|---|---|---|
| T1 | "Full re roof" → "Compare for now but needs to be done sooner than later" | Offered times; if declined → handover with name, phone, job |
| T2 | "I just have a small leak, can someone call me" | Handover (Human Requested), task created, no goodbye |
| T3 | "small leak" → asked for a time → "anytime" | 2–3 real slots offered → booked |
| T4 | "I want to book an inspection tomorrow" | Tomorrow's slots (or nearest) → booked appointment on {{F4}} |
| T5 | "Yes, but how much?" | Price rule answered, then asked for a time. Not booked unless they pick one |
| T6 | "not interested, stop" | Polite one-line close, no handover, no follow-up |
| T7 | "asdf" / "?" / "hmm" three times | Two clarifications max, then handover |
| T8 | Address outside {{F3}} | Says so kindly, offers a call, doesn't book |
| T9 | "Do you do solar panels?" (or any F2 item) | Says no kindly, doesn't book |
| T10 | "Water is pouring through my ceiling right now" | Follows {{F10}}, hands off urgently |
| T11 | Book, then "can I move it to Friday?" | Rescheduled on calendar |
| T12 | Handover on Saturday | After-hours line; Monday-morning task for {{F8}} |
| T13 | Handover on a weekday during hours | Assigned user gets a notification and an internal SMS |
| T14 | Ask "how long have you been in business?" | Family / fifth generation, no years figure |
| T15 | "small leak" → told the $850 minimum → "No, that's more than I want to spend" | Follows F12; does not end with the old goodbye unless Jacob chose that |
| T16 | "Full re roof" → "yes, in the next 2 weeks" | Booked |
| T17 | "Need new gutters" | Booked or handover with the job noted as gutters |
| T18 | First message at any time | No "assign you the best person" promise unless a person really gets assigned; first reply in under ~15 s |

Record each run (date, contact id, pass/fail, and a screenshot of the
calendar or task) at the bottom of this file.

---

## 8. Rollout

1. Fill §3 (Jacob).
2. Build the bot + Handover + Workflows A/B with the bot in **Suggestive** mode
   on a test page (the old workflow stays live on the real site).
3. Run §7. Fix the prompt, not the workflow, until everything passes.
4. Switch the site widget to the new bot and **unpublish** the old workflow
   (don't delete it).
5. Go to **Auto-Pilot** after one clean week of Suggestive on live traffic.
6. Rollback: re-publish "Jessica Conversation AI Workflow" and switch the bot
   back to Off.

---

## 9. Access Claude needs to build this itself

As of now Claude can't reach GoHighLevel from this session. There's no GHL
connector here. Options, cheapest first:

1. **No access, current path:** Jessica builds from this file and pastes back
   test results. Claude revises the prompt from the transcripts.
2. **HighLevel Private Integration Token** (Settings → Private Integrations,
   no cost), scoped to the Skybird location `IEVhsiYap9OkVXH15T90`, with
   conversations, contacts, calendars, and workflows *read* scopes, plus
   write only if Jacob wants Claude to edit. Add it as an environment secret
   on this Claude Code environment, never in chat or in the repo. With read
   access Claude can pull real test transcripts and check that appointments
   and tasks actually got created. HighLevel's public API for creating and
   editing Conversation AI agents needs to be confirmed against HighLevel's
   official API docs before anyone relies on it. Until then, assume bot
   settings are changed by hand in the UI.
3. **Browser access** (Claude in Chrome on Jacob's or Jessica's computer,
   signed into GHL): Claude can click through the builder under supervision.
   This is the only route that covers every UI-only setting.

---

## Test log

| Date | Test | Contact id | Result | Evidence |
|---|---|---|---|---|
| | | | | |
