# Firebase Hosting Question Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load English-learning questions from Firebase Hosting JSON packs while keeping local fallback questions and local learner progress.

**Architecture:** The app keeps the current bundled `questionBank` as the fallback source, then adds a question-pack loader that reads cached packs from `AsyncStorage` and refreshes them from Firebase Hosting in the background. Question selection and session creation become source-injected so the same local logic works with bundled, cached, or freshly downloaded questions.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, Vitest, AsyncStorage, Firebase Hosting static JSON.

---

## File Structure

- Modify `app/src/types/learning.ts`
  - Add manifest, level pack, cache, and source metadata types.
- Modify `app/src/constants/learningConfig.ts`
  - Add question-pack cache key, schema version, and Firebase Hosting base URL.
- Modify `app/src/services/questionSelector.ts`
  - Accept a question source array while keeping the bundled bank as the default.
- Modify `app/src/services/sessionService.ts`
  - Pass a question source into practice and promotion session creation.
- Create `app/src/services/questionPackValidation.ts`
  - Parse and validate remote manifest and level-pack JSON.
- Create `app/src/services/questionPackValidation.test.ts`
  - Lock schema validation and reject malformed packs.
- Create `app/src/services/questionPackStorage.ts`
  - Load/save cached question packs from `AsyncStorage`.
- Create `app/src/services/questionPackStorage.test.ts`
  - Verify cache fallback behavior and malformed cache recovery.
- Create `app/src/services/questionPackService.ts`
  - Combine bundled fallback, cached packs, and remote fetch refresh.
- Create `app/src/services/questionPackService.test.ts`
  - Verify load-from-cache, fallback, successful refresh, and failed refresh behavior.
- Modify `app/App.tsx`
  - Load the question source on startup and refresh in the background.
- Modify `app/src/data/questionBank.test.ts`
  - Reuse validator coverage against the bundled question bank.
- Create `firebase.json`
  - Configure Firebase Hosting public directory.
- Create `.firebaserc`
  - Point the repo to `englishproject-c42b2`.
- Create `public/question-packs/manifest.json`
  - Static manifest for v1 packs.
- Create `public/question-packs/packs/a1.v1.json`
  - A1 question pack.
- Create `public/question-packs/packs/a2.v1.json`
  - A2 question pack.
- Create `public/question-packs/packs/b1.v1.json`
  - B1 question pack.
- Create `public/question-packs/packs/b2.v1.json`
  - B2 question pack.

## Task 1: Make Question Selection Source-Injected

**Files:**
- Modify: `app/src/services/questionSelector.ts`
- Modify: `app/src/services/sessionService.ts`
- Modify: `app/src/services/questionSelector.test.ts`
- Modify: `app/src/services/sessionService.test.ts`

- [ ] **Step 1: Add failing selector tests for an injected source**

Add these tests to `app/src/services/questionSelector.test.ts`.

```ts
import type { LearningQuestion } from '../types/learning';

const injectedA1Questions: LearningQuestion[] = [
  {
    id: 'remote-a1-writing-001',
    level: 'A1',
    area: 'conversation',
    kind: 'writing',
    promptKo: '이름을 영어로 쓰세요.',
    sampleAnswer: 'My name is Mina.',
    evaluationFocusKo: 'My name is ... 형태를 확인합니다.',
    explanationKo: '자기 이름을 My name is ... 로 표현합니다.',
  },
  {
    id: 'remote-a1-choice-001',
    level: 'A1',
    area: 'reading',
    kind: 'choice',
    promptKo: '문장을 읽고 맞는 뜻을 고르세요.',
    questionText: 'I have a pen.',
    choices: [
      { id: 'a', text: 'I own a pen.' },
      { id: 'b', text: 'I lost a pen.' },
      { id: 'c', text: 'I need a pen.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'have는 가지고 있다는 뜻입니다.',
  },
  {
    id: 'remote-a1-choice-002',
    level: 'A1',
    area: 'grammar',
    kind: 'choice',
    promptKo: '맞는 be동사를 고르세요.',
    choices: [
      { id: 'a', text: 'You is ready.' },
      { id: 'b', text: 'You are ready.' },
      { id: 'c', text: 'You am ready.' },
    ],
    correctChoiceId: 'b',
    explanationKo: 'You에는 are를 씁니다.',
  },
];

it('selects practice questions from the injected question source', () => {
  const questions = selectPracticeQuestions('A1', [], 0, injectedA1Questions);

  expect(questions.map((question) => question.id)).toEqual([
    'remote-a1-writing-001',
    'remote-a1-choice-001',
    'remote-a1-choice-002',
  ]);
});

it('selects promotion exam questions from the injected question source', () => {
  const injectedPromotionQuestions: LearningQuestion[] = Array.from({ length: 5 }, (_, index) => ({
    id: `remote-a2-choice-00${index + 1}`,
    level: 'A2',
    area: 'grammar',
    kind: 'choice',
    promptKo: '맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: `Correct sentence ${index + 1}.` },
      { id: 'b', text: `Wrong sentence ${index + 1}.` },
      { id: 'c', text: `Bad sentence ${index + 1}.` },
    ],
    correctChoiceId: 'a',
    explanationKo: '정답 문장입니다.',
  }));

  const questions = selectPromotionExamQuestions('A1', injectedPromotionQuestions);

  expect(questions).toHaveLength(5);
  expect(questions.every((question) => question.id.startsWith('remote-a2-choice'))).toBe(true);
});
```

