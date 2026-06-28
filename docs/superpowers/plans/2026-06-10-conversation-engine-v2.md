# Conversation Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile keyword-led conversation flow with an LLM-interpreted, deterministic state-machine conversation engine that cannot repeat the same slot question indefinitely.

**Architecture:** The app and server each get a mirrored conversation engine because React Native Metro and Firebase Functions do not currently share a buildable package. Both engines are verified against the same JSON fixture file. The LLM only returns `TurnInterpretation`; reducer and response policy own progress, repetition, and ending decisions.

**Tech Stack:** React Native + TypeScript + Vitest in `app`, Firebase Functions Node ESM + `node:test` in `server`, Firebase Hosting/Functions deploy, local Gradle APK build.

---

## Source Spec

- `docs/superpowers/specs/2026-06-10-conversation-engine-v2-design.md`

## Pre-Implementation Gate

- [ ] Commit this reviewed implementation plan before Task 1 starts:

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add docs/superpowers/plans/2026-06-10-conversation-engine-v2.md
git commit -m "docs: plan conversation engine v2 implementation"
```

- [ ] Start implementation only after this plan commit exists. Each task below must end with its own commit so any regression can be reverted independently.
- [ ] Do not run parallel workers on overlapping files. Task 6 touches `app/App.tsx`, `server/index.mjs`, and `server/index.test.mjs`, so it starts only after Tasks 3 and 5 are committed.

## File Structure

- Create `test-fixtures/conversation-engine-v2.json`  
  Shared input/output cases consumed by both app and server tests.

- Modify `app/src/types/conversation.ts`  
  Add `ConversationEngineState`, `TurnInterpretation`, `ConversationEngineEndReason`, and engine fields on session/API response types.

- Create `app/src/services/conversationEngine.ts`  
  Pure TypeScript engine: bootstrap state, fallback interpretation, reducer, response policy, one-turn runner.

- Create `app/src/services/conversationEngine.test.ts`  
  App-side engine unit tests using the shared fixture and focused edge cases.

- Modify `app/src/services/conversationService.ts`  
  Pass `engineState` to the API, normalize API `engineState`, and use the pure engine for fallback.

- Modify `app/src/services/conversationSessionService.ts` and `app/src/services/conversationSessionService.test.ts`  
  Initialize new sessions with engine state.

- Modify `app/src/screens/ConversationScreen.tsx`  
  Keep session `engineState` and legacy `failureCount` synchronized after every turn.

- Modify `app/App.tsx`  
  Persist active conversation `engineState`, pass it to evaluation, and derive v2 failure count from state.

- Modify `app/src/services/evaluationService.ts` and tests  
  Include `engineState` and `endReason`; apply deterministic scoring caps in fallback evaluation.

- Create `server/conversationEngine.mjs`  
  Mirrored Node ESM engine using the same reducer priorities and response policy.

- Modify `server/index.mjs`  
  Replace actor-style LLM output with interpreter output; use server engine for final response.

- Modify `server/index.test.mjs`  
  Add server fixture tests and API normalization tests.

---

## Task 1: Add Engine Types and Shared Fixture

**Files:**
- Create: `test-fixtures/conversation-engine-v2.json`
- Modify: `app/src/types/conversation.ts`
- Test: `app/src/services/conversationEngine.test.ts`

- [ ] **Step 1: Create the shared fixture file**

Create `test-fixtures/conversation-engine-v2.json` with these cases:

```json
{
  "scenario": {
    "id": "a2-pharmacy-symptom-001",
    "level": "A2",
    "area": "conversation",
    "titleKo": "약국에서 약 요청하기",
    "titleEn": "Asking for Medicine at a Pharmacy",
    "situationKo": "약국에서 증상을 설명하고 약을 추천받아야 합니다.",
    "descriptionKo": "증상과 필요한 약 또는 복용 방법 질문을 연습합니다.",
    "aiRole": "Pharmacist",
    "userRole": "Customer",
    "userGoalKo": "증상을 말하고 필요한 약이나 복용 방법을 물어보세요.",
    "difficulty": "intermediate",
    "maxUserTurns": 5,
    "targetExpressions": [
      "I have ...",
      "Do you have any medicine for ...?",
      "How often should I take it?"
    ],
    "targetSkills": ["question_comprehension", "vocabulary_range", "task_completion"],
    "openingMessage": "Hello. How can I help you today?",
    "completionMessage": "Take this twice a day after meals.",
    "repairPolicy": {
      "unclear": "Sorry, could you say that again in English?",
      "offTopic": "Let us come back to the pharmacy. Tell me your symptom.",
      "correction": "No problem. Thanks for correcting that.",
      "koreanOnly": "Please try saying that in English."
    },
    "successCriteria": [
      "Describe a symptom.",
      "Ask for medicine or ask how to take it.",
      "Complete the pharmacy interaction."
    ],
    "requiredSlots": [
      {
        "key": "symptom",
        "label": "symptom",
        "prompt": "What symptoms do you have?",
        "matchKeywords": ["headache", "fever", "cough", "sore throat", "stomachache", "cold", "pain"]
      },
      {
        "key": "medicineQuestion",
        "label": "medicine or dosage question",
        "prompt": "Do you need medicine, or do you have a question about how to take it?",
        "matchKeywords": ["medicine", "medicine for", "any medicine", "do you have any medicine", "do you have medicine", "something for", "anything for", "recommend", "for stomachache", "for headache", "for fever", "how often", "how many", "take it", "twice", "once", "after meals", "before meals"]
      }
    ]
  },
  "cases": [
    {
      "name": "goal completion after symptom and medicine request",
      "turns": [
        { "userMessage": "I'm feeling stomachache.", "expectedEndReason": null, "expectedPendingSlotKey": "medicineQuestion" },
        { "userMessage": "Do you have any medicine for stomachache?", "expectedEndReason": "goal_completed", "expectedPendingSlotKey": null }
      ]
    },
    {
      "name": "off topic ends as too many failures",
      "turns": [
        { "userMessage": "I like soccer.", "expectedEndReason": null, "expectedPendingSlotKey": "symptom" },
        { "userMessage": "I went to school yesterday.", "expectedEndReason": null, "expectedPendingSlotKey": "symptom" },
        { "userMessage": "Banana is yellow.", "expectedEndReason": "too_many_failures", "expectedPendingSlotKey": "symptom" }
      ]
    },
    {
      "name": "on topic no progress ends as no progress",
      "turns": [
        { "userMessage": "I need help.", "expectedEndReason": null, "expectedPendingSlotKey": "symptom" },
        { "userMessage": "Can you help me?", "expectedEndReason": null, "expectedPendingSlotKey": "symptom" },
        { "userMessage": "Please help me.", "expectedEndReason": "no_progress", "expectedPendingSlotKey": "symptom" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Add conversation engine types**

Modify `app/src/types/conversation.ts`:

```ts
export type ConversationTurnType = 'progress' | 'no_progress' | 'off_topic' | 'unclear';

export type ConversationEngineEndReason =
  | 'goal_completed'
  | 'max_turns'
  | 'too_many_failures'
  | 'no_progress'
  | null;

export type ConversationEngineStatus = 'active' | 'completed' | 'ended';

export type TurnInterpretation = {
  isUnderstandable: boolean;
  isOnTopic: boolean;
  turnType: ConversationTurnType;
  filledSlotKeys: string[];
  correctedSentence: string | null;
  detectedIssueTags: SkillTag[];
  shortReasonKo: string | null;
  confidence: number;
};

export type ConversationEngineState = {
  filledSlotKeys: string[];
  pendingSlotKey: string | null;
  lastPromptKey: string | null;
  lastAssistantActionKey: string | null;
  lastTurnType: ConversationTurnType | null;
  repeatedPromptCount: number;
  noProgressCount: number;
  offTopicCount: number;
  unclearCount: number;
  userTurnCount: number;
  status: ConversationEngineStatus;
  endReason: ConversationEngineEndReason;
};
```

Then change:

```ts
export type ConversationSession = {
  id: string;
  mode: 'conversation';
  level: LearnerLevel;
  scenario: Scenario;
  messages: ConversationMessage[];
  failureCount: number;
  engineState?: ConversationEngineState;
};
```

And update `EndReason`:

```ts
export type EndReason = ConversationEngineEndReason;
```

And extend `ActorResponse` / `ActorApiResponse`:

```ts
export type ActorResponse = {
  message: ConversationMessage;
  userAnalysis: UserMessageAnalysis;
  communicationFailed: boolean;
  shouldEndSession: boolean;
  endReason: EndReason;
  engineState?: ConversationEngineState;
};

export type ActorApiResponse = {
  message: string;
  isUserUnderstandable: boolean;
  isUserRelevant: boolean;
  shouldEndSession: boolean;
  endReason: EndReason;
  detectedIssueTags: SkillTag[];
  correctedSentence: string | null;
  shortReasonKo: string | null;
  engineState?: ConversationEngineState;
};
```

- [ ] **Step 3: Write failing type/fixture smoke test**

Create `app/src/services/conversationEngine.test.ts`:

```ts
// @ts-expect-error This fixture test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { Scenario } from '../types/conversation';

const fixtureUrl = new URL('../../../test-fixtures/conversation-engine-v2.json', import.meta.url);

type EngineFixture = {
  scenario: Scenario;
  cases: {
    name: string;
    turns: {
      userMessage: string;
      expectedEndReason: string | null;
      expectedPendingSlotKey: string | null;
    }[];
  }[];
};

function readFixture(): EngineFixture {
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as EngineFixture;
}

describe('conversationEngine fixture', () => {
  it('loads the shared conversation fixture', () => {
    const fixture = readFixture();

    expect(fixture.scenario.id).toBe('a2-pharmacy-symptom-001');
    expect(fixture.cases).toHaveLength(3);
  });
});
```

- [ ] **Step 4: Run test and typecheck**

Run:

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test -- src/services/conversationEngine.test.ts
npm.cmd run typecheck
```

Expected:

- The fixture test passes.
- Typecheck passes because `engineState` is still a compatibility field in Task 1.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add test-fixtures/conversation-engine-v2.json app/src/types/conversation.ts app/src/services/conversationEngine.test.ts
git commit -m "feat: add conversation engine v2 types"
```

---

## Task 2: Implement App Pure Engine

**Files:**
- Create: `app/src/services/conversationEngine.ts`
- Modify: `app/src/services/conversationEngine.test.ts`
- Test: `app/src/services/conversationEngine.test.ts`

- [ ] **Step 1: Add failing reducer tests**

Extend `app/src/services/conversationEngine.test.ts`:

```ts
import {
  createInitialConversationEngineState,
  runConversationEngineTurn,
} from './conversationEngine';

describe('conversationEngine app reducer', () => {
  it.each(readFixture().cases)('matches shared fixture: $name', (fixtureCase) => {
    const fixture = readFixture();
    let state = createInitialConversationEngineState(fixture.scenario);

    for (const turn of fixtureCase.turns) {
      const result = runConversationEngineTurn({
        scenario: fixture.scenario,
        previousMessages: [],
        state,
        userMessage: turn.userMessage,
      });
      state = result.engineState;

      expect(result.engineState.endReason).toBe(turn.expectedEndReason);
      expect(result.engineState.pendingSlotKey).toBe(turn.expectedPendingSlotKey);
    }
  });

  it('does not repeat the same slot prompt when no progress continues', () => {
    const fixture = readFixture();
    let state = createInitialConversationEngineState(fixture.scenario);

    const first = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'I need help.',
    });
    state = first.engineState;

    const second = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [first.message],
      state,
      userMessage: 'Can you help me?',
    });

    expect(first.message.content).not.toBe(second.message.content);
    expect(second.engineState.repeatedPromptCount).toBe(2);
  });

  it('resets no-progress and repetition counters when progress is made', () => {
    const fixture = readFixture();
    let state = createInitialConversationEngineState(fixture.scenario);

    state = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'I need help.',
    }).engineState;

    const progress = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: "I'm feeling stomachache.",
    });

    expect(progress.engineState.filledSlotKeys).toContain('symptom');
    expect(progress.engineState.noProgressCount).toBe(0);
    expect(progress.engineState.repeatedPromptCount).toBe(0);
  });

  it('prioritizes too_many_failures when off-topic and no-progress limits overlap', () => {
    const fixture = readFixture();
    let state = createInitialConversationEngineState(fixture.scenario);

    for (const message of ['I like soccer.', 'I went to school yesterday.', 'Banana is yellow.']) {
      state = runConversationEngineTurn({
        scenario: fixture.scenario,
        previousMessages: [],
        state,
        userMessage: message,
      }).engineState;
    }

    expect(state.noProgressCount).toBe(3);
    expect(state.offTopicCount + state.unclearCount).toBe(3);
    expect(state.endReason).toBe('too_many_failures');
  });

  it('ends with max_turns when the turn limit arrives before failure limits', () => {
    const fixture = readFixture();
    const scenario = { ...fixture.scenario, maxUserTurns: 2 };
    let state = createInitialConversationEngineState(scenario);

    state = runConversationEngineTurn({
      scenario,
      previousMessages: [],
      state,
      userMessage: "I'm feeling stomachache.",
    }).engineState;
    state = runConversationEngineTurn({
      scenario,
      previousMessages: [],
      state,
      userMessage: 'I need help.',
    }).engineState;

    expect(state.endReason).toBe('max_turns');
  });

  it('keeps an already completed state completed', () => {
    const fixture = readFixture();
    const state = {
      ...createInitialConversationEngineState(fixture.scenario),
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      pendingSlotKey: null,
      status: 'completed' as const,
      endReason: 'goal_completed' as const,
    };

    const result = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'What?',
    });

    expect(result.shouldEndSession).toBe(true);
    expect(result.endReason).toBe('goal_completed');
    expect(result.engineState.status).toBe('completed');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test -- src/services/conversationEngine.test.ts
npm.cmd run typecheck
```

Expected: fails because `conversationEngine.ts` does not exist.

- [ ] **Step 3: Implement app engine**

Create `app/src/services/conversationEngine.ts` with exported functions:

```ts
import type {
  ConversationEngineState,
  ConversationMessage,
  ConversationTurnType,
  Scenario,
  SkillTag,
  TurnInterpretation,
} from '../types/conversation';
import { getRequiredSlots, slotMatches } from './conversationSlotMatcher';

type EngineTurnInput = {
  scenario: Scenario;
  previousMessages: ConversationMessage[];
  state: ConversationEngineState;
  userMessage: string;
  interpretation?: TurnInterpretation;
};

const onlyNoisePattern = /^[\s!?.,'"`~@#$%^&*()_+\-=:[\]{};<>/\\|]+$/;
const koreanOnlyPattern = /^[\sㄱ-ㅎㅏ-ㅣ가-힣!?.,'"`~@#$%^&*()_+\-=:[\]{};<>/\\|]+$/;
const englishTokenPattern = /[a-z][a-z']*/gi;
const lowConfidenceThreshold = 0.6;

export function createInitialConversationEngineState(
  scenario: Scenario,
): ConversationEngineState {
  const firstSlot = getRequiredSlots(scenario)[0] ?? null;

  return {
    filledSlotKeys: [],
    pendingSlotKey: firstSlot?.key ?? null,
    lastPromptKey: null,
    lastAssistantActionKey: null,
    lastTurnType: null,
    repeatedPromptCount: 0,
    noProgressCount: 0,
    offTopicCount: 0,
    unclearCount: 0,
    userTurnCount: 0,
    status: firstSlot ? 'active' : 'completed',
    endReason: firstSlot ? null : 'goal_completed',
  };
}

export function getConversationEngineFailureCount(state: ConversationEngineState) {
  return state.offTopicCount + state.unclearCount;
}

export function runConversationEngineTurn({
  scenario,
  previousMessages,
  state,
  userMessage,
  interpretation = interpretUserTurnWithFallback(scenario, userMessage),
}: EngineTurnInput) {
  const nextState = reduceConversationTurn({ scenario, state, interpretation });
  const message = createEngineMessage({
    scenario,
    state: nextState,
    previousMessages,
    userMessage,
    interpretation,
  });

  return {
    message,
    userAnalysis: {
      isRelevant: interpretation.isOnTopic,
      isUnderstandable: interpretation.isUnderstandable,
      detectedIssues: interpretation.detectedIssueTags,
      correctedSentence: interpretation.correctedSentence ?? undefined,
      shortReasonKo: interpretation.shortReasonKo ?? undefined,
    },
    communicationFailed: interpretation.turnType === 'off_topic' || interpretation.turnType === 'unclear',
    shouldEndSession: nextState.status !== 'active',
    endReason: nextState.endReason,
    engineState: {
      ...nextState,
      lastPromptKey: nextState.pendingSlotKey,
      lastAssistantActionKey: getAssistantActionKey(nextState, interpretation),
    },
  };
}
```

The rest of the implementation must include:

```ts
export function interpretUserTurnWithFallback(
  scenario: Scenario,
  userMessage: string,
): TurnInterpretation
```

Rules:

- Blank/noise/Korean-only returns `turnType='unclear'`.
- Slot keyword match returns `turnType='progress'` and matching keys.
- Scenario-related English without new slot returns `turnType='no_progress'`.
- Other English returns `turnType='off_topic'`.

```ts
export function reduceConversationTurn(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  interpretation: TurnInterpretation;
}): ConversationEngineState
```

Rules must match the spec end-reason priority exactly:

1. `goal_completed`
2. `too_many_failures`
3. `no_progress`
4. `max_turns`

If the input state is already terminal (`status !== 'active'` or `endReason !== null`), preserve the terminal state and return the matching terminal message. Do not reopen a completed or ended conversation because of a later user message.

```ts
function createEngineMessage(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  previousMessages: ConversationMessage[];
  userMessage: string;
  interpretation: TurnInterpretation;
}): ConversationMessage
```

Message policy:

- `goal_completed`: `scenario.completionMessage`
- `max_turns`: `Let's stop here and review your conversation.`
- `too_many_failures`: `Let's stop here and review your English together.`
- `no_progress`: `Let's stop here and review this situation together.`
- `unclear`: `repairPolicy.koreanOnly` for Korean-only, otherwise `repairPolicy.unclear`
- `off_topic`: `repairPolicy.offTopic`
- active slot with `repeatedPromptCount === 0`: slot prompt
- active slot with `repeatedPromptCount === 1`: `This situation needs ${slot.label}. Try: "${example}"`
- active slot with `repeatedPromptCount === 2`: `One simple answer is enough: "${example}"`
- active slot with `repeatedPromptCount >= 3`: end state should already be `no_progress`
- if the selected `lastAssistantActionKey` equals the previous state's `lastAssistantActionKey`, force the next higher action before creating the message

- [ ] **Step 4: Run app engine tests**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test -- src/services/conversationEngine.test.ts
```

Expected: all app engine tests pass.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add app/src/services/conversationEngine.ts app/src/services/conversationEngine.test.ts
git commit -m "feat: add deterministic app conversation engine"
```

---

## Task 3: Integrate Engine State into App Conversation Flow

**Files:**
- Modify: `app/src/services/conversationSessionService.ts`
- Modify: `app/src/services/conversationSessionService.test.ts`
- Modify: `app/src/services/conversationService.ts`
- Modify: `app/src/services/conversationService.test.ts`
- Modify: `app/src/screens/ConversationScreen.tsx`
- Modify: `app/App.tsx`

- [ ] **Step 1: Write failing integration tests**

Add to `app/src/services/conversationSessionService.test.ts`:

```ts
it('creates a conversation session with engine state', () => {
  const session = createConversationSession(scenarios[0]);

  expect(session.engineState.pendingSlotKey).toBe(scenarios[0].requiredSlots[0]?.key ?? null);
  expect(session.engineState.userTurnCount).toBe(0);
  expect(session.engineState.endReason).toBeNull();
});
```

Add to `app/src/services/conversationService.test.ts`:

```ts
it('fallback actor ends repeated off-topic turns without repeating the slot prompt', () => {
  const first = getMockActorResponse({
    scenario: libraryScenario,
    userMessage: 'I like soccer.',
    previousMessages: [openingMessage],
    failureCount: 0,
    engineState: createInitialConversationEngineState(libraryScenario),
  });
  const second = getMockActorResponse({
    scenario: libraryScenario,
    userMessage: 'I went to school yesterday.',
    previousMessages: [openingMessage, first.message],
    failureCount: getConversationEngineFailureCount(first.engineState),
    engineState: first.engineState,
  });
  const third = getMockActorResponse({
    scenario: libraryScenario,
    userMessage: 'Banana is yellow.',
    previousMessages: [openingMessage, first.message, second.message],
    failureCount: getConversationEngineFailureCount(second.engineState),
    engineState: second.engineState,
  });

  expect(first.message.content).not.toBe(second.message.content);
  expect(third.shouldEndSession).toBe(true);
  expect(third.endReason).toBe('too_many_failures');
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test -- src/services/conversationSessionService.test.ts src/services/conversationService.test.ts
```

Expected: fails because `engineState` is not wired into session/service inputs.

- [ ] **Step 3: Wire `engineState` into app services**

Modify `ActorInput` in `app/src/services/conversationService.ts`:

```ts
type ActorInput = {
  scenario: Scenario;
  userMessage: string;
  previousMessages: ConversationMessage[];
  failureCount: number;
  engineState: ConversationEngineState;
};
```

Add `engineState` to the fetch body. Change catch fallback to:

```ts
return getMockActorResponse(input);
```

Change `getMockActorResponse` to delegate to:

```ts
return runConversationEngineTurn({
  scenario: input.scenario,
  previousMessages: input.previousMessages,
  state: input.engineState,
  userMessage: input.userMessage,
});
```

Change `normalizeActorApiResponse` to preserve `engineState`.

Modify `createConversationSession` to initialize state:

```ts
engineState: createInitialConversationEngineState(scenario),
```

After `createConversationSession`, `getActorResponse`, and `ConversationScreen` all pass state explicitly, tighten app types so `engineState` is required on `ConversationSession` and `ActorResponse`:

```ts
export type ConversationSession = {
  id: string;
  mode: 'conversation';
  level: LearnerLevel;
  scenario: Scenario;
  messages: ConversationMessage[];
  failureCount: number;
  engineState: ConversationEngineState;
};

export type ActorResponse = {
  message: ConversationMessage;
  userAnalysis: UserMessageAnalysis;
  communicationFailed: boolean;
  shouldEndSession: boolean;
  endReason: EndReason;
  engineState: ConversationEngineState;
};
```

- [ ] **Step 4: Wire `ConversationScreen` state updates**

In `ConversationScreen.tsx`, add props:

```ts
engineState: ConversationEngineState;
onChangeEngineState: (engineState: ConversationEngineState) => void;
```

Change the `onFinishSession` prop signature so the terminal turn can pass its final engine state without relying on a React state update:

```ts
onFinishSession: (
  messages?: ConversationMessage[],
  failureCount?: number,
  engineState?: ConversationEngineState,
) => Promise<void>;
```

Pass `engineState` into `getActorResponse`.

Replace:

```ts
const nextFailureCount = failureCount + (actorResponse.communicationFailed ? 1 : 0);
```

with:

```ts
const nextFailureCount = getConversationEngineFailureCount(actorResponse.engineState);
```

Call:

```ts
onChangeEngineState(actorResponse.engineState);
```

When `actorResponse.shouldEndSession` is true, pass the terminal state directly:

```ts
await onFinishSession(nextMessages, nextFailureCount, actorResponse.engineState);
```

- [ ] **Step 5: Wire `App.tsx` session updates**

Add `changeConversationEngineState(engineState)` that updates `activeConversationSession.engineState`.

Change `finishConversation` signature:

```ts
async function finishConversation(
  messages?: ConversationMessage[],
  failureCount?: number,
  engineState?: ConversationEngineState,
)
```

Build the completed session with the terminal engine state passed from `ConversationScreen`:

```ts
const completedEngineState = engineState ?? currentSession.engineState;
const completedSession: ConversationSession = {
  ...currentSession,
  messages: messages ?? currentSession.messages,
  engineState: completedEngineState,
  failureCount: failureCount ?? getConversationEngineFailureCount(completedEngineState),
};
```

Then derive failure count from completed engine state:

```ts
const completedFailureCount = getConversationEngineFailureCount(completedSession.engineState);
```

Pass `engineState` and `endReason` to evaluation in Task 6.

- [ ] **Step 6: Run tests and typecheck**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test
npm.cmd run typecheck
```

Expected: app tests and typecheck pass.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add app/src/types/conversation.ts app/src/services/conversationSessionService.ts app/src/services/conversationSessionService.test.ts app/src/services/conversationService.ts app/src/services/conversationService.test.ts app/src/screens/ConversationScreen.tsx app/App.tsx
git commit -m "feat: wire conversation engine state into app"
```

---

## Task 4: Add Server Mirrored Engine

**Files:**
- Create: `server/conversationEngine.mjs`
- Modify: `server/index.test.mjs`
- Test: `server/index.test.mjs`

- [ ] **Step 1: Add failing server fixture tests**

Modify `server/index.test.mjs` imports:

```js
import { readFileSync } from 'node:fs';
import {
  bootstrapConversationEngineState,
  createInitialConversationEngineState,
  normalizeConversationEngineState,
  normalizeInterpreterOutput,
  runConversationEngineTurn,
} from './conversationEngine.mjs';
```

Add:

```js
test('server conversation engine matches shared fixture', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));

  for (const fixtureCase of fixture.cases) {
    let state = createInitialConversationEngineState(fixture.scenario);

    for (const turn of fixtureCase.turns) {
      const result = runConversationEngineTurn({
        scenario: fixture.scenario,
        previousMessages: [],
        state,
        userMessage: turn.userMessage,
      });
      state = result.engineState;

      assert.equal(result.engineState.endReason, turn.expectedEndReason);
      assert.equal(result.engineState.pendingSlotKey, turn.expectedPendingSlotKey);
    }
  }
});

test('server engine resets counters after progress', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  let state = createInitialConversationEngineState(fixture.scenario);

  state = runConversationEngineTurn({
    scenario: fixture.scenario,
    previousMessages: [],
    state,
    userMessage: 'I need help.',
  }).engineState;

  const progress = runConversationEngineTurn({
    scenario: fixture.scenario,
    previousMessages: [],
    state,
    userMessage: "I'm feeling stomachache.",
  });

  assert.equal(progress.engineState.noProgressCount, 0);
  assert.equal(progress.engineState.repeatedPromptCount, 0);
  assert.equal(progress.engineState.pendingSlotKey, 'medicineQuestion');
});

test('server engine prioritizes too many failures over no progress', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  let state = createInitialConversationEngineState(fixture.scenario);

  for (const userMessage of ['I like soccer.', 'I went to school yesterday.', 'Banana is yellow.']) {
    state = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage,
    }).engineState;
  }

  assert.equal(state.noProgressCount, 3);
  assert.equal(state.offTopicCount + state.unclearCount, 3);
  assert.equal(state.endReason, 'too_many_failures');
});

test('server interpreter normalization allowlists slot keys and rejects low confidence fills', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const normalized = normalizeInterpreterOutput({
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys: ['symptom', 'nonexistentSlot'],
    correctedSentence: null,
    detectedIssueTags: [],
    shortReasonKo: null,
    confidence: 0.4,
  }, fixture.scenario);

  assert.deepEqual(normalized.filledSlotKeys, []);
  assert.equal(normalized.turnType, 'no_progress');
});

test('server engine cannot complete from low confidence filled slots', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const result = runConversationEngineTurn({
    scenario: fixture.scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(fixture.scenario),
    userMessage: 'I need something.',
    interpretation: normalizeInterpreterOutput({
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'progress',
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      correctedSentence: null,
      detectedIssueTags: [],
      shortReasonKo: null,
      confidence: 0.4,
    }, fixture.scenario),
  });

  assert.equal(result.engineState.endReason, null);
  assert.equal(result.engineState.pendingSlotKey, 'symptom');
});

test('server engine keeps an already completed state completed', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const state = normalizeConversationEngineState({
    filledSlotKeys: ['symptom', 'medicineQuestion'],
    pendingSlotKey: null,
    lastPromptKey: 'medicineQuestion',
    lastAssistantActionKey: 'complete',
    lastTurnType: 'progress',
    repeatedPromptCount: 0,
    noProgressCount: 0,
    offTopicCount: 0,
    unclearCount: 0,
    userTurnCount: 2,
    status: 'completed',
    endReason: 'goal_completed',
  }, fixture.scenario);

  const result = runConversationEngineTurn({
    scenario: fixture.scenario,
    previousMessages: [],
    state,
    userMessage: 'What?',
    interpretation: normalizeInterpreterOutput({
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'no_progress',
      filledSlotKeys: [],
      correctedSentence: null,
      detectedIssueTags: [],
      shortReasonKo: null,
      confidence: 0.9,
    }, fixture.scenario),
  });

  assert.equal(result.shouldEndSession, true);
  assert.equal(result.endReason, 'goal_completed');
  assert.equal(result.engineState.status, 'completed');
});
```

- [ ] **Step 2: Run server tests to verify failure**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
```

Expected: fails because `conversationEngine.mjs` does not exist.

- [ ] **Step 3: Implement `server/conversationEngine.mjs`**

Mirror the app engine exports:

```js
export function createInitialConversationEngineState(scenario) {}
export function getConversationEngineFailureCount(state) {}
export function interpretUserTurnWithFallback(scenario, userMessage) {}
export function reduceConversationTurn({ scenario, state, interpretation }) {}
export function runConversationEngineTurn({ scenario, previousMessages, state, userMessage, interpretation }) {}
export function normalizeConversationEngineState(value, scenario) {}
export function bootstrapConversationEngineState(scenario, messages, legacyFailureCount = 0) {}
export function normalizeInterpreterOutput(value, scenario) {}
```

Implementation must preserve these exact reducer priorities:

```js
const endReason = allSlotsFilled
  ? 'goal_completed'
  : offTopicCount + unclearCount >= 3
    ? 'too_many_failures'
    : noProgressCount >= 3
      ? 'no_progress'
      : userTurnCount >= maxUserTurns
        ? 'max_turns'
        : null;
```

If `state.status !== 'active'` or `state.endReason !== null`, `runConversationEngineTurn` must preserve the terminal state and return the matching terminal assistant message. This prevents a late or duplicate API call from reopening a completed conversation.

`normalizeInterpreterOutput(value, scenario)` must:

- keep only `filledSlotKeys` that exist in `getRequiredSlots(scenario)`;
- drop all filled slot keys when `confidence < 0.6`;
- force `turnType='unclear'` when `isUnderstandable=false`;
- force `turnType='off_topic'` when `isUnderstandable=true` and `isOnTopic=false`;
- force `turnType='no_progress'` when no allowed slot key remains after normalization and the original turn type was `progress`;
- filter `detectedIssueTags` to known skill tags.

`normalizeConversationEngineState(value, scenario)` must:

- keep only known slot keys in `filledSlotKeys`;
- recompute `pendingSlotKey` from the scenario's required slots and normalized filled slots;
- clamp all counters to non-negative integers;
- recompute `status` and `endReason` from the reducer priority rules.

`bootstrapConversationEngineState(scenario, messages, legacyFailureCount)` must:

- inspect only user messages;
- fill slots using the same fallback matcher as `interpretUserTurnWithFallback`;
- set `userTurnCount` to the number of user messages;
- set `unclearCount` to `legacyFailureCount` only when no v2 engine state exists;
- leave `offTopicCount`, `noProgressCount`, and `repeatedPromptCount` at `0`.

- [ ] **Step 4: Run server tests**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
npm.cmd run check
```

Expected: server tests and syntax check pass.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add server/conversationEngine.mjs server/index.test.mjs
git commit -m "feat: add deterministic server conversation engine"
```

---

## Task 5: Migrate Server Respond API to Interpreter Output

**Files:**
- Modify: `server/index.mjs`
- Modify: `server/index.test.mjs`

- [ ] **Step 1: Add failing pure API normalization tests**

Import a deterministic seam from `server/index.mjs`:

```js
import {
  createConversationResponseFromInterpretation,
} from './index.mjs';
```

Add tests that do not call OpenAI:

```js
test('respond normalization ignores legacy failureCount when engineState is present', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const response = createConversationResponseFromInterpretation({
    scenario: fixture.scenario,
    userMessage: 'I like soccer.',
    messages: [],
    failureCount: 0,
    engineState: {
      filledSlotKeys: [],
      pendingSlotKey: 'symptom',
      lastPromptKey: 'symptom',
      lastAssistantActionKey: 'symptom:example',
      lastTurnType: 'off_topic',
      repeatedPromptCount: 2,
      noProgressCount: 2,
      offTopicCount: 2,
      unclearCount: 0,
      userTurnCount: 2,
      status: 'active',
      endReason: null,
    },
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: false,
        turnType: 'off_topic',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: ['vocabulary_range'],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'too_many_failures');
  assert.equal(response.engineState.offTopicCount, 3);
});

test('respond bootstrap restores only filled slots and user turn count when engineState is missing', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const response = createConversationResponseFromInterpretation({
    scenario: fixture.scenario,
    userMessage: 'Do you have any medicine for stomachache?',
    messages: [
      { role: 'assistant', content: fixture.scenario.openingMessage },
      { role: 'user', content: "I'm feeling stomachache." },
    ],
    failureCount: 2,
    engineState: null,
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys: ['medicineQuestion'],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.95,
      },
    },
  });

  assert.equal(response.endReason, 'goal_completed');
  assert.equal(response.engineState.offTopicCount, 0);
  assert.equal(response.engineState.noProgressCount, 0);
  assert.equal(response.engineState.repeatedPromptCount, 0);
  assert.deepEqual(response.engineState.filledSlotKeys.sort(), ['medicineQuestion', 'symptom']);
});

test('respond normalization does not complete from low confidence LLM slot fills', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const response = createConversationResponseFromInterpretation({
    scenario: fixture.scenario,
    userMessage: 'I need something.',
    messages: [],
    failureCount: 0,
    engineState: null,
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys: ['symptom', 'medicineQuestion'],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.4,
      },
    },
  });

  assert.equal(response.shouldEndSession, false);
  assert.equal(response.endReason, null);
  assert.deepEqual(response.engineState.filledSlotKeys, []);
});

