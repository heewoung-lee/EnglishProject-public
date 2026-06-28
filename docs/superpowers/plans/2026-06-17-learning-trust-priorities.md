# Learning Trust Priorities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve learner trust by making writing evaluation explainable, tracking finer weakness signals, and preventing conversation failure loops.

**Architecture:** Keep the current simple rate loop. Add optional rubric and skill-tag fields so old cached state and remote question packs remain compatible. Implement behavior behind typed services, then surface the evidence on existing result screens.

**Tech Stack:** Expo React Native, TypeScript, Vitest, local AsyncStorage, Firebase-hosted question/scenario packs.

---

### Task 1: Writing Rubric And Result Reasons

**Files:**
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/services/writingEvaluationService.ts`
- Modify: `app/src/services/sessionService.ts`
- Modify: `app/src/screens/PracticeResultScreen.tsx`
- Test: `app/src/services/writingEvaluationService.test.ts`
- Test: `app/src/services/sessionService.test.ts`
- Test: `app/src/screens/feedbackIntegration.source.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that expect every writing evaluation to include:
- rubric category scores: task completion, meaning, grammar, naturalness
- Korean score reasons
- skill tags for fine-grained weakness tracking

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm.cmd test -- writingEvaluationService.test.ts sessionService.test.ts feedbackIntegration.source.test.ts --run
```

Expected: tests fail because rubric fields are missing.

- [ ] **Step 3: Implement minimal code**

Add optional fields to `WritingEvaluationResult` and pass them into `QuestionExplanation`.
Generate local fallback rubric deterministically from score and correctness.
Normalize API responses so missing rubric data still gets safe defaults.

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm.cmd test -- writingEvaluationService.test.ts sessionService.test.ts feedbackIntegration.source.test.ts --run
```

- [ ] **Step 5: Commit**

Commit message:

```bash
feat: show writing rubric reasons
```

### Task 2: Fine-Grained Skill Weakness Storage And Scheduling

**Files:**
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/services/sessionService.ts`
- Modify: `app/src/services/learningStorage.ts`
- Modify: `app/src/services/questionSelector.ts`
- Test: `app/src/services/sessionService.test.ts`
- Test: `app/src/services/learningStorage.test.ts`
- Test: `app/src/services/questionSelector.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that expect missed writing answers to emit `weakSkillTags`, storage to preserve them, and selection to prioritize fresh questions with matching inferred tags.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm.cmd test -- sessionService.test.ts learningStorage.test.ts questionSelector.test.ts --run
```

- [ ] **Step 3: Implement minimal code**

Add optional `weakSkillTags` to recent practice results and practice session results.
Infer tags from question area, weak point label, evaluation focus, and writing evaluation tags.
Sort fresh questions by weak tag match before broad area match.

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm.cmd test -- sessionService.test.ts learningStorage.test.ts questionSelector.test.ts --run
```

- [ ] **Step 5: Commit**

Commit message:

```bash
feat: prioritize practice by weak skill tags
```

### Task 3: Conversation Failure End Rules

**Files:**
- Modify: `app/src/services/conversationEngine.ts`
- Modify: `app/src/services/conversationService.ts`
- Test: `app/src/services/conversationEngine.test.ts`
- Test: `app/src/services/conversationService.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for repeated unclear/off-topic/no-progress turns ending the session cleanly with `too_many_failures` or `no_progress`, without returning another normal prompt.

- [ ] **Step 2: Verify tests fail**

Run:

```powershell
npm.cmd test -- conversationEngine.test.ts conversationService.test.ts --run
```

- [ ] **Step 3: Implement minimal code**

Keep the LLM interpretation path, but make the deterministic engine authoritative for ending after repeated failures. When ending, return the terminal review message and set `shouldEndSession`.

- [ ] **Step 4: Verify tests pass**

Run:

```powershell
npm.cmd test -- conversationEngine.test.ts conversationService.test.ts --run
```

- [ ] **Step 5: Commit**

Commit message:

```bash
fix: end stalled conversations cleanly
```

### Task 4: Full Verification And APK

**Files:**
- No source files unless verification reveals a bug.

- [ ] **Step 1: Run full verification**

```powershell
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run content:validate
```

- [ ] **Step 2: Build local APK**

```powershell
npm.cmd run build:android:release
```

- [ ] **Step 3: Copy APK**

Expected output:

```text
C:\Users\woung\Desktop\이력서\app-release.apk
```