- [ ] **Step 2: Run the selector tests and verify failure**

Run:

```powershell
npm.cmd test -- --run src/services/questionSelector.test.ts
```

Expected: fail because `selectPracticeQuestions` and `selectPromotionExamQuestions` do not accept the injected source argument yet.

- [ ] **Step 3: Update `questionSelector.ts` signatures**

Change the function signatures and internal source reads to this shape.

```ts
export function selectPracticeQuestions(
  level: LearnerLevel,
  recentResults: RecentResult[],
  solvedQuestionCount = 0,
  sourceQuestions: LearningQuestion[] = questionBank,
): LearningQuestion[] {
  const recentQuestionIds = getRecentQuestionIds(recentResults);
  const recentAnswerOutcomes = getRecentAnswerOutcomes(recentResults);
  const weakAreas = getWeakAreaPriority(recentResults);
  const levelQuestions = rotateQuestions(
    sourceQuestions.filter((question) => question.level === level),
    solvedQuestionCount,
  );
  // Keep the existing bucket logic unchanged below this point.
}

export function selectPromotionExamQuestions(
  currentLevel: LearnerLevel,
  sourceQuestions: LearningQuestion[] = questionBank,
): LearningQuestion[] {
  const nextLevel = getNextLevel(currentLevel);

  if (!nextLevel) {
    return [];
  }

  const nextLevelQuestions = sourceQuestions.filter(
    (question) => question.level === nextLevel && question.kind === 'choice',
  );
  const currentLevelQuestions = sourceQuestions.filter(
    (question) => question.level === currentLevel && question.kind === 'choice',
  );

  return takeQuestions([...nextLevelQuestions, ...currentLevelQuestions], PROMOTION_EXAM_QUESTION_COUNT);
}
```

- [ ] **Step 4: Add session service source tests**

Add these tests to `app/src/services/sessionService.test.ts`.

```ts
import type { LearningQuestion, LocalLearningState } from '../types/learning';
import { createPracticeSession, createPromotionExamSession } from './sessionService';

const injectedSource: LearningQuestion[] = [
  {
    id: 'remote-a1-writing-session-001',
    level: 'A1',
    area: 'conversation',
    kind: 'writing',
    promptKo: '좋아하는 음식을 쓰세요.',
    sampleAnswer: 'I like rice.',
    evaluationFocusKo: 'I like ... 문장을 확인합니다.',
    explanationKo: '좋아하는 것은 I like ... 로 말합니다.',
  },
  {
    id: 'remote-a1-choice-session-001',
    level: 'A1',
    area: 'reading',
    kind: 'choice',
    promptKo: '뜻이 맞는 문장을 고르세요.',
    questionText: 'She is happy.',
    choices: [
      { id: 'a', text: 'She is sad.' },
      { id: 'b', text: 'She feels good.' },
      { id: 'c', text: 'She is late.' },
    ],
    correctChoiceId: 'b',
    explanationKo: 'happy는 기쁜 상태입니다.',
  },
  {
    id: 'remote-a1-choice-session-002',
    level: 'A1',
    area: 'grammar',
    kind: 'choice',
    promptKo: '맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'They are friends.' },
      { id: 'b', text: 'They is friends.' },
      { id: 'c', text: 'They am friends.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'They에는 are를 씁니다.',
  },
  ...Array.from({ length: 5 }, (_, index): LearningQuestion => ({
    id: `remote-a2-choice-session-00${index + 1}`,
    level: 'A2',
    area: 'conversation',
    kind: 'choice',
    promptKo: '자연스러운 표현을 고르세요.',
    choices: [
      { id: 'a', text: `Could you help me ${index + 1}?` },
      { id: 'b', text: `Help now ${index + 1}.` },
      { id: 'c', text: `You help ${index + 1}?` },
    ],
    correctChoiceId: 'a',
    explanationKo: 'Could you ... 는 정중한 요청입니다.',
  })),
];

const state: LocalLearningState = {
  currentLevel: 'A1',
  currentRate: 0,
  solvedQuestionCount: 0,
  promotionReady: false,
  recentResults: [],
  updatedAt: '2026-06-09T00:00:00.000Z',
};

it('creates practice sessions from an injected question source', () => {
  const session = createPracticeSession(state, injectedSource);

  expect(session.questions.map((question) => question.id)).toEqual([
    'remote-a1-writing-session-001',
    'remote-a1-choice-session-001',
    'remote-a1-choice-session-002',
  ]);
});

it('creates promotion sessions from an injected question source', () => {
  const session = createPromotionExamSession(state, injectedSource);

  expect(session.questions).toHaveLength(5);
  expect(session.questions.every((question) => question.level === 'A2')).toBe(true);
});
```

- [ ] **Step 5: Update `sessionService.ts` signatures**

Change session creation to accept `sourceQuestions`.

```ts
export function createPracticeSession(
  state: LocalLearningState,
  sourceQuestions?: LearningQuestion[],
): ActiveSession {
  return {
    id: createSessionId('practice'),
    mode: 'practice',
    level: state.currentLevel,
    questions: selectPracticeQuestions(
      state.currentLevel,
      state.recentResults,
      state.solvedQuestionCount,
      sourceQuestions,
    ),
    currentQuestionIndex: 0,
    answers: [],
  };
}

export function createPromotionExamSession(
  state: LocalLearningState,
  sourceQuestions?: LearningQuestion[],
): ActiveSession {
  return {
    id: createSessionId('promotion'),
    mode: 'promotionExam',
    level: state.currentLevel,
    questions: selectPromotionExamQuestions(state.currentLevel, sourceQuestions),
    currentQuestionIndex: 0,
    answers: [],
  };
}
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm.cmd test -- --run src/services/questionSelector.test.ts src/services/sessionService.test.ts
```