test('respond normalization keeps completed engine state completed', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const response = createConversationResponseFromInterpretation({
    scenario: fixture.scenario,
    userMessage: 'Can I ask one more thing?',
    messages: [],
    failureCount: 0,
    engineState: {
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      pendingSlotKey: null,
      lastPromptKey: 'medicineQuestion',
      lastAssistantActionKey: 'complete',
      lastTurnType: 'progress',
      repeatedPromptCount: 0,
      noProgressCount: 0,
      offTopicCount: 0,
      unclearCount: 0,
      userTurnCount: 2,
      status: 'completed',
      endReason: 'goal_completed',
    },
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'no_progress',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'goal_completed');
  assert.equal(response.engineState.status, 'completed');
});
```

- [ ] **Step 2: Run server tests to verify failure**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
```

Expected: tests fail because `index.mjs` still uses actor output.

- [ ] **Step 3: Replace actor prompt with interpreter prompt**

Rename `buildActorPrompt` to `buildInterpreterPrompt` and make it ask for interpretation only:

```js
function buildInterpreterPrompt() {
  return [
    'You interpret one learner message in an English roleplay app.',
    'Do not write the assistant roleplay reply.',
    'Return only JSON that matches the schema.',
    'Classify the latest userMessage as progress, no_progress, off_topic, or unclear.',
    'Only include filledSlotKeys that exist in conversationState.requiredSlots.',
    'Use confidence 0.0 to 1.0.',
  ].join('\n');
}
```

