# Test request for Grok Bot: new Skybird website chat bot

From Claude, 2026-10-01. Jacob approved running these tests.

## Rules

- Test **only** the new bot: AI Agents → Conversation AI → **"Skybird Website
  Chat (new)"** (id `nUr4lwciitjDcYsL0N2Z`). Use its built-in **Test / Test
  your bot** panel.
- **Change nothing.** Don't change its mode, channels, prompt, or actions.
  Don't touch "Jessica Conversation AI Workflow" or the live bot.
  Don't test on skybirdroofing.net. The new bot isn't attached to the site.
- Start a fresh test conversation for each test (reset or clear the panel).
- If the panel can actually book, don't confirm a real slot. Stop at the
  point where it offers times, and write down the times it offered.
- If the panel won't run without the bot being on a channel or in a mode
  other than Off, **stop and report that**. Don't change the setting.

## Tests

Type the homeowner lines one at a time and wait for each reply.

| # | Homeowner types | Pass if the bot… |
|---|---|---|
| 1 | "Full re roof" → "Compare for now but needs to be done sooner than later" → (if offered times) "not yet" | offers inspection times; on "not yet", asks for name/mobile and hands to Jacob. No goodbye |
| 2 | "I have a small leak" → (after the $1,500 line) "that's more than I want to spend" | says the $1,500 minimum naturally (no "are you okay with that?"), mentions complimentary inspection / insurance, then times or handoff. No goodbye |
| 3 | "I want to book an inspection tomorrow" | offers tomorrow's real times (or the nearest ones). Doesn't ask the repair-minimum question first |
| 4 | "can someone call me" | asks for name + mobile, then hands to Jacob with the "passed this to Jacob" line |
| 5 | small leak → asked for a time → "anytime" | offers the earliest 2–3 real times |
| 6 | "water is coming through my ceiling right now" | treats it as urgent, mentions fast response / temporary tarp, offers earliest time or hands off |
| 7 | "we had hail last week, will insurance cover it?" | says Skybird specializes in insurance claims and the inspection documents damage; never promises coverage |
| 8 | "I'm in Charlotte" | kindly says that's outside the area; doesn't book |
| 9 | "asdf" → "?" → "hmm" | at most two clarifying questions, then asks for contact info / hands off |
| 10 | "not interested, stop" | one short polite line, then stops |
| 11 | "how long have you been in business?" | family / five generations / GAF Master Elite; no number of years |
| 12 | "yes but how much?" | price rules (no made-up numbers), then offers times; not treated as booked |

## Report back

For each test: the full transcript (copy the text, or a screenshot), PASS or
FAIL, and for a FAIL, the one line where it went wrong. Also note how long
the replies took, roughly.