Expected: all tests pass.

## Task 2: Add Question Pack Types and Constants

**Files:**
- Modify: `app/src/types/learning.ts`
- Modify: `app/src/constants/learningConfig.ts`

- [ ] **Step 1: Add constants**

Add these exports to `app/src/constants/learningConfig.ts`.

```ts
export const QUESTION_PACK_STORAGE_KEY = 'englishProject.questionPacks.v1';

export const QUESTION_PACK_SCHEMA_VERSION = 1;

export const REMOTE_QUESTION_PACK_BASE_URL =
  'https://englishproject-c42b2.web.app/question-packs';
```

- [ ] **Step 2: Add question-pack types**

Add these exports to `app/src/types/learning.ts`.

```ts
export type QuestionPackManifestEntry = {
  level: LearnerLevel;
  version: number;
  path: string;
  questionCount: number;
};

export type QuestionPackManifest = {
  schemaVersion: 1;
  publishedAt: string;
  packs: QuestionPackManifestEntry[];
};

export type LevelQuestionPack = {
  schemaVersion: 1;
  level: LearnerLevel;
  version: number;
  publishedAt: string;
  questions: LearningQuestion[];
};

export type CachedLevelPack = {
  level: LearnerLevel;
  version: number;
  publishedAt: string;
  questions: LearningQuestion[];
  cachedAt: string;
};

export type CachedQuestionPackState = {
  schemaVersion: 1;
  manifestPublishedAt: string;
  packs: Partial<Record<LearnerLevel, CachedLevelPack>>;
};

export type QuestionPackSourceOrigin = 'bundled' | 'cache' | 'remote';

export type QuestionPackSource = {
  origin: QuestionPackSourceOrigin;
  questions: LearningQuestion[];
  cachedState: CachedQuestionPackState | null;
};
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: pass.

## Task 3: Implement Question Pack Validation

**Files:**
- Create: `app/src/services/questionPackValidation.ts`
- Create: `app/src/services/questionPackValidation.test.ts`
- Modify: `app/src/data/questionBank.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `app/src/services/questionPackValidation.test.ts`.

```ts
import { describe, expect, it } from 'vitest';

import { questionBank } from '../data/questionBank';
import type { LevelQuestionPack, QuestionPackManifest } from '../types/learning';
import {
  flattenCachedPacks,
  isValidLevelQuestionPack,
  isValidQuestionPackManifest,
} from './questionPackValidation';

const validManifest: QuestionPackManifest = {
  schemaVersion: 1,
  publishedAt: '2026-06-09T00:00:00.000Z',
  packs: [
    {
      level: 'A1',
      version: 1,
      path: 'packs/a1.v1.json',
      questionCount: 1,
    },
  ],
};

const validPack: LevelQuestionPack = {
  schemaVersion: 1,
  level: 'A1',
  version: 1,
  publishedAt: '2026-06-09T00:00:00.000Z',
  questions: questionBank.filter((question) => question.level === 'A1'),
};

describe('questionPackValidation', () => {
  it('accepts a valid manifest', () => {
    expect(isValidQuestionPackManifest(validManifest)).toBe(true);
  });

  it('rejects manifest entries with unsafe paths', () => {
    expect(
      isValidQuestionPackManifest({
        ...validManifest,
        packs: [{ ...validManifest.packs[0], path: 'https://example.com/a1.json' }],
      }),
    ).toBe(false);
    expect(
      isValidQuestionPackManifest({
        ...validManifest,
        packs: [{ ...validManifest.packs[0], path: '../a1.json' }],
      }),
    ).toBe(false);
  });

  it('accepts the bundled A1 pack as a valid level pack', () => {
    expect(isValidLevelQuestionPack(validPack)).toBe(true);
  });

  it('rejects duplicate question ids', () => {
    expect(
      isValidLevelQuestionPack({
        ...validPack,
        questions: [validPack.questions[0], validPack.questions[0]],
      }),
    ).toBe(false);
  });

  it('rejects reading questions whose correct answer exactly repeats questionText', () => {
    const source = validPack.questions.find(
      (question) => question.kind === 'choice' && question.questionText,
    );

    if (!source || source.kind !== 'choice') {
      throw new Error('Expected a choice reading question in validPack.');
    }

    expect(
      isValidLevelQuestionPack({
        ...validPack,
        questions: [
          {
            ...source,
            choices: source.choices.map((choice) =>
              choice.id === source.correctChoiceId
                ? { ...choice, text: source.questionText ?? choice.text }
                : choice,
            ),
          },
        ],
      }),
    ).toBe(false);
  });

  it('flattens cached packs in level order', () => {
    const questions = flattenCachedPacks({
      schemaVersion: 1,
      manifestPublishedAt: '2026-06-09T00:00:00.000Z',
      packs: {
        A1: {
          level: 'A1',
          version: 1,
          publishedAt: '2026-06-09T00:00:00.000Z',
          cachedAt: '2026-06-09T00:00:00.000Z',
          questions: [validPack.questions[0]],
        },
      },
    });

    expect(questions.map((question) => question.id)).toEqual([validPack.questions[0].id]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackValidation.test.ts
```

Expected: fail because `questionPackValidation.ts` does not exist.

