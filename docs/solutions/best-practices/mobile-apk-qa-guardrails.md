---
title: Mobile APK QA needs source guardrails plus device checks
date: 2026-06-11
category: docs/solutions/best-practices
module: React Native mobile QA
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - "Fixing React Native keyboard, scroll, or footer regressions"
  - "Preparing a local Android APK for repeated device testing"
  - "Reviewing UI changes that can pass unit tests but fail on a phone"
tags: [react-native, android-apk, qa, keyboard, source-guardrails, review-learning]
---

# Mobile APK QA needs source guardrails plus device checks

## Context

The app repeatedly hit phone-only regressions: keyboard overlays hid submit controls, conversation screens did not stay scrolled to the newest message, and the promotion exam submit button lived inside the scrollable body. Manual testing caught the symptoms, but the same class of issue can return if the layout structure is changed later.

## Guidance

Pair manual APK smoke testing with small source guardrails for the layout contracts that matter on mobile:

- scrollable question/chat content should be separate from fixed submit or input controls
- writing and conversation screens should be wrapped by `KeyboardAvoidingView`
- scroll views that contain inputs should use `keyboardShouldPersistTaps="handled"`
- conversation screens should scroll to the latest message when content changes and when the keyboard opens
- final conversation evaluation should show a blocking evaluation modal

For local APK testing, keep one checklist that names the actual APK target path and the repeated device checks. In this project, the target APK is copied to `C:\Users\woung\Desktop\이력서\app-release.apk`.

## Why This Matters

React Native layout regressions often pass normal logic tests because the failure is structural: a footer moved inside a `ScrollView`, an input does not react to keyboard height, or a modal is missing during a network-bound evaluation. Source guardrails do not replace device QA, but they make the most important layout contracts hard to accidentally remove.

## When to Apply

- Use this pattern whenever a fix was discovered from a real Android screenshot.
- Add a checklist item when the user needs to repeat the same APK test on a phone.
- Add a source guardrail when the bug is caused by component structure rather than business logic.
- During review, verify that the guardrail checks the real screen body, not a fallback branch or a commented snippet.

## Examples

Useful source guardrail shape:

```ts
assertAfterLast(source, '</ScrollView>', 'style={styles.footer}');

const footerSource = source.slice(source.indexOf('style={styles.footer}'));
expect(footerSource).toMatch(/<Pressable[\s\S]*?style=\{\[\s*styles\.submitButton/);
```

This checks that the footer follows the last scrollable body and still contains the submit button.

## Related

- app/src/screens/mobileQaGuardrails.source.test.ts
- app/scripts/android-apk-qa-doc.test.ts
- docs/qa/android-apk-smoke-test.md
- app/src/screens/PromotionExamScreen.tsx