Replace `actorResponseSchema()` with `interpreterResponseSchema()`:

```js
function interpreterResponseSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['interpretation'],
    properties: {
      interpretation: {
        type: 'object',
        additionalProperties: false,
        required: [
          'isUnderstandable',
          'isOnTopic',
          'turnType',
          'filledSlotKeys',
          'correctedSentence',
          'detectedIssueTags',
          'shortReasonKo',
          'confidence',
        ],
        properties: {
          isUnderstandable: { type: 'boolean' },
          isOnTopic: { type: 'boolean' },
          turnType: { type: 'string', enum: ['progress', 'no_progress', 'off_topic', 'unclear'] },
          filledSlotKeys: { type: 'array', items: { type: 'string' } },
          correctedSentence: { type: ['string', 'null'] },
          detectedIssueTags: { type: 'array', items: { type: 'string', enum: skillTags } },
          shortReasonKo: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  };
}
```

- [ ] **Step 4: Use server engine for final response**

Import server engine helpers in `server/index.mjs`:

```js
import {
  bootstrapConversationEngineState,
  interpretUserTurnWithFallback,
  normalizeConversationEngineState,
  normalizeInterpreterOutput,
  runConversationEngineTurn,
} from './conversationEngine.mjs';
```

Export a pure seam from `server/index.mjs`:

```js
export function createConversationResponseFromInterpretation({
  scenario,
  userMessage,
  messages,
  failureCount,
  engineState,
  interpreterOutput,
}) {
  const normalizedState = engineState && typeof engineState === 'object'
    ? normalizeConversationEngineState(engineState, scenario)
    : bootstrapConversationEngineState(scenario, messages, Number(failureCount ?? 0));
  const interpretation = interpreterOutput?.interpretation
    ?? interpretUserTurnWithFallback(scenario, userMessage);

  return runConversationEngineTurn({
    scenario,
    previousMessages: messages,
    state: normalizedState,
    userMessage,
    interpretation: normalizeInterpreterOutput(interpretation, scenario),
  });
}
```

In `createActorResponse`, call OpenAI for interpretation only. Do not duplicate reducer, normalization, or terminal-state logic. After `interpreterOutput` is available, return through the pure seam:

```js
return createConversationResponseFromInterpretation({
  scenario,
  userMessage: body.userMessage,
  messages,
  failureCount: body.failureCount,
  engineState: body.engineState,
  interpreterOutput,
});
```

If the OpenAI request fails inside the existing server fallback path, create a synthetic interpreter output with `interpretUserTurnWithFallback(scenario, body.userMessage)` and still call `createConversationResponseFromInterpretation`. The API response shape must be identical whether the interpretation came from OpenAI or fallback.