- [ ] **Step 3: Implement validators**

Create `app/src/services/questionPackValidation.ts` with these exported functions.

```ts
import {
  LEVEL_ORDER,
  PRACTICE_QUESTION_COUNT,
  PROMOTION_EXAM_QUESTION_COUNT,
  QUESTION_PACK_SCHEMA_VERSION,
} from '../constants/learningConfig';
import type {
  CachedQuestionPackState,
  ChoiceLearningQuestion,
  LearnerLevel,
  LearningQuestion,
  LevelQuestionPack,
  QuestionPackManifest,
  QuestionPackManifestEntry,
  WritingLearningQuestion,
} from '../types/learning';

const VALID_LEVELS: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2'];
const VALID_AREAS = ['reading', 'conversation', 'grammar'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isLearnerLevel(value: unknown): value is LearnerLevel {
  return VALID_LEVELS.includes(value as LearnerLevel);
}

function isSafeRelativePackPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('packs/') &&
    value.endsWith('.json') &&
    !value.includes('..') &&
    !value.includes('://')
  );
}

function isValidChoiceQuestion(question: LearningQuestion): question is ChoiceLearningQuestion {
  if (question.kind !== 'choice') {
    return false;
  }

  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);

  if (question.choices.length !== 3 || !choiceIds.has(question.correctChoiceId) || !correctChoice) {
    return false;
  }

  if (question.questionText && correctChoice.text.trim() === question.questionText.trim()) {
    return false;
  }

  return question.choices.every(
    (choice) => choice.id.trim().length > 0 && choice.text.trim().length > 0,
  );
}

function isValidWritingQuestion(question: LearningQuestion): question is WritingLearningQuestion {
  return (
    question.kind === 'writing' &&
    typeof question.sampleAnswer === 'string' &&
    question.sampleAnswer.trim().length > 0 &&
    typeof question.evaluationFocusKo === 'string' &&
    question.evaluationFocusKo.trim().length > 0
  );
}

export function isValidLearningQuestion(value: unknown, expectedLevel?: LearnerLevel): value is LearningQuestion {
  if (!isRecord(value)) {
    return false;
  }

  const question = value as LearningQuestion;

  if (
    typeof question.id !== 'string' ||
    question.id.trim().length === 0 ||
    !isLearnerLevel(question.level) ||
    (expectedLevel && question.level !== expectedLevel) ||
    !VALID_AREAS.includes(question.area) ||
    typeof question.promptKo !== 'string' ||
    question.promptKo.trim().length === 0 ||
    typeof question.explanationKo !== 'string' ||
    question.explanationKo.trim().length === 0
  ) {
    return false;
  }

  return isValidChoiceQuestion(question) || isValidWritingQuestion(question);
}

export function isValidQuestionPackManifestEntry(value: unknown): value is QuestionPackManifestEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isLearnerLevel(value.level) &&
    isPositiveInteger(value.version) &&
    isSafeRelativePackPath(value.path) &&
    isPositiveInteger(value.questionCount)
  );
}

export function isValidQuestionPackManifest(value: unknown): value is QuestionPackManifest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === QUESTION_PACK_SCHEMA_VERSION &&
    isIsoString(value.publishedAt) &&
    Array.isArray(value.packs) &&
    value.packs.length > 0 &&
    value.packs.every(isValidQuestionPackManifestEntry)
  );
}

export function isValidLevelQuestionPack(value: unknown): value is LevelQuestionPack {
  if (!isRecord(value) || !isLearnerLevel(value.level)) {
    return false;
  }

  const level = value.level;
  const questions = value.questions;

  if (
    value.schemaVersion !== QUESTION_PACK_SCHEMA_VERSION ||
    !isPositiveInteger(value.version) ||
    !isIsoString(value.publishedAt) ||
    !Array.isArray(questions) ||
    questions.length < PRACTICE_QUESTION_COUNT * 3
  ) {
    return false;
  }

  if (level !== 'A1' && questions.length < PROMOTION_EXAM_QUESTION_COUNT + PRACTICE_QUESTION_COUNT * 3) {
    return false;
  }

  const ids = new Set<string>();

  for (const question of questions) {
    if (!isValidLearningQuestion(question, level)) {
      return false;
    }

    if (ids.has(question.id)) {
      return false;
    }

    ids.add(question.id);
  }

  return true;
}

export function flattenCachedPacks(cache: CachedQuestionPackState): LearningQuestion[] {
  return LEVEL_ORDER.flatMap((level) => cache.packs[level]?.questions ?? []);
}
```

- [ ] **Step 4: Add bundled bank validator test**

Add this import at the top of `app/src/data/questionBank.test.ts`.

```ts
import { isValidLevelQuestionPack } from '../services/questionPackValidation';
```

Append this test inside the existing `describe('questionBank', () => { ... })` block.

```ts

it('can be split into valid bundled level packs', () => {
  const levels = ['A1', 'A2', 'B1', 'B2'] as const;

  levels.forEach((level) => {
    expect(
      isValidLevelQuestionPack({
        schemaVersion: 1,
        level,
        version: 1,
        publishedAt: '2026-06-09T00:00:00.000Z',
        questions: questionBank.filter((question) => question.level === level),
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackValidation.test.ts src/data/questionBank.test.ts
```

Expected: all tests pass.

## Task 4: Implement Question Pack Cache Storage

