---
title: Writing Evaluator Fallback Context Gates
date: 2026-06-08
category: best-practices
module: English learning writing evaluation
problem_type: best_practice
component: service_object
severity: medium
applies_when:
  - "Adding offline fallback scoring for LLM-graded writing answers"
  - "Balancing natural answer substitutions against obvious nonsense answers"
tags: [writing-evaluation, fallback-scoring, llm, tests]
---

# Writing Evaluator Fallback Context Gates

## Context
The writing practice flow uses the OpenAI-backed server evaluator first, but the client still needs a local fallback for development, API failure, or temporary network failure. The first fallback attempts either overfit to sample answers, rejecting natural substitutions, or became too broad and accepted unrelated content once the sentence structure matched.

## Guidance
Keep the fallback conservative and prompt-aware. Separate structural tokens from replaceable content, but award replacement credit only inside explicit contexts that understand the prompt.

Use this shape:

```ts
if (context === 'onlineClassOpinion') {
  const reasonTokens = getMeaningfulTokensAfterMarker(answerTokens, 'because');

  return reasonTokens.some((token) => ONLINE_CLASS_REASON_TOKENS.has(toSingularToken(token)));
}

if (context === 'flexibleWork') {
  const conditionTokens = getMeaningfulTokensAfterMarker(answerTokens, 'if');

  return conditionTokens.some((token) => FLEXIBLE_WORK_ACTOR_TOKENS.has(toSingularToken(token))) &&
    conditionTokens.some((token) => FLEXIBLE_WORK_CONDITION_TOKENS.has(toSingularToken(token)));
}

return false;
```

Avoid broad fallback rules like "any two meaningful replacement tokens are enough." That lets unrelated answers pass once they contain the expected structure:

```ts
// Too broad: accepts unrelated content such as "because pizza sushi."
return meaningfulReplacementTokens.length >= 2;
```

For near-exact answers, use a narrow bonus instead of opening the replacement path. The bonus should require full keyword coverage, high content overlap, sufficient length, and enough matched content tokens.

## Why This Matters
The fallback is not the authoritative grader. Its job is to keep the app usable when OpenAI is unavailable without teaching the app to trust nonsense. Prompt-aware gates preserve obvious natural variants such as different foods, weekend plans, or opinion wording while rejecting structurally similar but irrelevant text.

## When to Apply
- When an LLM-scored answer path needs a deterministic local fallback.
- When expected keywords contain a mix of grammar structure and sample-specific content.
- When a valid answer may replace sample details, such as a food, trip, plan, or opinion reason.
- When tests reveal a loop of fixing false negatives by creating new false positives.

## Examples
Good regression pairs:

```ts
expect(evaluateWritingAnswerLocally({
  question: onlineClassOpinionQuestion,
  answer: 'I think online classes are useful because they save time.',
}).isCorrect).toBe(true);

expect(evaluateWritingAnswerLocally({
  question: onlineClassOpinionQuestion,
  answer: 'I think online classes are good because pizza sushi.',
}).isCorrect).toBe(false);
```

Keep both sides of the pair. A positive-only test suite will push the fallback toward over-acceptance; a negative-only suite will push it back toward sample-answer overfitting.

## Related
- [React Native Storage Retry Guards](./react-native-storage-retry-guards.md)