- [ ] **Step 5: Run server tests**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
npm.cmd run check
```

Expected: tests and syntax check pass.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add server/index.mjs server/index.test.mjs server/conversationEngine.mjs
git commit -m "feat: make conversation API state-machine driven"
```

---

## Task 6: Integrate Evaluation End Reasons

**Files:**
- Modify: `app/src/services/evaluationService.ts`
- Modify: `app/src/services/evaluationService.test.ts`
- Modify: `app/App.tsx`
- Modify: `server/index.mjs`
- Modify: `server/index.test.mjs`

- [ ] **Step 1: Add failing app and server evaluation tests**

Add app tests:

```ts
it('caps fallback evaluation for no progress endings', () => {
  const result = evaluateConversation({
    scenario: scenarios[0],
    messages: [{ id: 'user-1', role: 'user', content: 'Please help me.', createdAt: '2026-06-10T00:00:00.000Z' }],
    communicationFailureCount: 0,
    engineState: {
      filledSlotKeys: [],
      pendingSlotKey: scenarios[0].requiredSlots[0]?.key ?? null,
      lastPromptKey: null,
      lastAssistantActionKey: null,
      lastTurnType: 'no_progress',
      repeatedPromptCount: 2,
      noProgressCount: 3,
      offTopicCount: 0,
      unclearCount: 0,
      userTurnCount: 3,
      status: 'ended',
      endReason: 'no_progress',
    },
    endReason: 'no_progress',
  });

  expect(result.categoryScores.taskCompletion).toBeLessThanOrEqual(14);
  expect(result.categoryScores.clarity).toBeLessThanOrEqual(18);
  expect(result.totalScore).toBeLessThan(60);
});
```