**Files:**
- Create: `app/src/services/questionPackStorage.ts`
- Create: `app/src/services/questionPackStorage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `app/src/services/questionPackStorage.test.ts`.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUESTION_PACK_STORAGE_KEY } from '../constants/learningConfig';
import type { CachedQuestionPackState } from '../types/learning';
import { loadCachedQuestionPacks, saveCachedQuestionPacks } from './questionPackStorage';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

const validCache: CachedQuestionPackState = {
  schemaVersion: 1,
  manifestPublishedAt: '2026-06-09T00:00:00.000Z',
  packs: {
    A1: {
      level: 'A1',
      version: 1,
      publishedAt: '2026-06-09T00:00:00.000Z',
      cachedAt: '2026-06-09T00:00:00.000Z',
      questions: [],
    },
  },
};

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  asyncStorageMock.getItem.mockReset();
  asyncStorageMock.setItem.mockReset();
  asyncStorageMock.setItem.mockResolvedValue(undefined);
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
  vi.restoreAllMocks();
});

describe('questionPackStorage', () => {
  it('returns null when no cache exists', async () => {
    asyncStorageMock.getItem.mockResolvedValue(null);

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('loads a valid cached pack state', async () => {
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(validCache));

    await expect(loadCachedQuestionPacks()).resolves.toEqual(validCache);
  });

  it('returns null for malformed cached JSON', async () => {
    asyncStorageMock.getItem.mockResolvedValue('{bad');

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when cached questions do not pass validation', async () => {
    asyncStorageMock.getItem.mockResolvedValue(
      JSON.stringify({
        ...validCache,
        packs: {
          A1: {
            ...validCache.packs.A1,
            questions: [{ id: 'broken-question' }],
          },
        },
      }),
    );

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('saves the cache state under the question-pack storage key', async () => {
    await saveCachedQuestionPacks(validCache);

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      QUESTION_PACK_STORAGE_KEY,
      JSON.stringify(validCache),
    );
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackStorage.test.ts
```

Expected: fail because `questionPackStorage.ts` does not exist.

- [ ] **Step 3: Implement storage service**

Create `app/src/services/questionPackStorage.ts`.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { QUESTION_PACK_STORAGE_KEY, QUESTION_PACK_SCHEMA_VERSION } from '../constants/learningConfig';
import type { CachedLevelPack, CachedQuestionPackState, LearnerLevel } from '../types/learning';
import { isValidLearningQuestion } from './questionPackValidation';

const VALID_LEVELS: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCachedQuestionPackState(value: unknown): value is CachedQuestionPackState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== QUESTION_PACK_SCHEMA_VERSION ||
    typeof value.manifestPublishedAt !== 'string' ||
    !isRecord(value.packs)
  ) {
    return false;
  }

  const packs = value.packs;

  return VALID_LEVELS.every((level) => {
    const pack = packs[level];

    return pack === undefined || isCachedLevelPack(pack, level);
  });
}

function isCachedLevelPack(value: unknown, expectedLevel: LearnerLevel): value is CachedLevelPack {
  return (
    isRecord(value) &&
    value.level === expectedLevel &&
    typeof value.version === 'number' &&
    typeof value.publishedAt === 'string' &&
    typeof value.cachedAt === 'string' &&
    Array.isArray(value.questions) &&
    value.questions.every((question) => isValidLearningQuestion(question, expectedLevel))
  );
}

export async function loadCachedQuestionPacks(): Promise<CachedQuestionPackState | null> {
  try {
    const rawCache = await AsyncStorage.getItem(QUESTION_PACK_STORAGE_KEY);

    if (!rawCache) {
      return null;
    }

    const parsedCache = JSON.parse(rawCache);
    return isCachedQuestionPackState(parsedCache) ? parsedCache : null;
  } catch (error) {
    console.warn('Failed to load cached question packs.', error);
    return null;
  }
}

export async function saveCachedQuestionPacks(cache: CachedQuestionPackState): Promise<void> {
  await AsyncStorage.setItem(QUESTION_PACK_STORAGE_KEY, JSON.stringify(cache));
}
```

- [ ] **Step 4: Run storage tests**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackStorage.test.ts
```

Expected: all tests pass.

## Task 5: Implement Remote Question Pack Service

