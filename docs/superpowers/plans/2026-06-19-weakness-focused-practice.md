# Weakness-Focused Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make practice sessions train the learner's weak points with a 2 weak / 1 balance question mix.

**Architecture:** Reuse local learner state. Add small weakness-priority helpers inside the question selector boundary, then pass local proficiency stats from `createPracticeSession` into `selectPracticeQuestions`.

**Tech Stack:** Expo React Native, TypeScript, Vitest.

---

### Task 1: Prove Skill Stats Can Drive Weakness Selection

**Files:**
- Modify: `app/src/services/questionSelector.test.ts`

- [x] Add a test where `skillStats.articles` is weak and no recent weak results exist.
- [x] Use injected A1 questions with two `articles` tagged questions and one balance question.
- [x] Assert the selected set contains two article questions and one balance question.
- [x] Run `npm.cmd test -- questionSelector.test.ts --run` and verify the test fails before implementation.

### Task 2: Add Weakness Mix Selection

**Files:**
- Modify: `app/src/services/questionSelector.ts`
- Modify: `app/src/services/sessionService.ts`

- [x] Add optional `questionStats` and `skillStats` selection context to `selectPracticeQuestions`.
- [x] Merge recent weak areas/tags with proficiency-derived weak areas/tags.
- [x] Add a 3-question practice mix rule: 2 weak-matching questions, then 1 balance/fresh question.
- [x] Pass local state stats from `createPracticeSession`.
- [x] Run `npm.cmd test -- questionSelector.test.ts --run` and verify the new test passes.

### Task 3: Protect Existing Behavior

**Files:**
- Modify: `app/src/services/questionSelector.test.ts`
- Modify: `app/src/services/sessionService.test.ts`

- [x] Add a test proving `createPracticeSession` passes local skill stats into selection.
- [x] Keep existing fresh-question, duplicate, incorrect-repeat, and promotion tests passing.
- [x] Run `npm.cmd test`.

### Task 4: Verify And Ship

**Files:**
- No additional source files expected.

- [x] Run `npm.cmd test`.
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npm.cmd run content:validate`.
- [ ] Commit the implementation.
- [ ] Build local release APK with `npm.cmd run build:android:release`.