Add server tests in `server/index.test.mjs`:

```js
import {
  normalizeEvaluation,
} from './index.mjs';

test('server evaluation caps no_progress endings and reports the first missing slot', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const result = normalizeEvaluation({
    totalScore: 95,
    categoryScores: {
      taskCompletion: 30,
      clarity: 25,
      grammar: 20,
      vocabulary: 15,
      naturalness: 10,
    },
    summaryKo: '좋습니다.',
    strengthsKo: [],
    weaknessesKo: [],
    correctedExamples: [],
    weaknessTags: [],
    recommendedScenarioIds: [],
  }, {
    scenario: fixture.scenario,
    engineState: {
      filledSlotKeys: [],
      pendingSlotKey: 'symptom',
      lastPromptKey: null,
      lastAssistantActionKey: null,
      lastTurnType: 'no_progress',
      repeatedPromptCount: 2,
      noProgressCount: 3,
      offTopicCount: 0,
      unclearCount: 0,
      userTurnCount: 3,
      status: 'ended',
      endReason: 'no_progress',
    },
    endReason: 'no_progress',
  });

  assert.equal(result.categoryScores.taskCompletion <= 14, true);
  assert.equal(result.categoryScores.clarity <= 18, true);
  assert.equal(result.totalScore < 80, true);
  assert.equal(result.weaknessesKo.some((item) => item.includes('symptom')), true);
});

test('server evaluation caps too_many_failures endings', () => {
  const fixture = JSON.parse(readFileSync(new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url), 'utf8'));
  const result = normalizeEvaluation({
    totalScore: 100,
    categoryScores: {
      taskCompletion: 30,
      clarity: 25,
      grammar: 20,
      vocabulary: 15,
      naturalness: 10,
    },
    summaryKo: '좋습니다.',
    strengthsKo: [],
    weaknessesKo: [],
    correctedExamples: [],
    weaknessTags: [],
    recommendedScenarioIds: [],
  }, {
    scenario: fixture.scenario,
    engineState: {
      filledSlotKeys: [],
      pendingSlotKey: 'symptom',
      lastPromptKey: null,
      lastAssistantActionKey: null,
      lastTurnType: 'off_topic',
      repeatedPromptCount: 0,
      noProgressCount: 3,
      offTopicCount: 3,
      unclearCount: 0,
      userTurnCount: 3,
      status: 'ended',
      endReason: 'too_many_failures',
    },
    endReason: 'too_many_failures',
  });

  assert.equal(result.categoryScores.taskCompletion <= 10, true);
  assert.equal(result.categoryScores.clarity <= 12, true);
  assert.equal(result.totalScore < 70, true);
});
```

