---
title: Conversation Bugs Require Corpus-Wide Sweeps
date: 2026-06-22
category: best-practices
module: conversation-practice
problem_type: best_practice
component: service_object
severity: medium
applies_when:
  - A reported conversation issue involves an incorrect response, repeated prompt, false rejection, false acceptance, slot mismatch, or bad feedback wording
  - A single scenario screenshot reveals a rule-like problem that may affect other conversation scenarios
tags: [conversation, scenarios, regression, qa, corpus-sweep]
---

# Conversation Bugs Require Corpus-Wide Sweeps

## Context

Conversation practice bugs often appear through one visible scenario, but the root cause is usually shared by many scenarios. Examples include repeated repair prompts, accepting or rejecting the wrong answer, bad Korean feedback text, completion state mistakes, and slot matching that is too strict or too vague.

Fixing only the screenshot scenario creates the same failure again in the next airport, hotel, pharmacy, cafe, restaurant, or appointment scenario.

## Guidance

When a user reports a conversation-practice issue, treat the screenshot as the first failing sample, not the full scope. Search the whole conversation corpus and the shared engine before patching.

Always inspect these areas:

```text
app/src/data/scenarios.ts
public/conversation-scenarios/manifest.json
public/conversation-scenarios/packs/*.json
app/src/services/conversationEngine.ts
app/src/services/conversationSlotMatcher.ts
app/src/services/conversationScenarioService.ts
app/src/services/conversationResultFeedback.ts
server/conversationEngine.mjs
test-fixtures/conversation-engine-v2.json
app/src/services/conversationEngine.test.ts
app/src/services/hostedConversationScenarios.test.ts
server/index.test.mjs
```

Use the reported phrase, Korean prompt, slot name, scenario title, feedback sentence, and engine reply as search seeds:

```powershell
rg -n "reported phrase|slot name|Korean prompt|engine reply" app/src/data app/src/services public/conversation-scenarios server test-fixtures
```

Classify the issue before editing:

- Slot-matching issue: user gave a valid answer but the engine rejected it, or accepted an unrelated answer.
- Actor-reply issue: the assistant response repeats, contradicts the situation, leaks answer guidance, or fails to move the conversation forward.
- Repair/clarification issue: the retry prompt is unnatural, loops, or asks for irrelevant content.
- Completion issue: the scenario should end but keeps asking, or ends before required goals are met.
- Feedback issue: the Korean explanation, weakness, or correction does not match the user's actual answer.

Prefer fixing the shared engine or matcher when the failure is rule-like. Patch scenario JSON only when the scenario data itself is wrong.

## Why This Matters

Conversation practice is user-trust sensitive. If one scenario repeatedly rejects correct answers, users assume the entire speaking feature is unreliable. A corpus-wide sweep prevents the same bug from resurfacing in another scenario after the user tests for a few minutes.

It also keeps the product goal intact: conversation should tolerate natural variations, handle unexpected answers without infinite loops, and produce feedback based on what the user actually said.

## When to Apply

- A conversation answer is marked wrong even though it is acceptable in context.
- The engine repeats the same question or repair prompt.
- The assistant asks something unrelated to the current scenario.
- The final conversation score or feedback does not cite the user's actual utterances.
- A fix touches roleplay state, slot matching, retry policy, scenario completion, or result feedback.

## Examples

Bad workflow:

```text
1. Find the one hotel scenario from the screenshot.
2. Add that exact user phrase to an accepted list.
3. Stop.
```

Better workflow:

```text
1. Identify the failure category: slot matching, actor reply, retry, completion, or feedback.
2. Search all bundled and hosted scenarios for the same slot, wording, or repair pattern.
3. Fix the shared rule in the engine/matcher when possible.
4. Patch scenario data only where the data is genuinely wrong.
5. Add regression tests that cover the original scenario and at least one different scenario with the same pattern.
6. Run the focused tests before claiming the conversation bug is fixed.
```

Focused verification commands:

```powershell
npm.cmd test -- conversationEngine.test.ts hostedConversationScenarios.test.ts
npm.cmd test -- conversationSlotMatcher.test.ts
npm.cmd test -- index.test.mjs
```

## Related

- [Writing Evaluator Fallback Context Gates](writing-evaluator-fallback-context-gates.md)
- [Question Pack Repeat Scheduling And Cache Revisions](question-pack-repeat-scheduling-and-cache-revisions.md)
