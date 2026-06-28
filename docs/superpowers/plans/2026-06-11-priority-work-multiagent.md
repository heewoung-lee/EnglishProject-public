# Priority Work Multiagent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-risk product gaps in priority order: B1/B2 conversation coverage first, then AI fallback transparency, then content/QA hardening.

**Architecture:** The app already loads remote question packs and conversation scenario packs from Firebase Hosting. P1 adds missing B1/B2 conversation packs and expands hosted-pack tests so the activity selector can offer conversation practice at every learner level.

**Tech Stack:** Expo React Native, Vitest, Firebase Hosting JSON packs, Firebase Functions/OpenAI API.

---

## Priority 1: B1/B2 Conversation Scenario Coverage

### Task 1A: B1 Scenario Pack

**Owner:** Worker B1  
**Files:**
- Create: `public/conversation-scenarios/packs/b1.v1.json`

- [ ] Create a UTF-8 JSON level pack with `schemaVersion: 1`, `level: "B1"`, `version: 1`, `publishedAt: "2026-06-11T00:00:00.000Z"`.
- [ ] Add 8 practical intermediate B1 scenarios.
- [ ] Each scenario must include specific `requiredSlots` with non-generic `matchKeywords`.
- [ ] Validate JSON parses and conforms to `isValidLevelConversationScenarioPack`.

### Task 1B: B2 Scenario Pack

**Owner:** Worker B2  
**Files:**
- Create: `public/conversation-scenarios/packs/b2.v1.json`

- [ ] Create a UTF-8 JSON level pack with `schemaVersion: 1`, `level: "B2"`, `version: 1`, `publishedAt: "2026-06-11T00:00:00.000Z"`.
- [ ] Add 8 practical advanced B2 scenarios.
- [ ] Each scenario must include specific `requiredSlots` with non-generic `matchKeywords`.
- [ ] Validate JSON parses and conforms to `isValidLevelConversationScenarioPack`.

### Task 1C: Manifest And Hosted Tests

**Owner:** Manager  
**Files:**
- Modify: `public/conversation-scenarios/manifest.json`
- Modify: `app/src/services/hostedConversationScenarios.test.ts`

- [ ] Add B1 and B2 manifest entries pointing to the new packs.
- [ ] Update expected manifest tests to include A1/A2/B1/B2.
- [ ] Add tests proving B1 and B2 packs are valid, include 8 scenarios each, and can complete at least one representative scenario through the fallback conversation engine.

### Task 1D: Review Gate

**Owner:** Manager + Reviewer Agents

- [ ] Spec review: confirm all levels A1/A2/B1/B2 have hosted scenario packs.
- [ ] Content review: confirm IDs are unique, Korean fields are real Korean, slot keywords are not overly generic, and scenarios are level-appropriate.
- [ ] Code quality review: confirm no unrelated files changed and no manifest/test drift.

### Task 1E: Verification And Release

**Owner:** Manager

- [ ] Run `npm.cmd test -- hostedConversationScenarios.test.ts`.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run typecheck`.
- [ ] Run `npm.cmd run build:android:release`.
- [ ] Confirm APK copied to `C:\Users\woung\Desktop\이력서\app-release.apk`.
- [ ] Commit with a focused message.

---

## Priority 2: AI Fallback Transparency

### Task 2A: Evaluation Source Model

**Files:**
- Modify: `app/src/types/conversation.ts`
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/services/evaluationService.ts`
- Modify: `app/src/services/writingEvaluationService.ts`

- [ ] Return metadata that distinguishes `ai` from `localFallback`.
- [ ] Preserve current fallback behavior but expose it to screens.

### Task 2B: UI Copy

**Files:**
- Modify: result screens and/or grading modal.

- [ ] Show clear Korean copy when fallback grading was used.
- [ ] Avoid implying AI reviewed the answer when the API failed.

---

## Priority 3: Content Pipeline Hardening

- [ ] Add JSON-pack lint checks for duplicate IDs, malformed Korean fields, empty choices, and generic slot keywords.
- [ ] Add a script to summarize per-level question/scenario counts before deployment.

## Priority 4: Mobile QA Guardrails

- [ ] Add a manual QA checklist for APK smoke testing.
- [ ] Add automated checks where practical for keyboard/scroll/result transitions.

## Priority 5: API Protection

- [ ] Add request size limits.
- [ ] Add rate limiting.
- [ ] Add Firebase App Check or anonymous auth before broader distribution.