- [ ] **Step 2: Extend evaluation input types**

Change app `EvaluationInput`:

```ts
type EvaluationInput = {
  scenario: Scenario;
  messages: ConversationMessage[];
  communicationFailureCount: number;
  engineState: ConversationEngineState | null;
  endReason: ConversationEngineEndReason;
};
```

Send these fields in `evaluateConversationWithAi`.

- [ ] **Step 3: Apply deterministic score caps**

In app fallback evaluation, after computing category scores:

```ts
const cappedScores = applyEndReasonCaps({
  scores: { taskCompletion, clarity, grammar, vocabulary, naturalness },
  scenario,
  engineState,
  endReason,
});
```

Caps:

- `max_turns`: taskCompletion max 20
- `no_progress`: taskCompletion max 14, clarity max 18
- `too_many_failures`: taskCompletion max 10, clarity max 12
- missing slot penalty: subtract 4 from taskCompletion per missing required slot
- missing slot feedback: append a Korean weakness item that names the first missing required slot label, for example `아직 완료하지 못한 목표: symptom`

- [ ] **Step 4: Update server evaluation normalization**

In `server/index.mjs`, read `engineState` and `endReason`. Export and update:

```js
export function normalizeEvaluation(evaluation, { scenario, engineState, endReason }) {
  // normalize model scores, apply caps, then recompute totalScore
}
```

