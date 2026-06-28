# Learning Trust Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve learner trust by making promotion exams represent real skill, preventing visible duplicate content from shipping, and storing local proficiency signals for future adaptive practice.

**Architecture:** Keep the current simple session loop. Add the smallest durable data needed for adaptation, and keep question packs remote-compatible. Promotion exams should use a blueprint instead of first-five choice slicing.

**Tech Stack:** Expo React Native, TypeScript, Vitest, Node content validation, local AsyncStorage state.

---

### Task 1: Reject Visible Duplicate Questions In Content Packs

**Files:**
- Modify: `app/scripts/validate-content.mjs`
- Modify: `public/question-packs/packs/a1.v5.json`
- Modify: `public/question-packs/packs/a2.v5.json`
- Modify: `public/question-packs/packs/b1.v5.json`
- Test: `npm.cmd run content:validate`

- [ ] **Step 1: Add a visible-key validator**

Add a normalized key from `level`, `area`, `kind`, `promptKo`, and `questionText`. Choice answer text is intentionally not part of the key because the learner sees the same task even when choices differ.

- [ ] **Step 2: Run validation and confirm it fails**

Run: `npm.cmd run content:validate`
Expected: FAIL listing duplicate visible question groups in A1, A2, and B1.

- [ ] **Step 3: Rewrite only the duplicate prompts/questions**

Keep IDs stable. Change duplicate prompts or source text so each question is a genuinely different task.

- [ ] **Step 4: Verify validation passes**

Run: `npm.cmd run content:validate`
Expected: PASS, 320 questions and 32 scenarios.

### Task 2: Promotion Exam Blueprint

**Files:**
- Modify: `app/src/services/questionSelector.ts`
- Modify: `app/src/services/questionSelector.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that promotion exams prefer the next level and include a representative mix:
- at least one reading question
- at least one conversation question
- at least one grammar question
- at least one writing question when available
- no visible duplicate task

- [ ] **Step 2: Run selector tests and confirm failure**

Run: `npm.cmd test -- questionSelector.test.ts --run`
Expected: FAIL because current promotion exams are choice-only.

- [ ] **Step 3: Implement blueprint selection**

Use next-level questions first. Pick one question per required area/kind bucket, then fill remaining slots from next-level unused questions and current-level fallback questions.

- [ ] **Step 4: Verify selector tests pass**

Run: `npm.cmd test -- questionSelector.test.ts --run`
Expected: PASS.

### Task 3: Local Proficiency Signals

**Files:**
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/services/learningStorage.ts`
- Modify: `app/src/services/sessionService.ts`
- Modify: `app/App.tsx`
- Test: `app/src/services/learningStorage.test.ts`
- Test: `app/src/services/sessionService.test.ts`

- [ ] **Step 1: Add failing storage normalization tests**

Test that missing proficiency state defaults to empty maps, malformed entries are dropped, and reset clears the maps.

- [ ] **Step 2: Add failing update tests**

Test that completed practice updates area and skill stats with attempts, correct count, last score, and last practiced timestamp.

- [ ] **Step 3: Implement minimal state shape**

Add `areaStats` and `skillStats` to `LocalLearningState`. Do not add a large persisted queue yet; recent question history already prevents immediate repetition.

- [ ] **Step 4: Use stats without disrupting the current selector**

For this phase, persist stats and leave adaptive selection behavior to the next commit. This avoids mixing state migration with ranking logic.

### Task 4: Verification, Review, APK

**Files:**
- No new source files expected.

- [ ] **Step 1: Run full verification**

Run:
- `npm.cmd test -- --run`
- `npm.cmd run typecheck`
- `npm.cmd run content:validate`

- [ ] **Step 2: Run subagent review**

Ask one reviewer for spec compliance and one reviewer for code quality. Fix blocking findings.

- [ ] **Step 3: Commit**

Commit message: `feat: improve learning trust signals`

- [ ] **Step 4: Build local release APK**

Run: `npm.cmd run build:android:release`
Expected APK:
`C:\Users\woung\Desktop\이력서\app-release.apk`
