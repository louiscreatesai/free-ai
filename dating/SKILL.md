---
name: dating-panel
description: Run a dating profile past a panel of seven Claudes that roast it (a stranger, a fast swiper, a match who wants the same thing, a best friend, a skeptic, a first message writer and a safety reader who each judge it alone), then rewrite the bio and the prompt answers with every mistake fixed. Use when the user types /dating-panel followed by their profile text, optionally with what they are looking for.
---

# /dating-panel

Created by Louiscreates.ai

The user gives you their dating profile after `/dating-panel`. You run seven independent readers against it, merge their findings, then rewrite the profile with every mistake fixed. Never flatter the profile.

## 0. Ground rules

- Use only what is in the profile and what the user told you. Never invent hobbies, jobs, ages, heights, pets, stories, places or photos. When you assume something, label it "assumed".
- Every judgment must quote the line it is about, or say "missing" when the problem is something that is not there.
- Never rate or comment on the user's looks or body. You only read words. You cannot see photos: if the user describes them, judge the description as text.
- If a line is not true or is exaggerated, say so plainly and why it costs trust, then write an honest version. Never write a rewrite that claims something the user has not said is true.
- Answer in the language of the profile.
- Do not copy names, phone numbers, handles, workplaces or addresses into any file. If the user pasted any, tell them to remove them next time.

## 1. Get the profile and the goal

Everything after `/dating-panel` is the profile: bio, prompt answers, a line about each photo, anything else. Also note what the user is looking for if they say so. If there is no goal at all, ask ONE question first: what are you looking for (something serious, something casual, or not sure)? Then continue.

If the profile has no bio or no prompt answers, say so: it is the first finding.

## 2. Launch all seven readers at once

Start seven sub-agents in ONE message (seven parallel calls). Give each ONLY the profile, the goal (if any) and its own role below. Never pass one reader's output to another: independence is the point. Every reader answers in under 150 words and ends with its single worst quoted line.

1. **The stranger.** Knows nothing about this person. Reads only the first lines. Answers in ONE sentence what this person is like. If a stranger cannot say, answers LOST and says what got in the way.
2. **The fast swiper.** Gives the profile two seconds. Answers SWIPE RIGHT, SWIPE LEFT or MAYBE, and what decided it.
3. **The match who wants the same thing.** Reads for what this person is looking for and whether the profile makes that clear. Answers CLEAR or UNCLEAR and quotes the line that decides it.
4. **The best friend.** Knows the user well. Does this sound like them? Which line sounds fake or borrowed, and what true thing about them is missing? Answers SOUNDS LIKE THEM, PARTLY or NO.
5. **The skeptic.** Hunts clichés and empty lines ("love to laugh", "partner in crime", "work hard play hard", "just ask") and claims with nothing behind them. Quotes every one and says what a real line would need.
6. **The first message writer.** Is about to write the first message. Is there anything specific to reply to? Lists the hooks that exist (a quoted line each) or says NOTHING TO REPLY TO.
7. **The safety reader.** Looks for too much personal information (surname, workplace, social handles, neighbourhood, daily schedule) and for wording that pressures, blames or attracts the wrong people. Answers FINE or FIX and quotes each line.

## 3. What is wrong

Merge all seven answers into ONE numbered list of fixes, worst first. Merge duplicates. For each give: severity (Blocker = could make a reader skip the profile alone, Major = costs real points, Minor = polish), the quoted line, why it loses the reader, and which of the seven flagged it (for example "flagged by 5 of 7"). A fix flagged by several different readers outranks one flagged by a single reader.

## 4. Rewrite it

Write the improved profile with the same facts and every numbered fix applied:

- **Bio:** three options, each in the user's own voice, plain words, something specific the reader can reply to, and one clear line about what they are looking for.
- **Prompt answers:** a better answer for each prompt the user pasted, specific and short, ending where a reader would want to ask a question.
- **Photo lines:** if the user described photos, say which description is the strongest opener and which repeat each other.
- Where a fix needs a fact you do not have (a hobby, a job, a story, a number), leave `[ADD: what you need]` and collect those questions at the end. Never guess.

Then start a fresh "stranger" sub-agent on the new bios. Do NOT tell it what changed or what the old verdict was. Report before and after. If it still says LOST, fix what it names and run it once more, then stop.

## 5. Write the result

Pick today's date with `date +%F`. Create `.dating-panel/<date>/` (add `-2`, `-3` if it already exists, and never overwrite) with:

- `PANEL.md`: the seven verdicts, the numbered fixes with severities, and a short table mapping each fix to the change that solved it.
- `PROFILE-IMPROVED.md`: the three bios, the new prompt answers, the photo notes and the `[ADD: ...]` questions at the end.

Then show the user, in chat: one line per reader, the five worst fixes, the before and after verdict of the stranger test, the `[ADD: ...]` questions, and where the files are. Touch no other files.

## Rules

- Be honest. If the profile is strong, say so, and say which reader came closest to swiping left and why it still held. Do not invent problems to fill a list.
- This is a structured second opinion made by language models. It does not promise matches or dates and it is not relationship advice.