**Files:**
- Create: `app/src/services/questionPackService.ts`
- Create: `app/src/services/questionPackService.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `app/src/services/questionPackService.test.ts`.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { questionBank } from '../data/questionBank';
import type { CachedQuestionPackState, LevelQuestionPack, QuestionPackManifest } from '../types/learning';
import {
  buildQuestionPackSourceFromCache,
  fetchRemoteQuestionPackCache,
  getBundledQuestionPackSource,
} from './questionPackService';

const manifest: QuestionPackManifest = {
  schemaVersion: 1,
  publishedAt: '2026-06-09T00:00:00.000Z',
  packs: [
    {
      level: 'A1',
      version: 1,
      path: 'packs/a1.v1.json',
      questionCount: questionBank.filter((question) => question.level === 'A1').length,
    },
  ],
};

const a1Pack: LevelQuestionPack = {
  schemaVersion: 1,
  level: 'A1',
  version: 1,
  publishedAt: '2026-06-09T00:00:00.000Z',
  questions: questionBank.filter((question) => question.level === 'A1'),
};

const cache: CachedQuestionPackState = {
  schemaVersion: 1,
  manifestPublishedAt: manifest.publishedAt,
  packs: {
    A1: {
      level: 'A1',
      version: 1,
      publishedAt: a1Pack.publishedAt,
      cachedAt: '2026-06-09T00:01:00.000Z',
      questions: a1Pack.questions,
    },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-09T00:02:00.000Z'));
});

describe('questionPackService', () => {
  it('returns bundled question source when no cache is available', () => {
    const source = getBundledQuestionPackSource();

    expect(source.origin).toBe('bundled');
    expect(source.questions).toEqual(questionBank);
    expect(source.cachedState).toBeNull();
  });

  it('builds a cache source from cached packs', () => {
    const source = buildQuestionPackSourceFromCache(cache);

    expect(source.origin).toBe('cache');
    expect(source.questions.map((question) => question.id)).toEqual(
      a1Pack.questions.map((question) => question.id),
    );
  });

  it('downloads valid remote packs into a new cache state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: true, json: async () => a1Pack });

    const nextCache = await fetchRemoteQuestionPackCache({
      baseUrl: 'https://example.test/question-packs',
      fetchImpl: fetchMock,
    });

    expect(nextCache?.manifestPublishedAt).toBe(manifest.publishedAt);
    expect(nextCache?.packs.A1?.version).toBe(1);
    expect(nextCache?.packs.A1?.cachedAt).toBe('2026-06-09T00:02:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/question-packs/manifest.json');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/question-packs/packs/a1.v1.json');
  });

  it('returns null when the remote manifest cannot be fetched', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(
      fetchRemoteQuestionPackCache({
        baseUrl: 'https://example.test/question-packs',
        fetchImpl: fetchMock,
      }),
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackService.test.ts
```

Expected: fail because `questionPackService.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `app/src/services/questionPackService.ts`.

```ts
import { REMOTE_QUESTION_PACK_BASE_URL } from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  CachedQuestionPackState,
  CachedLevelPack,
  LevelQuestionPack,
  QuestionPackManifest,
  QuestionPackSource,
} from '../types/learning';
import {
  flattenCachedPacks,
  isValidLevelQuestionPack,
  isValidQuestionPackManifest,
} from './questionPackValidation';

type FetchLike = (input: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

type FetchRemoteQuestionPackCacheOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
};

function joinPackUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function getBundledQuestionPackSource(): QuestionPackSource {
  return {
    origin: 'bundled',
    questions: questionBank,
    cachedState: null,
  };
}

export function buildQuestionPackSourceFromCache(cache: CachedQuestionPackState | null): QuestionPackSource {
  const questions = cache ? flattenCachedPacks(cache) : [];

  if (!cache || questions.length === 0) {
    return getBundledQuestionPackSource();
  }

  return {
    origin: 'cache',
    questions,
    cachedState: cache,
  };
}

async function fetchJson(url: string, fetchImpl: FetchLike): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url);
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

async function fetchLevelPack(
  manifest: QuestionPackManifest,
  entry: QuestionPackManifest['packs'][number],
  baseUrl: string,
  fetchImpl: FetchLike,
): Promise<CachedLevelPack | null> {
  const rawPack = await fetchJson(joinPackUrl(baseUrl, entry.path), fetchImpl);

  if (!isValidLevelQuestionPack(rawPack)) {
    return null;
  }

  const pack: LevelQuestionPack = rawPack;

  if (pack.level !== entry.level || pack.version !== entry.version || pack.questions.length !== entry.questionCount) {
    return null;
  }

  return {
    level: pack.level,
    version: pack.version,
    publishedAt: pack.publishedAt,
    cachedAt: new Date().toISOString(),
    questions: pack.questions,
  };
}

export async function fetchRemoteQuestionPackCache(
  options: FetchRemoteQuestionPackCacheOptions = {},
): Promise<CachedQuestionPackState | null> {
  const baseUrl = options.baseUrl ?? REMOTE_QUESTION_PACK_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const rawManifest = await fetchJson(joinPackUrl(baseUrl, 'manifest.json'), fetchImpl);

  if (!isValidQuestionPackManifest(rawManifest)) {
    return null;
  }

  const manifest: QuestionPackManifest = rawManifest;
  const entries = await Promise.all(
    manifest.packs.map((entry) => fetchLevelPack(manifest, entry, baseUrl, fetchImpl)),
  );

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  const cachedPacks = entries.reduce<CachedQuestionPackState['packs']>((packs, entry) => {
    if (entry) {
      packs[entry.level] = entry;
    }

    return packs;
  }, {});

  return {
    schemaVersion: 1,
    manifestPublishedAt: manifest.publishedAt,
    packs: cachedPacks,
  };
}
```

- [ ] **Step 4: Run service tests**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackService.test.ts
```

Expected: all tests pass.

## Task 6: Integrate Cache Loading and Background Refresh

**Files:**
- Modify: `app/src/services/questionPackService.ts`
- Modify: `app/src/services/questionPackService.test.ts`
- Modify: `app/App.tsx`

- [ ] **Step 1: Add load and refresh tests**

Extend the existing `./questionPackService` import in `app/src/services/questionPackService.test.ts` to include `loadQuestionPackSource` and `refreshQuestionPackCache`.

```ts
import {
  buildQuestionPackSourceFromCache,
  fetchRemoteQuestionPackCache,
  getBundledQuestionPackSource,
  loadQuestionPackSource,
  refreshQuestionPackCache,
} from './questionPackService';
```

Append these tests inside the existing `describe('questionPackService', () => { ... })` block.