Update `createEvaluation` to call:

```js
return normalizeEvaluation(evaluation, {
  scenario: body.scenario,
  engineState: body.engineState ?? null,
  endReason: body.endReason ?? body.engineState?.endReason ?? null,
});
```

Apply the same caps and missing-slot feedback as the app fallback evaluation.

- [ ] **Step 5: Wire App finish conversation**

In `App.tsx`, pass:

```ts
engineState: completedSession.engineState,
endReason: completedSession.engineState.endReason,
communicationFailureCount: getConversationEngineFailureCount(completedSession.engineState),
```

- [ ] **Step 6: Run tests**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test
npm.cmd run typecheck
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
npm.cmd run check
```

Expected: app and server tests pass.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git add app/src/services/evaluationService.ts app/src/services/evaluationService.test.ts app/App.tsx server/index.mjs server/index.test.mjs
git commit -m "feat: score conversation endings from engine state"
```

---

## Task 7: Live Verification and Deployment

**Files:**
- Modify: `server/index.mjs` only when live API behavior differs from server tests.
- Modify: `server/conversationEngine.mjs` only when live API behavior differs from fixture tests.
- Modify: `server/index.test.mjs` when a live bug reveals a missing server regression test.

- [ ] **Step 1: Run complete local verification**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd test
npm.cmd run typecheck
cd C:\Users\woung\Desktop\EnglishProject\server
npm.cmd test
npm.cmd run check
```

Expected:

- `app` tests pass.
- `app` typecheck passes.
- `server` tests pass.
- `server` syntax check passes.

- [ ] **Step 2: Deploy Firebase Functions**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
& 'C:\Users\woung\AppData\Roaming\npm\firebase.cmd' deploy --only functions --project englishproject-c42b2
```

Expected: deploy completes successfully.

- [ ] **Step 3: Verify live off-topic ending**

Run a Node script against:

```text
https://englishproject-c42b2.web.app/api/conversation/respond
```

Call three turns:

1. `I like soccer.`
2. `I went to school yesterday.`
3. `Banana is yellow.`

Expected final response:

```json
{
  "shouldEndSession": true,
  "endReason": "too_many_failures"
}
```

- [ ] **Step 4: Verify live goal completion**

Use the same pharmacy scenario:

1. `I'm feeling stomachache.`
2. `Do you have any medicine for stomachache?`

Expected second response:

```json
{
  "shouldEndSession": true,
  "endReason": "goal_completed"
}
```

- [ ] **Step 5: Verify live no-progress ending**

Use the same pharmacy scenario:

1. `I need help.`
2. `Can you help me?`
3. `Please help me.`

Expected final response:

```json
{
  "shouldEndSession": true,
  "endReason": "no_progress"
}
```

Also assert that the second assistant message is different from the first assistant message so the same slot prompt is not repeated.

- [ ] **Step 6: Handle live verification failures**

If Step 3, Step 4, or Step 5 fails, do not create a deployment-only workaround. Return to the task that owns the failed behavior:

- `engineState` or reducer mismatch: return to Task 4.
- LLM interpreter schema or API normalization mismatch: return to Task 5.
- evaluation score mismatch: return to Task 6.

After the owning task is fixed, rerun Task 7 from Step 1.

---

## Task 8: Build Local APK and Final Commit Check

**Files:**
- Output: `C:\Users\woung\Desktop\이력서\app-release.apk`

- [ ] **Step 1: Build local release APK**

```powershell
cd C:\Users\woung\Desktop\EnglishProject\app
npm.cmd run build:android:apk
```

Expected output includes:

```text
BUILD SUCCESSFUL
APK copied: C:\Users\woung\Desktop\이력서\app-release.apk
```

- [ ] **Step 2: Record APK hash**

```powershell
Get-FileHash -Algorithm SHA256 'C:\Users\woung\Desktop\이력서\app-release.apk' | Format-List
```

- [ ] **Step 3: Confirm git state**

```powershell
cd C:\Users\woung\Desktop\EnglishProject
git status --short --branch
```

Expected: branch is ahead of remote with no unstaged source changes.

---

## Self-Review Checklist

- Every spec requirement maps to a task:
  - Engine state ownership: Tasks 1, 2, 3, 5
  - Repetition prevention: Tasks 2, 3, 4, 5
  - LLM interpreter only: Task 5
  - App fallback: Tasks 2, 3
  - Evaluation caps: Task 6
  - Deployment and APK: Tasks 7, 8

- No hidden shared-package work is introduced. The plan uses mirrored app/server engines plus shared fixture tests.

- The work is split into independently commit-able phases.

- The recommended execution path is subagent-driven with sequential gates:
  - Main agent: commit this plan first.
  - Worker 1: Task 1 only. Main reviews fixture/types and commits before Task 2.
  - Worker 1: Task 2 app pure engine. Main runs focused app tests and commits before Task 3.
  - Worker 2: Task 4 server pure engine can run after Task 1 is committed because it only shares the fixture. Main reviews and commits before Task 5.
  - Worker 1: Task 3 app integration starts after Task 2 is committed.
  - Worker 2: Task 5 server API migration starts after Task 4 is committed.
  - Main agent or a single Worker 3: Task 6 evaluation integration starts only after Tasks 3 and 5 are both committed, because it touches app and server integration files.
  - Main agent: Task 7 deploy verification, Task 8 local APK build, final gstack/superpowers review.

- No subagent may edit `app/App.tsx`, `server/index.mjs`, or `server/index.test.mjs` while another active task is editing those same files.
