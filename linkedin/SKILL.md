---
name: linkedin-panel
description: Run a LinkedIn profile past a panel of seven Claudes that roast it (a stranger, a recruiter, a hiring manager, someone who has your dream job, a rival, a skeptic and a referrer who each judge it alone), then rewrite the headline, the About section and the experience lines with every mistake fixed. Use when the user types /linkedin-panel followed by their profile text (or a file path), optionally with the job they want.
---

# /linkedin-panel

Created by Louiscreates.ai

The user gives you their LinkedIn profile after `/linkedin-panel`. You run seven independent reviewers against it, merge their findings, then rewrite the profile with every mistake fixed. Never flatter the profile.

## 0. Ground rules

- Use only what is in the profile and what the user told you. Never invent employers, titles, dates, numbers, skills, tools, awards or recommendations. When you assume something, label it "assumed".
- Every judgment must quote the line it is about, or say "missing" when the problem is something that is not there.
- Do not claim facts about how LinkedIn ranks or shows profiles. Judge what a human reader sees and what a recruiter would type into a search box, nothing more.
- Answer in the language of the profile (the user's own words to you may be in another language: reply to them in that one).
- Do not copy phone numbers, emails or home addresses into any file except PROFILE-IMPROVED.md.

## 1. Get the profile and the goal

Everything after `/linkedin-panel` is the profile: pasted text (headline, About, experience, skills, anything else they have) or a file path (read it, a PDF saved from LinkedIn is fine). If the user also tells you the job or field they want, use it. Also note any context they add (career change, first job, country).

If the text is missing the headline or the About section, say so: it is the first finding.

If there is no goal at all, ask ONE question first: what job do you want next? Then continue.

## 2. Launch all seven reviewers at once

Start seven sub-agents in ONE message (seven parallel calls). Give each ONLY the profile, the goal (if any), the user's context (if any) and its own role below. Never pass one reviewer's output to another: independence is the point. Every reviewer answers in under 150 words and ends with its single worst quoted line.

1. **The stranger.** Knows nothing about this person's field. Reads only the headline and the first lines of the About section. Answers in ONE sentence what this person does and who they help. If a stranger cannot say it, answers LOST and says what got in the way.
2. **The recruiter.** Has a role to fill and little time. Looks at the headline, the current title and whether the words someone would type into a search box for the target role show up naturally in the profile. Answers MESSAGE, SAVE or SKIP and names the missing words.
3. **The hiring manager.** Decides who gets a message and then an interview. Answers MESSAGE, SAVE or SKIP, what decided it quickly, the one question they would ask, and the three weakest lines (quoted).
4. **The person with the dream job.** A senior person who already holds the target role. Checks whether the claims sound believable and specific for that role: scope, tools, results. Answers HIRE, MAYBE or PASS and names the claim that sounds most inflated or vague.
5. **The rival.** Is going for the same role and reads as a competitor: where is this profile weaker than theirs? Answers HIRE, MAYBE or PASS.
6. **The skeptic.** Hunts empty words ("passionate", "results-driven", "team player", "guru") and claims with no proof. Quotes every one and says what a real line would need instead.
7. **The referrer.** Someone with a good network who is asked "do you know anyone for this?". Would they put their own name behind this person? Answers YES, NOT YET or NO and says what proof is missing (links, results, work to show, who vouches for them).

## 3. What is wrong

Merge all seven answers into ONE numbered list of mistakes, worst first. Merge duplicates. For each mistake give: severity (Blocker = could make a reader skip the profile alone, Major = costs real points, Minor = polish), the quoted line, why it loses the reader, and which of the seven flagged it (for example "flagged by 5 of 7"). A mistake flagged by several different reviewers outranks one flagged by a single reviewer.

## 4. Rewrite it

Write the improved profile with the same facts and every numbered mistake fixed:

- **Headline:** three options. Each says the role or the result for someone, in plain words, with the most searchable role words early. No buzzwords, no emojis unless the user already uses them.
- **About:** the first lines say what the user does and for whom, then the proof, then one plain line on what they want next. Short paragraphs, first person, no empty words.
- **Experience:** for each role, bullets that lead with the result: action, scope, result. Replace duties with outcomes.
- **Skills:** the order that matches the goal. Add a skill ONLY when the profile or the user's words already show they have it.
- Where a fix needs a fact you do not have (a number, a tool, a team size, a link), leave `[ADD: what you need]` and collect those questions at the end. Never guess a number.

Then start a fresh "stranger" sub-agent on the new headline and About. Do NOT tell it what changed or what the old verdict was. Report before and after. If it still says LOST, fix what it names and run it once more, then stop.

## 5. Write the result

Pick today's date with `date +%F`. Create `.linkedin-panel/<date>-<name>/` (add `-2`, `-3` if it already exists, and never overwrite) with:

- `PANEL.md`: the seven verdicts, the numbered mistakes with severities, and a short table mapping each mistake to the change that fixed it.
- `PROFILE-IMPROVED.md`: the three headlines, the new About, the new experience lines and the skills order, with the `[ADD: ...]` questions listed at the end.

Then show the user, in chat: one line per reviewer, the five worst mistakes, the before and after verdict of the stranger test, the `[ADD: ...]` questions, and where the files are. Touch no other files.

## Rules

- Be honest. If the profile is strong, say so, and say which reviewer came closest to skipping it and why it still held. Do not invent problems to fill a list.
- Do not invent facts about the user, their employers or real companies. Say "assumed" when you guess.
- This is a structured second opinion made by language models. It does not guarantee a message, an interview or a job, and it is not career advice.