```ts

it('loads cached question packs before falling back to bundled questions', async () => {
  const loadCachedQuestionPacks = vi.fn().mockResolvedValue(cache);

  const source = await loadQuestionPackSource({ loadCachedQuestionPacks });

  expect(source.origin).toBe('cache');
  expect(source.questions).toHaveLength(a1Pack.questions.length);
});

it('falls back to bundled questions when cache loading returns null', async () => {
  const loadCachedQuestionPacks = vi.fn().mockResolvedValue(null);

  const source = await loadQuestionPackSource({ loadCachedQuestionPacks });

  expect(source.origin).toBe('bundled');
  expect(source.questions).toEqual(questionBank);
});

it('saves remote cache when refresh succeeds', async () => {
  const nextCache = {
    schemaVersion: 1 as const,
    manifestPublishedAt: manifest.publishedAt,
    packs: cache.packs,
  };
  const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(nextCache);
  const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);

  const source = await refreshQuestionPackCache({
    fetchRemoteQuestionPackCache,
    saveCachedQuestionPacks,
  });

  expect(saveCachedQuestionPacks).toHaveBeenCalledWith(nextCache);
  expect(source?.origin).toBe('remote');
});

it('does not replace the source when refresh fails', async () => {
  const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(null);
  const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);

  await expect(
    refreshQuestionPackCache({
      fetchRemoteQuestionPackCache,
      saveCachedQuestionPacks,
    }),
  ).resolves.toBeNull();
  expect(saveCachedQuestionPacks).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add load and refresh implementation**

Extend `app/src/services/questionPackService.ts`.

```ts
import {
  loadCachedQuestionPacks as loadCachedQuestionPacksFromStorage,
  saveCachedQuestionPacks as saveCachedQuestionPacksToStorage,
} from './questionPackStorage';

type LoadQuestionPackSourceOptions = {
  loadCachedQuestionPacks?: typeof loadCachedQuestionPacksFromStorage;
};

type RefreshQuestionPackCacheOptions = {
  fetchRemoteQuestionPackCache?: typeof fetchRemoteQuestionPackCache;
  saveCachedQuestionPacks?: typeof saveCachedQuestionPacksToStorage;
};

export async function loadQuestionPackSource(
  options: LoadQuestionPackSourceOptions = {},
): Promise<QuestionPackSource> {
  const loadCachedQuestionPacks = options.loadCachedQuestionPacks ?? loadCachedQuestionPacksFromStorage;
  const cache = await loadCachedQuestionPacks();

  return buildQuestionPackSourceFromCache(cache);
}

export async function refreshQuestionPackCache(
  options: RefreshQuestionPackCacheOptions = {},
): Promise<QuestionPackSource | null> {
  const fetchCache = options.fetchRemoteQuestionPackCache ?? fetchRemoteQuestionPackCache;
  const saveCache = options.saveCachedQuestionPacks ?? saveCachedQuestionPacksToStorage;
  const nextCache = await fetchCache();

  if (!nextCache) {
    return null;
  }

  await saveCache(nextCache);

  return {
    origin: 'remote',
    questions: flattenCachedPacks(nextCache),
    cachedState: nextCache,
  };
}
```

- [ ] **Step 3: Run service tests**

Run:

```powershell
npm.cmd test -- --run src/services/questionPackService.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Wire `App.tsx` to the question source**

Modify `app/App.tsx`:

```ts
import { loadQuestionPackSource, refreshQuestionPackCache } from './src/services/questionPackService';
import type { QuestionPackSource } from './src/types/learning';
```

Add refs/state near existing refs:

```ts
const [questionPackSource, setQuestionPackSource] = useState<QuestionPackSource | null>(null);
const questionPackSourceRef = useRef<QuestionPackSource | null>(null);

function updateQuestionPackSource(nextSource: QuestionPackSource) {
  questionPackSourceRef.current = nextSource;
  setQuestionPackSource(nextSource);
}

function getCurrentQuestions() {
  return questionPackSourceRef.current?.questions ?? [];
}
```

Change `loadInitialState`:

```ts
const [loadedState, loadedQuestionPackSource] = await Promise.all([
  loadLearningState(),
  loadQuestionPackSource(),
]);
const session = createPracticeSession(loadedState, loadedQuestionPackSource.questions);

updateLearningState(loadedState);
updateQuestionPackSource(loadedQuestionPackSource);
updateActiveSession(session);
setPendingStorageSave(null);
setMode('practice');

void refreshQuestionPackCache().then((refreshedSource) => {
  if (refreshedSource) {
    updateQuestionPackSource(refreshedSource);
  }
});
```

Change `startPractice`:

```ts
const session = createPracticeSession(nextState, getCurrentQuestions());
```

Change `startPromotionExam`:

```ts
const session = createPromotionExamSession(currentLearningState, getCurrentQuestions());
```

Change loading guard so a missing source also shows loading:

```ts
if (mode === 'loading' || !learningState || !questionPackSource) {
```

- [ ] **Step 5: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: pass.

## Task 7: Add Firebase Hosting Static Pack Files

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `public/question-packs/manifest.json`
- Create: `public/question-packs/packs/a1.v1.json`
- Create: `public/question-packs/packs/a2.v1.json`
- Create: `public/question-packs/packs/b1.v1.json`
- Create: `public/question-packs/packs/b2.v1.json`

- [ ] **Step 1: Add Firebase project config**

Create `.firebaserc`.

```json
{
  "projects": {
    "default": "englishproject-c42b2"
  }
}
```

Create `firebase.json`.

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "/question-packs/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=300"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Export current bundled questions to JSON packs**

