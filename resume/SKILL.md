---
name: hiring-panel
description: Run a resume past a hiring panel of seven Claudes that try to reject it (an automated screen, a hiring manager, a domain expert and four more readers who each judge it alone), then rebuild it with every mistake fixed. Use when the user types /hiring-panel followed by a resume (a file path or pasted text), optionally with a job posting.
---

# /hiring-panel

Created by Louiscreates.ai

The user gives you a resume after `/hiring-panel`. You run seven independent reviewers against it, merge their findings, then rebuild the resume with every mistake fixed. Never flatter the resume.

## 0. Ground rules

- Use only what is in the resume and what the user told you. Never invent employers, titles, dates, numbers, skills or tools. When you assume something, label it "assumed".
- Every judgment must quote the line it is about, or say "missing" when the problem is something that is not there.
- Answer in the language of the resume (the user's own words to you may be in another language: reply to them in that one).
- Do not copy phone numbers, emails or home addresses into any file except RESUME-IMPROVED.md.

## 1. Get the resume and the job

Everything after `/hiring-panel` is the resume: a file path (read it; PDF is fine) or pasted text. If the user also gives a job posting or a target role, use it. Also note any context they add (career change, first job, country).

If you cannot extract readable text from the file (a scan, or text inside images), say so: that is itself the first finding, because an automated screen would fail the same way.

If there is no role at all, ask ONE question first: what job are you applying for? Then continue.

## 2. Launch all seven reviewers at once

Start seven sub-agents in ONE message (seven parallel calls). Give each ONLY the resume, the job (if any), the user's context (if any) and its own role below. Never pass one reviewer's output to another: independence is the point. Every reviewer answers in under 150 words and ends with its single worst quoted line.

1. **Automated screen.** The system that decides whether a human should even see this resume. Checks, in order: can the text be read top to bottom (columns, tables, text in images, odd section names)? Are titles, employers and dates clear? With a job posting: which of its key skills and terms appear in the resume and which are missing? Contact details present, length sensible, no filler. Answers PASS or REJECT, then at most five reasons, each quoting its line.
2. **Hiring manager.** Decides who gets an interview. Answers INTERVIEW or NO, what decided it in the first ten seconds, the one question they would ask in the interview, and the three weakest lines (quoted).
3. **Domain expert.** A senior person in the field who has seen many inflated resumes. Checks whether the claims are believable and specific: scope, tools, team size, results. Answers HIRE, MAYBE or PASS and names the claim that sounds most inflated or vague.
4. **Another applicant.** Applied for the same job and reads as a rival: where is this resume weaker than theirs? Answers HIRE, MAYBE or PASS.
5. **The CEO.** Reads for impact: what did this person change, and by how much? Answers HIRE, MAYBE or PASS.
6. **The recruiter.** Has 30 seconds and 100 resumes today. Reads the top third only. Answers HIRE, MAYBE or PASS and says exactly where interest was lost.
7. **The teammate.** Would sit next to this person. Reads for how they work with others, what was done alone and what was done with a team. Answers HIRE, MAYBE or PASS.

## 3. What is wrong

Merge all seven answers into ONE numbered list of mistakes, worst first. Merge duplicates. For each mistake give: severity (Blocker = could cause rejection alone, Major = costs real points, Minor = polish), the quoted line, why it gets rejected, and which of the seven flagged it (for example "flagged by 5 of 7"). A mistake flagged by several different reviewers outranks one flagged by a single reviewer.

## 4. Rebuild it

Write the improved resume with the same facts and every numbered mistake fixed:

- Put results first on every bullet: action, scope, result. Replace duties with outcomes.
- Put the target job title and the strongest proof in the top third. Remove objective statements that push them down.
- Use one plain-text layout that reads top to bottom: no columns, tables or text in images.
- Add a job-posting term ONLY when the resume or the user's words already show the user has that skill. Never keyword-stuff, never add a skill to match the posting.
- Where a fix needs a fact you do not have (a number, a tool, a team size), leave `[ADD: what you need]` and collect those questions at the end. Never guess a number.

Then start a fresh automated-screen sub-agent on the new version. Do NOT tell it what changed or what the old verdict was. Report before and after. If it still says REJECT, fix what it names and run it once more, then stop.

## 5. Write the result

Pick today's date with `date +%F`. Create `.hiring-panel/<date>-<name>/` (add `-2`, `-3` if it already exists; never overwrite) with:

- `PANEL.md`: the seven verdicts, the numbered mistakes with severities, and a short table mapping each mistake to the change that fixed it.
- `RESUME-IMPROVED.md`: the new resume, with the `[ADD: ...]` questions listed at the end.

Then show the user, in chat: one line per reviewer, the five worst mistakes, the before and after screen verdict, the `[ADD: ...]` questions, and where the files are. Touch no other files.

## Rules

- Be honest. If the resume is strong, say so, and say which reviewer came closest to rejecting it and why it still held. Do not invent problems to fill a list.
- Do not invent facts about the user, their employers or real companies. Say "assumed" when you guess.
- This is a structured second opinion made by language models. It does not guarantee an interview or a job, and it is not career or legal advice.
