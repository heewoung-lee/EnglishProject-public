---
title: Question Pack Repeat Scheduling And Cache Revisions
date: 2026-06-09
last_updated: 2026-06-18
category: best-practices
module: English learning question selection
problem_type: best_practice
component: service_object
severity: medium
applies_when:
  - "Changing practice question selection or learner repeat scheduling"
  - "Publishing larger Firebase-hosted question packs"
  - "Publishing Firebase-hosted conversation scenario packs"
  - "Updating bundled question packs while apps may already hold cached packs"
  - "Changing promotion exam composition or visible duplicate prevention"
tags: [question-packs, conversation-scenarios, repeat-scheduling, firebase-hosting, async-storage, visible-duplicates, promotion-exams, tests]
---

# Question Pack Repeat Scheduling And Cache Revisions

## Context
The practice flow should avoid showing the same correctly answered question again while enough fresh questions remain. Repetition is useful mainly when the learner missed a question, or when the level's available question pool is temporarily too small.

The first selector only excluded recently seen question IDs for a short window. A correctly answered question could fall outside that window and be treated like a fresh question even though recent answer outcomes still knew it was correct.

## Guidance
Keep answer outcome tracking separate from simple recency. A question should be considered fresh only when it is outside both the recent question-id window and the recent answer-outcome map.

The useful bucket order is:

1. Fresh questions.
2. Recently incorrect questions.
3. Neutral older questions.
4. Recently correct questions.

This lets the app repeat missed material when needed without wasting practice slots on already-correct answers.

When publishing larger remote packs, also revise cache compatibility. If an installed app has an older cached pack, that cache can shadow the improved bundled pack on launch. Bump the question-pack storage key or compare cache metadata against a bundled pack revision so old caches do not hide newly bundled questions.

Remote pack validation should enforce the product invariants, not just basic JSON shape. If the app expects writing-heavy practice, reject hosted packs that have enough total questions but too few writing questions.

Use one visible-duplicate definition across validators and selectors. For learner-facing dedupe, the key should be based on `level`, `area`, `kind`, `promptKo`, and `questionText`. Do not include choice text in that key unless the validator also does, because otherwise a pack can pass validation while runtime selection still treats the same visible prompt as distinct.

When changing promotion exams from choice-only to a representative blueprint, update the whole path together: selector, validation rules, exam screen input UI, submission/evaluation pipeline, and result explanation rendering. A selector that emits writing tasks is not complete until the promotion screen can collect a writing answer and the promotion result can show the learner's answer, corrected answer, writing score, rubric, and reasons.

Publish hosted content changes as a new pack version instead of editing an existing version in place. Update the generator source first, regenerate `generatedExtraQuestions.ts`, write new `*.vN.json` files, and update `manifest.json`. This avoids cached clients and future generator runs drifting away from the intended content.

Use the same shape for conversation scenarios: publish a Hosting manifest, versioned per-level JSON packs, strict path/shape validation, AsyncStorage caching, and bundled fallback. A cached scenario pack should replace the bundled scenarios for a level only when it has at least the bundled count, so a partial remote pack cannot shrink practice variety.

## Why This Matters
Question variety is part of the learning loop. If correct answers repeat too soon, the learner sees the app as memorization rather than level-appropriate practice. If stale caches survive after a pack expansion, installing a new APK may still show the old small pool.

Tests need to cover all three layers: selector order, bundled bank size, and hosted-pack validity. Otherwise a fix in one layer can be hidden by stale data in another.

For promotion changes, add tests for representative coverage and mixed question kinds. At minimum, assert that promotion exams include writing when available, cover reading/conversation/grammar, avoid visible duplicates under the same key as the validator, and that completion paths persist learner proficiency stats.

## When to Apply
- When changing `selectPracticeQuestions`.
- When increasing `questionBank` or hosted Firebase packs.
- When moving conversation scenarios into Firebase Hosting.
- When changing minimum question counts, writing counts, or pack manifest versions.
- When an APK update should force users off an old cached question pack.
- When changing promotion exam rules, especially if writing questions become eligible.
- When editing generated question artifacts or hosted pack JSON.

## Examples
Fresh-first selection test:

```ts
expect(questions.map((question) => question.id)).toEqual([
  'a1-fresh-writing-001',
  'a1-fresh-reading-001',
  'a1-fresh-conversation-001',
]);
```

Hosted pack invariants:

```ts
expect(pack.questions).toHaveLength(18);
expect(pack.questions.filter((question) => question.kind === 'writing')).toHaveLength(4);
```

Visible duplicate key:

```ts
const key = [
  question.level,
  question.area,
  question.kind,
  normalize(question.promptKo),
  normalize(question.questionText),
].join('::');
```

Promotion blueprint:

```ts
expect(questions.some((question) => question.kind === 'writing')).toBe(true);
expect(new Set(questions.map((question) => question.area))).toEqual(
  new Set(['reading', 'conversation', 'grammar']),
);
```

Cache revision:

```ts
export const QUESTION_PACK_STORAGE_KEY = 'englishProject.questionPacks.v2';
```

## Related
- app/src/services/questionSelector.ts
- app/src/services/questionPackValidation.ts
- app/scripts/validate-content.mjs
- app/scripts/expand-question-content.mjs
- app/src/services/questionPackService.ts
- app/src/services/questionPackValidation.ts
- app/src/services/conversationScenarioService.ts
- app/src/services/conversationScenarioValidation.ts
- app/src/data/questionBank.ts
- app/src/data/scenarios.ts
- public/question-packs/manifest.json
- public/conversation-scenarios/manifest.json