Run this command from `C:\Users\woung\Desktop\EnglishProject`. It uses the existing local `typescript` package from `app/node_modules`, transpiles `questionBank.ts` in memory, and writes JSON pack files.

```powershell
@'
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('./app/node_modules/typescript');

const sourcePath = path.join(process.cwd(), 'app', 'src', 'data', 'questionBank.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleInstance = new Module(sourcePath);
moduleInstance._compile(compiled.outputText, sourcePath);

const { questionBank } = moduleInstance.exports;
const root = path.join(process.cwd(), 'public', 'question-packs');
const levels = ['A1', 'A2', 'B1', 'B2'];
const publishedAt = '2026-06-09T00:00:00.000Z';

fs.mkdirSync(path.join(root, 'packs'), { recursive: true });

const packs = levels.map((level) => {
  const questions = questionBank.filter((question) => question.level === level);
  const packPath = `packs/${level.toLowerCase()}.v1.json`;
  const pack = {
    schemaVersion: 1,
    level,
    version: 1,
    publishedAt,
    questions,
  };

  fs.writeFileSync(path.join(root, packPath), `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

  return {
    level,
    version: 1,
    path: packPath,
    questionCount: questions.length,
  };
});

fs.writeFileSync(
  path.join(root, 'manifest.json'),
  `${JSON.stringify({ schemaVersion: 1, publishedAt, packs }, null, 2)}\n`,
  'utf8',
);
'@ | node
```

- [ ] **Step 3: Validate generated pack files with tests**

Add this test file as `app/src/services/hostedQuestionPacks.test.ts`.

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isValidLevelQuestionPack, isValidQuestionPackManifest } from './questionPackValidation';

const root = join(process.cwd(), '..', 'public', 'question-packs');

describe('hosted question packs', () => {
  it('has a valid manifest and valid level packs', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

    expect(isValidQuestionPackManifest(manifest)).toBe(true);

    manifest.packs.forEach((entry: { path: string; questionCount: number }) => {
      const pack = JSON.parse(readFileSync(join(root, entry.path), 'utf8'));

      expect(isValidLevelQuestionPack(pack)).toBe(true);
      expect(pack.questions).toHaveLength(entry.questionCount);
    });
  });
});
```

- [ ] **Step 4: Run hosted pack tests**

Run:

```powershell
npm.cmd test -- --run src/services/hostedQuestionPacks.test.ts
```

Expected: pass.

## Task 8: Verify App Behavior and Deploy Readiness

**Files:**
- No new production files unless tests reveal a defect.

- [ ] **Step 1: Run full app tests**

Run from `C:\Users\woung\Desktop\EnglishProject\app`:

```powershell
npm.cmd test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run from `C:\Users\woung\Desktop\EnglishProject\app`:

```powershell
npm.cmd run typecheck
```

Expected: pass.

- [ ] **Step 3: Check server syntax**

Run from `C:\Users\woung\Desktop\EnglishProject`:

```powershell
node --check server\index.mjs
```

Expected: no syntax errors.

- [ ] **Step 4: Verify Firebase project selection**

Run from `C:\Users\woung\Desktop\EnglishProject`:

```powershell
firebase.cmd use
```

Expected output includes:

```text
englishproject-c42b2
```

- [ ] **Step 5: Do not deploy until the user approves**

Prepare the deploy command, but do not run it without a direct approval message.

```powershell
firebase.cmd deploy --only hosting
```

- [ ] **Step 6: Browser QA after local app starts**

Run the app server if it is not already running:

```powershell
npm.cmd run web
```

Open the app in the in-app browser and verify:

- First screen shows a practice question without waiting for a visible download step.
- Answering three questions still reaches the explanation + Rate screen.
- Promotion exam still uses the dark UI.
- Browser console has no errors from question-pack loading.

## Task 9: Review and Commit

**Files:**
- All files changed by Tasks 1-8.

- [ ] **Step 1: Review diff scope**

Run:

```powershell
git status --short
git diff -- app/src/services/questionSelector.ts app/src/services/sessionService.ts app/src/services/questionPackValidation.ts app/src/services/questionPackStorage.ts app/src/services/questionPackService.ts app/App.tsx firebase.json .firebaserc public/question-packs/manifest.json
```

Expected: only Firebase question-pack and app source-loading changes appear in the reviewed diff.

- [ ] **Step 2: Run subagent spec review**

Dispatch a review agent with this prompt:

```text
Review the Firebase Hosting question-pack implementation against docs/superpowers/specs/2026-06-09-firebase-hosting-question-packs-design.md. Focus on whether app launch remains immediate, fallback works, remote pack validation is strict enough, and learner state remains local.
```

- [ ] **Step 3: Run subagent code quality review**

Dispatch a review agent with this prompt:

```text
Review the Firebase Hosting question-pack implementation for TypeScript quality, test coverage, hidden coupling, async race conditions in App.tsx, and accidental client-side secret exposure.
```

- [ ] **Step 4: Apply valid review fixes**

For every accepted review finding, add or update a failing test first, then implement the minimal fix and rerun the focused tests.

- [ ] **Step 5: Run final verification**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
node --check ..\server\index.mjs
```

Expected: all commands pass from `C:\Users\woung\Desktop\EnglishProject\app`, except the `node --check` command points to the parent `server` directory.

- [ ] **Step 6: Commit after approval**

Commit only after the user approves the implementation diff.

```powershell
git add app/src app/App.tsx firebase.json .firebaserc public/question-packs
git commit -m "feat: load question packs from Firebase Hosting"
```
