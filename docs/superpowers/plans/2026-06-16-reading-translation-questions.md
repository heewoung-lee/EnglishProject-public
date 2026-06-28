# Reading Translation Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add timed English-to-Korean reading translation questions for every learner level.

**Architecture:** Keep the existing `writing` question flow, but add metadata for Korean translation answers. The app, content validators, local fallback evaluator, and Firebase writing API all branch on `answerLanguage: 'ko'` while preserving existing English-writing behavior.

**Tech Stack:** React Native, TypeScript, Vitest, Node test runner, Firebase Hosting/Functions.

---

### Task 1: Translation Metadata And Validation

**Files:**
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/services/questionPackValidation.ts`
- Modify: `app/scripts/validate-content.mjs`
- Test: `app/src/data/questionBank.test.ts`
- Test: `app/src/services/questionPackValidation.test.ts`

- [ ] Write failing tests that require each level to have at least six `area: 'reading'`, `kind: 'writing'`, `answerLanguage: 'ko'` questions with `timeLimitSeconds` between 30 and 90 and difficulties `easy`, `medium`, and `hard`.
- [ ] Extend `WritingLearningQuestion` with optional `answerLanguage`, `timeLimitSeconds`, `readingDifficulty`, and `expectedKeywordsKo`.
- [ ] Extend runtime validators and content validation scripts to accept and validate the new metadata.
- [ ] Re-run focused tests.

### Task 2: Translation Evaluation

**Files:**
- Modify: `app/src/services/writingEvaluationService.ts`
- Modify: `server/index.mjs`
- Test: `app/src/services/writingEvaluationService.test.ts`
- Test: `server/index.test.mjs`

- [ ] Write failing tests showing a Korean translation answer can be correct and an English answer is rejected for translation questions.
- [ ] Update client local fallback to score Korean translation answers with `expectedKeywordsKo` and `sampleAnswer`.
- [ ] Update API payload and server normalization so Korean answers are not rejected by the English-token guard.
- [ ] Update the writing evaluator prompt to handle either English writing or Korean translation.

### Task 3: Timed Translation UI

**Files:**
- Modify: `app/src/screens/PracticeQuestionScreen.tsx`
- Create: `app/src/services/practiceQuestionPresentation.ts`
- Test: `app/src/services/practiceQuestionPresentation.test.ts`

- [ ] Add a tested helper for translation placeholder text and timer labels.
- [ ] Show a countdown for timed translation questions.
- [ ] Reset the timer when the question changes.
- [ ] Keep the submit footer keyboard-safe.

### Task 4: Question Content Packs

**Files:**
- Create: `app/src/data/readingTranslationQuestions.ts`
- Modify: `app/src/data/questionBank.ts`
- Create: `public/question-packs/packs/a1.v4.json`
- Create: `public/question-packs/packs/a2.v4.json`
- Create: `public/question-packs/packs/b1.v4.json`
- Create: `public/question-packs/packs/b2.v4.json`
- Modify: `public/question-packs/manifest.json`

- [ ] Add six timed translation questions per level, split across easy, medium, and hard difficulty.
- [ ] Keep bundled fallback and Firebase-hosted packs aligned.
- [ ] Update manifest versions and question counts.
- [ ] Run content validation.

### Task 5: Review, Deploy, APK, Commit

**Files:**
- All changed files.

- [ ] Run subagent spec review and code-quality review.
- [ ] Run `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run content:validate`, and server tests.
- [ ] Deploy Firebase Hosting question packs and Functions if server code changed.
- [ ] Build local release APK and copy it to `C:\Users\woung\Desktop\이력서\app-release.apk`.
- [ ] Commit all changes.
