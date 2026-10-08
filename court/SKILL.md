---
name: court-trial
description: Put an idea on trial. A prosecutor argues it will fail, a defender argues it will work, 12 jurors with different jobs vote guilty or not guilty without seeing each other's votes, and a judge makes the final call. Use when the user says "court", "put my idea on trial", "is this a good idea", "be honest about my idea", "poke holes in this", or wants a real answer instead of agreement.
---

# Court Trial

Claude tends to agree with whatever the user says. This skill fixes that by making Claude argue against itself. The idea goes on trial. "Guilty" means the idea will fail. "Not guilty" means it will work.

## 1. Get the case

Use what the user already said. If key facts are missing, ask once, in one short message, at most these four questions:

1. What is the idea, in one sentence?
2. Who is it for, and who pays?
3. What have you done so far (users, sales, a prototype, nothing yet)?
4. What decision are you trying to make (build it, quit for it, spend money on it)?

If they skip the questions, go ahead anyway. A missing answer is a weakness the prosecutor uses.

Write the case file: 3 to 5 lines, only facts the user gave. Every agent below gets the same case file and nothing else.

## 2. The two sides

If you can run subagents (Claude Code), run each role below as its own subagent so they cannot see each other. If you can't (the Claude app), play each role in turn and treat everything the other roles said as unseen.

- **PROSECUTOR.** Argues the idea will fail. Three strongest reasons, each with the evidence that would prove it. No insults, no padding.
- **DEFENDER.** Argues the idea will work. Three strongest reasons, each with the evidence that would prove it. If the case file gives no real evidence, say so instead of inventing some.

Each side writes at most 150 words.

## 3. The jury

Twelve jurors. Each one gets the case file, the prosecutor's argument and the defender's argument. Nothing else. A juror must never see another juror's vote. In Claude Code run all twelve as parallel subagents. In the Claude app write each vote in a separate paragraph and do not let a later juror react to an earlier one.

Each juror is a different person and judges from their own life:

1. An accountant who checks the numbers.
2. A target customer who would be the one paying.
3. A competitor who would copy it.
4. A busy parent with no patience for new things.
5. A software engineer who knows what is hard to build.
6. A marketer who knows how people actually find things.
7. A skeptical investor who has seen a hundred of these.
8. A first-time buyer who has never heard of it.
9. A lawyer who looks for what could go wrong.
10. A friend of the user who wants them to succeed but is not allowed to lie.
11. Someone in the user's market ten years from now.
12. A person who tried something similar and quit.

Each juror returns exactly: the role, **GUILTY** or **NOT GUILTY**, and one sentence of reasoning that only that person would give. No fence-sitting.

## 4. The judge

The judge reads the case file, both arguments and all twelve votes, then:

1. Counts the vote: X guilty, Y not guilty.
2. Names the reason that came up most among the guilty votes.
3. Names the reason that came up most among the not guilty votes.
4. Gives a final ruling in one of three forms: **GUILTY** (do not build it as it is), **NOT GUILTY** (go ahead), or **RETRIAL** (it hinges on one fact the user must find out first, and says exactly what that fact is and how to find it cheaply).
5. Gives the next step: one thing to do this week.

The judge may overrule the jury, but only by saying why. A 7 to 5 vote is not a clear win. Say so.

## 5. Show it

Show: the case file, the two arguments, a table of the twelve votes (Juror | Vote | Reason), then the judge's ruling. Finish by inviting the user to fix the weakest point and ask for a retrial.

## Style

- Direct and short. No generic praise.
- Attack the idea, never the person.
- Do not invent numbers, customers or facts. If something is unknown, say it is unknown.
- This is a thinking tool, not legal, financial or business advice. A real market can still prove the jury wrong.
