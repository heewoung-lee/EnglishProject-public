# Simple Rate Learning Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 실행 즉시 문제를 보여주고, 문제 풀이 후 해설과 레이트를 표시하며, 기준 레이트 도달 시 승급 시험으로 이어지는 단순 학습 플로우를 구현한다.

**Architecture:** `App.tsx`가 화면 모드와 최상위 상태를 관리하고, 계산과 저장은 작은 service 파일로 분리한다. 문제는 앱 내부 seed data로 시작하고, 학습 상태는 `AsyncStorage`에 JSON으로 저장한다.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, `@react-native-async-storage/async-storage`.

---

## File Structure

- Modify: `app/package.json` - `@react-native-async-storage/async-storage` 의존성 추가.
- Modify: `app/package-lock.json` - 의존성 lock 업데이트.
- Replace: `app/App.tsx` - 기존 시작 흐름을 단순 문제 우선 플로우로 교체.
- Create: `app/src/types/learning.ts` - 레벨, 문제, 세션, 결과, 로컬 상태 타입.
- Create: `app/src/constants/learningConfig.ts` - 문제 수, 레이트 기준, 저장 key 상수.
- Create: `app/src/data/questionBank.ts` - A1/A2 seed 문제.
- Create: `app/src/services/rateService.ts` - 레이트와 승급 결과 계산.
- Create: `app/src/services/questionSelector.ts` - 일반 문제와 승급 시험 문제 선택.
- Create: `app/src/services/sessionService.ts` - 세션 생성, 답 제출, 결과 생성.
- Create: `app/src/services/learningStorage.ts` - 로컬 상태 로드/저장/초기화.
- Create: `app/src/screens/PracticeQuestionScreen.tsx` - 일반 문제 화면.
- Create: `app/src/screens/PracticeResultScreen.tsx` - 해설 + 레이트 화면.
- Create: `app/src/screens/PromotionExamScreen.tsx` - 승급 시험 화면.
- Create: `app/src/screens/PromotionResultScreen.tsx` - 승급 결과 화면.

## Task 1: Types And Constants

**Files:**
- Create: `app/src/types/learning.ts`
- Create: `app/src/constants/learningConfig.ts`

- [ ] **Step 1: Create learning types**

Create `app/src/types/learning.ts`:

```ts
export type LearnerLevel = 'A1' | 'A2' | 'B1' | 'B2';

export type AppMode =
  | 'loading'
  | 'practice'
  | 'practiceResult'
  | 'promotionExam'
  | 'promotionResult';

export type QuestionKind = 'choice';

export type QuestionChoice = {
  id: string;
  text: string;
};

export type LearningQuestion = {
  id: string;
  level: LearnerLevel;
  kind: QuestionKind;
  promptKo: string;
  questionText?: string;
  choices: QuestionChoice[];
  correctChoiceId: string;
  explanationKo: string;
  weakPointLabel?: string;
};

export type RecentResult = {
  questionSetId: string;
  level: LearnerLevel;
  score: number;
  rateAfter: number;
  solvedAt: string;
};

export type LocalLearningState = {
  currentLevel: LearnerLevel;
  currentRate: number;
  solvedQuestionCount: number;
  promotionReady: boolean;
  recentResults: RecentResult[];
  updatedAt: string;
};

export type SubmittedAnswer = {
  questionId: string;
  selectedChoiceId: string;
};

export type ActiveSession = {
  id: string;
  mode: 'practice' | 'promotionExam';
  level: LearnerLevel;
  questions: LearningQuestion[];
  currentQuestionIndex: number;
  answers: SubmittedAnswer[];
};

export type QuestionExplanation = {
  questionId: string;
  promptKo: string;
  selectedChoiceText: string;
  correctChoiceText: string;
  isCorrect: boolean;
  explanationKo: string;
  weakPointLabel?: string;
};

export type PracticeSessionResult = {
  sessionId: string;
  level: LearnerLevel;
  previousRate: number;
  nextRate: number;
  correctCount: number;
  totalCount: number;
  score: number;
  promotionReady: boolean;
  explanations: QuestionExplanation[];
};

export type PromotionExamResult = {
  sessionId: string;
  fromLevel: LearnerLevel;
  toLevel: LearnerLevel | null;
  passed: boolean;
  score: number;
  passScore: number;
  nextRate: number;
};
```

- [ ] **Step 2: Create learning constants**

Create `app/src/constants/learningConfig.ts`:

```ts
import type { LearnerLevel } from '../types/learning';

export const LEARNING_STORAGE_KEY = 'englishProject.learningState.v1';

export const LEVEL_ORDER: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2'];

export const PRACTICE_QUESTION_COUNT = 3;

export const PROMOTION_EXAM_QUESTION_COUNT = 5;

export const PROMOTION_RATE_THRESHOLD = 80;

export const PROMOTION_PASS_SCORE = 80;

export const INITIAL_RATE = 0;

export const PROMOTION_SUCCESS_RATE = 0;

export const PROMOTION_FAILURE_RATE = 70;
```

- [ ] **Step 3: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/learning.ts app/src/constants/learningConfig.ts
git commit -m "feat: add learning flow types"
```

## Task 2: Seed Question Data

**Files:**
- Create: `app/src/data/questionBank.ts`

- [ ] **Step 1: Create question bank**

Create `app/src/data/questionBank.ts`:

```ts
import type { LearningQuestion } from '../types/learning';

export const questionBank: LearningQuestion[] = [
  {
    id: 'a1-choice-article-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '가장 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I want a coffee.' },
      { id: 'b', text: 'I want coffee a.' },
      { id: 'c', text: 'I wants a coffee.' },
    ],
    correctChoiceId: 'a',
    explanationKo: '"I want a coffee."가 자연스럽습니다. 관사 a는 명사 앞에 옵니다.',
    weakPointLabel: '관사',
  },
  {
    id: 'a1-choice-verb-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '주어와 동사가 맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'She like apples.' },
      { id: 'b', text: 'She likes apples.' },
      { id: 'c', text: 'She liking apples.' },
    ],
    correctChoiceId: 'b',
    explanationKo: '3인칭 단수 주어 she에는 동사 likes를 씁니다.',
    weakPointLabel: '동사 형태',
  },
  {
    id: 'a1-choice-preposition-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '빈칸에 들어갈 말로 알맞은 것을 고르세요.',
    questionText: 'I go to school ___ Monday.',
    choices: [
      { id: 'a', text: 'on' },
      { id: 'b', text: 'in' },
      { id: 'c', text: 'at' },
    ],
    correctChoiceId: 'a',
    explanationKo: '요일 앞에는 전치사 on을 씁니다.',
    weakPointLabel: '전치사',
  },
  {
    id: 'a1-choice-tense-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '어제 한 일을 말하는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I visit my friend yesterday.' },
      { id: 'b', text: 'I visited my friend yesterday.' },
      { id: 'c', text: 'I visiting my friend yesterday.' },
    ],
    correctChoiceId: 'b',
    explanationKo: 'yesterday는 과거 표현이므로 visited를 씁니다.',
    weakPointLabel: '시제',
  },
  {
    id: 'a1-choice-question-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '질문으로 가장 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'Where you live?' },
      { id: 'b', text: 'Where do you live?' },
      { id: 'c', text: 'Where are live?' },
    ],
    correctChoiceId: 'b',
    explanationKo: '일반동사 질문에는 do를 사용해 "Where do you live?"라고 말합니다.',
    weakPointLabel: '질문 구조',
  },
  {
    id: 'a1-choice-word-order-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '어순이 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I every day study English.' },
      { id: 'b', text: 'I study English every day.' },
      { id: 'c', text: 'Every study I English day.' },
    ],
    correctChoiceId: 'b',
    explanationKo: '기본 어순은 주어 + 동사 + 목적어이며, every day는 뒤에 붙일 수 있습니다.',
    weakPointLabel: '어순',
  },
  {
    id: 'a1-choice-negative-001',
    level: 'A1',
    kind: 'choice',
    promptKo: '부정문으로 맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I do not like milk.' },
      { id: 'b', text: 'I not like milk.' },
      { id: 'c', text: 'I does not like milk.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'I에는 do not을 사용합니다.',
    weakPointLabel: '부정문',
  },
  {
    id: 'a1-choice-be-verb-001',
    level: 'A1',
    kind: 'choice',
    promptKo: 'be동사가 맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I am a student.' },
      { id: 'b', text: 'I is a student.' },
      { id: 'c', text: 'I are a student.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'I와 함께 쓰는 be동사는 am입니다.',
    weakPointLabel: 'be동사',
  },
  {
    id: 'a2-choice-tense-001',
    level: 'A2',
    kind: 'choice',
    promptKo: '현재완료 문장으로 자연스러운 것을 고르세요.',
    choices: [
      { id: 'a', text: 'I have visited Busan.' },
      { id: 'b', text: 'I has visited Busan.' },
      { id: 'c', text: 'I have visit Busan.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'I에는 have를 쓰고, 현재완료는 have + 과거분사 형태입니다.',
    weakPointLabel: '현재완료',
  },
  {
    id: 'a2-choice-comparative-001',
    level: 'A2',
    kind: 'choice',
    promptKo: '비교 표현으로 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'This bag is more cheap than that one.' },
      { id: 'b', text: 'This bag is cheaper than that one.' },
      { id: 'c', text: 'This bag is cheap than that one.' },
    ],
    correctChoiceId: 'b',
    explanationKo: 'short adjective인 cheap은 cheaper than 형태로 비교합니다.',
    weakPointLabel: '비교급',
  },
  {
    id: 'a2-choice-modal-001',
    level: 'A2',
    kind: 'choice',
    promptKo: '조동사 뒤 동사 형태가 맞는 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'I can to swim.' },
      { id: 'b', text: 'I can swimming.' },
      { id: 'c', text: 'I can swim.' },
    ],
    correctChoiceId: 'c',
    explanationKo: '조동사 can 뒤에는 동사원형 swim을 씁니다.',
    weakPointLabel: '조동사',
  },
  {
    id: 'a2-choice-condition-001',
    level: 'A2',
    kind: 'choice',
    promptKo: '조건문으로 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'If it rains, I will stay home.' },
      { id: 'b', text: 'If it will rain, I stay home.' },
      { id: 'c', text: 'If rains, I will stay home.' },
    ],
    correctChoiceId: 'a',
    explanationKo: 'if절에는 현재형 rains를 쓰고, 결과절에는 will을 쓸 수 있습니다.',
    weakPointLabel: '조건문',
  },
  {
    id: 'a2-choice-request-001',
    level: 'A2',
    kind: 'choice',
    promptKo: '정중한 요청으로 가장 자연스러운 문장을 고르세요.',
    choices: [
      { id: 'a', text: 'Give me water.' },
      { id: 'b', text: 'Could I have some water?' },
      { id: 'c', text: 'Water now.' },
    ],
    correctChoiceId: 'b',
    explanationKo: 'Could I have some water?는 정중한 요청 표현입니다.',
    weakPointLabel: '정중한 표현',
  },
];
```

- [ ] **Step 2: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/data/questionBank.ts
git commit -m "feat: add seed learning questions"
```

## Task 3: Rate And Selection Services

**Files:**
- Create: `app/src/services/rateService.ts`
- Create: `app/src/services/questionSelector.ts`

- [ ] **Step 1: Create rate service**

Create `app/src/services/rateService.ts`:

```ts
import {
  LEVEL_ORDER,
  PROMOTION_FAILURE_RATE,
  PROMOTION_PASS_SCORE,
  PROMOTION_RATE_THRESHOLD,
  PROMOTION_SUCCESS_RATE,
} from '../constants/learningConfig';
import type { LearnerLevel, PromotionExamResult } from '../types/learning';

export function clampRate(rate: number): number {
  return Math.max(0, Math.min(100, Math.round(rate)));
}

export function calculateNextRate(currentRate: number, correctCount: number, totalCount: number): number {
  const deltaByCorrectCount: Record<number, number> = {
    0: -4,
    1: 2,
    2: 6,
    3: 10,
  };
  const delta = totalCount === 3 ? deltaByCorrectCount[correctCount] ?? 0 : Math.round((correctCount / totalCount) * 10);

  return clampRate(currentRate + delta);
}

export function isPromotionReady(rate: number): boolean {
  return rate >= PROMOTION_RATE_THRESHOLD;
}

export function calculateExamScore(correctCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((correctCount / totalCount) * 100);
}

export function getNextLevel(level: LearnerLevel): LearnerLevel | null {
  const currentIndex = LEVEL_ORDER.indexOf(level);
  const nextLevel = LEVEL_ORDER[currentIndex + 1];

  return nextLevel ?? null;
}

export function calculatePromotionResult(
  currentLevel: LearnerLevel,
  score: number,
): Pick<PromotionExamResult, 'toLevel' | 'passed' | 'nextRate'> {
  const passed = score >= PROMOTION_PASS_SCORE;

  return {
    passed,
    toLevel: passed ? getNextLevel(currentLevel) : null,
    nextRate: passed ? PROMOTION_SUCCESS_RATE : PROMOTION_FAILURE_RATE,
  };
}
```

- [ ] **Step 2: Create question selector service**

Create `app/src/services/questionSelector.ts`:

```ts
import {
  LEVEL_ORDER,
  PRACTICE_QUESTION_COUNT,
  PROMOTION_EXAM_QUESTION_COUNT,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type { LearnerLevel, LearningQuestion, RecentResult } from '../types/learning';
import { getNextLevel } from './rateService';

function takeQuestions(questions: LearningQuestion[], count: number): LearningQuestion[] {
  return questions.slice(0, count);
}

export function selectPracticeQuestions(level: LearnerLevel, recentResults: RecentResult[]): LearningQuestion[] {
  const recentQuestionSetIds = new Set(recentResults.slice(-3).map((result) => result.questionSetId));
  const levelQuestions = questionBank.filter((question) => question.level === level);
  const freshQuestions = levelQuestions.filter((question) => !recentQuestionSetIds.has(question.id));
  const source = freshQuestions.length >= PRACTICE_QUESTION_COUNT ? freshQuestions : levelQuestions;

  return takeQuestions(source, PRACTICE_QUESTION_COUNT);
}

export function selectPromotionExamQuestions(currentLevel: LearnerLevel): LearningQuestion[] {
  const nextLevel = getNextLevel(currentLevel);

  if (!nextLevel) {
    return [];
  }

  const nextLevelQuestions = questionBank.filter((question) => question.level === nextLevel);
  const currentLevelQuestions = questionBank.filter((question) => question.level === currentLevel);
  const source = [...nextLevelQuestions, ...currentLevelQuestions];

  return takeQuestions(source, PROMOTION_EXAM_QUESTION_COUNT);
}

export function getLevelLabel(level: LearnerLevel): string {
  const levelIndex = LEVEL_ORDER.indexOf(level);

  return LEVEL_ORDER[levelIndex] ?? LEVEL_ORDER[0];
}
```

- [ ] **Step 3: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/services/rateService.ts app/src/services/questionSelector.ts
git commit -m "feat: add rate and question selection services"
```

## Task 4: Session Service

**Files:**
- Create: `app/src/services/sessionService.ts`

- [ ] **Step 1: Create session service**

Create `app/src/services/sessionService.ts`:

```ts
import { PROMOTION_PASS_SCORE } from '../constants/learningConfig';
import type {
  ActiveSession,
  LocalLearningState,
  PracticeSessionResult,
  PromotionExamResult,
  QuestionExplanation,
  SubmittedAnswer,
} from '../types/learning';
import { selectPracticeQuestions, selectPromotionExamQuestions } from './questionSelector';
import {
  calculateExamScore,
  calculateNextRate,
  calculatePromotionResult,
  isPromotionReady,
} from './rateService';

function createSessionId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function getCorrectCount(session: ActiveSession): number {
  return session.answers.filter((answer) => {
    const question = session.questions.find((item) => item.id === answer.questionId);

    return question?.correctChoiceId === answer.selectedChoiceId;
  }).length;
}

function buildExplanations(session: ActiveSession): QuestionExplanation[] {
  return session.questions.map((question) => {
    const answer = session.answers.find((item) => item.questionId === question.id);
    const selectedChoice = question.choices.find((choice) => choice.id === answer?.selectedChoiceId);
    const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);

    return {
      questionId: question.id,
      promptKo: question.promptKo,
      selectedChoiceText: selectedChoice?.text ?? '',
      correctChoiceText: correctChoice?.text ?? '',
      isCorrect: answer?.selectedChoiceId === question.correctChoiceId,
      explanationKo: question.explanationKo,
      weakPointLabel: question.weakPointLabel,
    };
  });
}

export function createPracticeSession(state: LocalLearningState): ActiveSession {
  return {
    id: createSessionId('practice'),
    mode: 'practice',
    level: state.currentLevel,
    questions: selectPracticeQuestions(state.currentLevel, state.recentResults),
    currentQuestionIndex: 0,
    answers: [],
  };
}

export function createPromotionExamSession(state: LocalLearningState): ActiveSession {
  return {
    id: createSessionId('promotion'),
    mode: 'promotionExam',
    level: state.currentLevel,
    questions: selectPromotionExamQuestions(state.currentLevel),
    currentQuestionIndex: 0,
    answers: [],
  };
}

export function submitAnswer(session: ActiveSession, selectedChoiceId: string): ActiveSession {
  const currentQuestion = session.questions[session.currentQuestionIndex];

  if (!currentQuestion) {
    return session;
  }

  const nextAnswer: SubmittedAnswer = {
    questionId: currentQuestion.id,
    selectedChoiceId,
  };

  return {
    ...session,
    answers: [...session.answers, nextAnswer],
    currentQuestionIndex: session.currentQuestionIndex + 1,
  };
}

export function isSessionComplete(session: ActiveSession): boolean {
  return session.answers.length >= session.questions.length;
}

export function buildPracticeResult(
  state: LocalLearningState,
  session: ActiveSession,
): PracticeSessionResult {
  const correctCount = getCorrectCount(session);
  const totalCount = session.questions.length;
  const nextRate = calculateNextRate(state.currentRate, correctCount, totalCount);

  return {
    sessionId: session.id,
    level: state.currentLevel,
    previousRate: state.currentRate,
    nextRate,
    correctCount,
    totalCount,
    score: calculateExamScore(correctCount, totalCount),
    promotionReady: isPromotionReady(nextRate),
    explanations: buildExplanations(session),
  };
}

export function buildPromotionExamResult(
  state: LocalLearningState,
  session: ActiveSession,
): PromotionExamResult {
  const correctCount = getCorrectCount(session);
  const score = calculateExamScore(correctCount, session.questions.length);
  const promotion = calculatePromotionResult(state.currentLevel, score);

  return {
    sessionId: session.id,
    fromLevel: state.currentLevel,
    toLevel: promotion.toLevel,
    passed: promotion.passed,
    score,
    passScore: PROMOTION_PASS_SCORE,
    nextRate: promotion.nextRate,
  };
}
```

- [ ] **Step 2: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/src/services/sessionService.ts
git commit -m "feat: add learning session service"
```

## Task 5: Local Storage

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Create: `app/src/services/learningStorage.ts`

- [ ] **Step 1: Install AsyncStorage**

Run:

```bash
cd app
npx expo install @react-native-async-storage/async-storage
```

Expected: `app/package.json` includes `@react-native-async-storage/async-storage`, and `app/package-lock.json` updates.

- [ ] **Step 2: Create storage service**

Create `app/src/services/learningStorage.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { INITIAL_RATE, LEARNING_STORAGE_KEY } from '../constants/learningConfig';
import type { LocalLearningState } from '../types/learning';

export function createDefaultLearningState(): LocalLearningState {
  return {
    currentLevel: 'A1',
    currentRate: INITIAL_RATE,
    solvedQuestionCount: 0,
    promotionReady: false,
    recentResults: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadLearningState(): Promise<LocalLearningState> {
  try {
    const rawState = await AsyncStorage.getItem(LEARNING_STORAGE_KEY);

    if (!rawState) {
      const defaultState = createDefaultLearningState();
      await saveLearningState(defaultState);
      return defaultState;
    }

    return JSON.parse(rawState) as LocalLearningState;
  } catch (error) {
    console.warn('Failed to load learning state.', error);
    return createDefaultLearningState();
  }
}

export async function saveLearningState(state: LocalLearningState): Promise<void> {
  const nextState: LocalLearningState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn('Failed to save learning state.', error);
  }
}

export async function resetLearningState(): Promise<LocalLearningState> {
  const defaultState = createDefaultLearningState();
  await saveLearningState(defaultState);
  return defaultState;
}
```

- [ ] **Step 3: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/src/services/learningStorage.ts
git commit -m "feat: add local learning state storage"
```

## Task 6: Practice Screens

**Files:**
- Create: `app/src/screens/PracticeQuestionScreen.tsx`
- Create: `app/src/screens/PracticeResultScreen.tsx`

- [ ] **Step 1: Create practice question screen**

Create `app/src/screens/PracticeQuestionScreen.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActiveSession, LearnerLevel } from '../types/learning';

type PracticeQuestionScreenProps = {
  level: LearnerLevel;
  rate: number;
  session: ActiveSession;
  onSubmitAnswer: (choiceId: string) => void;
};

export function PracticeQuestionScreen({
  level,
  rate,
  session,
  onSubmitAnswer,
}: PracticeQuestionScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const question = session.questions[session.currentQuestionIndex];
  const progressText = `${Math.min(session.currentQuestionIndex + 1, session.questions.length)} / ${session.questions.length}`;
  const canSubmit = Boolean(selectedChoiceId);

  const choices = useMemo(() => question?.choices ?? [], [question]);

  if (!question) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>문제</Text>
      </View>
    );
  }

  function submitSelectedAnswer() {
    if (!selectedChoiceId) return;
    onSubmitAnswer(selectedChoiceId);
    setSelectedChoiceId(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{level}</Text>
          <Text style={styles.title}>문제</Text>
        </View>
        <View style={styles.ratePill}>
          <Text style={styles.rateText}>Rate {rate}</Text>
        </View>
      </View>

      <Text style={styles.progress}>{progressText}</Text>
      <Text style={styles.prompt}>{question.promptKo}</Text>
      {question.questionText ? <Text style={styles.questionText}>{question.questionText}</Text> : null}

      <View style={styles.choices}>
        {choices.map((choice) => (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            onPress={() => setSelectedChoiceId(choice.id)}
            style={[
              styles.choice,
              selectedChoiceId === choice.id ? styles.selectedChoice : null,
            ]}
          >
            <Text style={styles.choiceText}>{choice.text}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submitSelectedAnswer}
        style={[styles.submitButton, !canSubmit ? styles.disabledButton : null]}
      >
        <Text style={styles.submitButtonText}>제출</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  kicker: {
    color: '#24715f',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#202624',
    fontSize: 30,
    fontWeight: '900',
  },
  ratePill: {
    backgroundColor: '#e3efe9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rateText: {
    color: '#24715f',
    fontSize: 14,
    fontWeight: '900',
  },
  progress: {
    color: '#66706b',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  prompt: {
    color: '#202624',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 16,
  },
  questionText: {
    color: '#3f4844',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 18,
  },
  choices: {
    gap: 10,
  },
  choice: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  selectedChoice: {
    borderColor: '#24715f',
    borderWidth: 2,
  },
  choiceText: {
    color: '#202624',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#24715f',
    borderRadius: 8,
    marginTop: 'auto',
    paddingVertical: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
```

- [ ] **Step 2: Create practice result screen**

Create `app/src/screens/PracticeResultScreen.tsx`:

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PracticeSessionResult } from '../types/learning';

type PracticeResultScreenProps = {
  result: PracticeSessionResult;
  onNextPractice: () => void;
  onStartPromotionExam: () => void;
};

export function PracticeResultScreen({
  result,
  onNextPractice,
  onStartPromotionExam,
}: PracticeResultScreenProps) {
  const actionLabel = result.promotionReady ? '승급 시험 시작' : '다음 문제';
  const action = result.promotionReady ? onStartPromotionExam : onNextPractice;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>해설</Text>
      <Text style={styles.rate}>Rate {result.nextRate}</Text>
      <Text style={styles.summary}>
        이번 문제 묶음에서 {result.totalCount}문제 중 {result.correctCount}문제를 맞혔습니다.
      </Text>

      {result.promotionReady ? (
        <View style={styles.promotionBox}>
          <Text style={styles.promotionText}>승급 시험을 볼 수 있습니다.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>해설</Text>
        {result.explanations.map((item) => (
          <View key={item.questionId} style={styles.explanation}>
            <Text style={styles.explanationPrompt}>{item.promptKo}</Text>
            <Text style={styles.explanationLine}>정답: {item.correctChoiceText}</Text>
            <Text style={styles.explanationBody}>{item.explanationKo}</Text>
            {item.weakPointLabel ? (
              <Text style={styles.weakPoint}>약점: {item.weakPointLabel}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{actionLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f8f5',
    flexGrow: 1,
    padding: 20,
  },
  kicker: {
    color: '#24715f',
    fontSize: 14,
    fontWeight: '900',
  },
  rate: {
    color: '#d46f45',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 76,
    marginTop: 10,
  },
  summary: {
    color: '#3f4844',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
  },
  promotionBox: {
    backgroundColor: '#e3efe9',
    borderRadius: 8,
    marginBottom: 16,
    padding: 14,
  },
  promotionText: {
    color: '#24715f',
    fontSize: 15,
    fontWeight: '900',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#202624',
    fontSize: 19,
    fontWeight: '900',
  },
  explanation: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  explanationPrompt: {
    color: '#202624',
    fontSize: 15,
    fontWeight: '900',
  },
  explanationLine: {
    color: '#24715f',
    fontSize: 14,
    fontWeight: '800',
  },
  explanationBody: {
    color: '#4d5752',
    fontSize: 14,
    lineHeight: 20,
  },
  weakPoint: {
    color: '#9b4d2f',
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#24715f',
    borderRadius: 8,
    marginTop: 24,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
```

- [ ] **Step 3: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/PracticeQuestionScreen.tsx app/src/screens/PracticeResultScreen.tsx
git commit -m "feat: add practice screens"
```

## Task 7: Promotion Screens

**Files:**
- Create: `app/src/screens/PromotionExamScreen.tsx`
- Create: `app/src/screens/PromotionResultScreen.tsx`

- [ ] **Step 1: Create promotion exam screen**

Create `app/src/screens/PromotionExamScreen.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActiveSession, LearnerLevel } from '../types/learning';

type PromotionExamScreenProps = {
  session: ActiveSession;
  fromLevel: LearnerLevel;
  toLevel: LearnerLevel;
  onSubmitAnswer: (choiceId: string) => void;
};

export function PromotionExamScreen({
  session,
  fromLevel,
  toLevel,
  onSubmitAnswer,
}: PromotionExamScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const question = session.questions[session.currentQuestionIndex];
  const progressText = `문제 ${Math.min(session.currentQuestionIndex + 1, session.questions.length)} / ${session.questions.length}`;
  const choices = useMemo(() => question?.choices ?? [], [question]);
  const canSubmit = Boolean(selectedChoiceId);

  function submitSelectedAnswer() {
    if (!selectedChoiceId) return;
    onSubmitAnswer(selectedChoiceId);
    setSelectedChoiceId(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>승급 시험</Text>
          <Text style={styles.title}>{`${fromLevel} -> ${toLevel}`}</Text>
        </View>
        <Text style={styles.timer}>03:20</Text>
      </View>

      <Text style={styles.progress}>{progressText}</Text>
      <Text style={styles.prompt}>{question?.promptKo}</Text>
      {question?.questionText ? <Text style={styles.questionText}>{question.questionText}</Text> : null}

      <View style={styles.choices}>
        {choices.map((choice) => (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            onPress={() => setSelectedChoiceId(choice.id)}
            style={[
              styles.choice,
              selectedChoiceId === choice.id ? styles.selectedChoice : null,
            ]}
          >
            <Text style={styles.choiceText}>{choice.text}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submitSelectedAnswer}
        style={[styles.submitButton, !canSubmit ? styles.disabledButton : null]}
      >
        <Text style={styles.submitButtonText}>시험 제출</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102a2a',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  kicker: {
    color: '#d9b66b',
    fontSize: 15,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  timer: {
    color: '#d9b66b',
    fontSize: 17,
    fontWeight: '900',
  },
  progress: {
    color: '#b9c7c1',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 14,
  },
  prompt: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 16,
  },
  questionText: {
    color: '#dbe6e2',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 18,
  },
  choices: {
    gap: 10,
  },
  choice: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  selectedChoice: {
    borderColor: '#d9b66b',
    borderWidth: 2,
  },
  choiceText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#d9b66b',
    borderRadius: 8,
    marginTop: 'auto',
    paddingVertical: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#102a2a',
    fontSize: 16,
    fontWeight: '900',
  },
});
```

- [ ] **Step 2: Create promotion result screen**

Create `app/src/screens/PromotionResultScreen.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PromotionExamResult } from '../types/learning';

type PromotionResultScreenProps = {
  result: PromotionExamResult;
  onContinue: () => void;
};

export function PromotionResultScreen({ result, onContinue }: PromotionResultScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>{result.passed ? '승급 성공' : '현재 단계 유지'}</Text>
      <Text style={styles.title}>
        {result.passed && result.toLevel
          ? `${result.fromLevel} -> ${result.toLevel}`
          : result.fromLevel}
      </Text>
      <Text style={styles.score}>점수 {result.score} / {result.passScore}</Text>
      <Text style={styles.message}>
        {result.passed
          ? '새로운 단계의 문제가 시작됩니다.'
          : '조금 더 연습한 뒤 다시 승급 시험에 도전하세요.'}
      </Text>

      <Pressable accessibilityRole="button" onPress={onContinue} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{result.passed ? '다음 문제 시작' : '계속 연습하기'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8f5',
    justifyContent: 'center',
    padding: 20,
  },
  kicker: {
    color: '#24715f',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    color: '#202624',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  score: {
    color: '#d46f45',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },
  message: {
    color: '#4d5752',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#24715f',
    borderRadius: 8,
    marginTop: 34,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
```

- [ ] **Step 3: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/PromotionExamScreen.tsx app/src/screens/PromotionResultScreen.tsx
git commit -m "feat: add promotion screens"
```

## Task 8: App Wiring

**Files:**
- Replace: `app/App.tsx`

- [ ] **Step 1: Replace App.tsx**

Replace `app/App.tsx` with:

```tsx
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';

import { PracticeQuestionScreen } from './src/screens/PracticeQuestionScreen';
import { PracticeResultScreen } from './src/screens/PracticeResultScreen';
import { PromotionExamScreen } from './src/screens/PromotionExamScreen';
import { PromotionResultScreen } from './src/screens/PromotionResultScreen';
import { getNextLevel } from './src/services/rateService';
import {
  buildPracticeResult,
  buildPromotionExamResult,
  createPracticeSession,
  createPromotionExamSession,
  isSessionComplete,
  submitAnswer,
} from './src/services/sessionService';
import { loadLearningState, saveLearningState } from './src/services/learningStorage';
import type {
  ActiveSession,
  AppMode,
  LocalLearningState,
  PracticeSessionResult,
  PromotionExamResult,
} from './src/types/learning';

export default function App() {
  const [mode, setMode] = useState<AppMode>('loading');
  const [learningState, setLearningState] = useState<LocalLearningState | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [practiceResult, setPracticeResult] = useState<PracticeSessionResult | null>(null);
  const [promotionResult, setPromotionResult] = useState<PromotionExamResult | null>(null);

  useEffect(() => {
    async function prepareApp() {
      const loadedState = await loadLearningState();
      const session = createPracticeSession(loadedState);

      setLearningState(loadedState);
      setActiveSession(session);
      setMode('practice');
    }

    prepareApp();
  }, []);

  function startPractice(nextState: LocalLearningState) {
    const session = createPracticeSession(nextState);
    setLearningState(nextState);
    setActiveSession(session);
    setPracticeResult(null);
    setPromotionResult(null);
    setMode('practice');
  }

  async function finishPractice(session: ActiveSession) {
    if (!learningState) return;

    const result = buildPracticeResult(learningState, session);
    const nextState: LocalLearningState = {
      ...learningState,
      currentRate: result.nextRate,
      solvedQuestionCount: learningState.solvedQuestionCount + result.totalCount,
      promotionReady: result.promotionReady,
      recentResults: [
        ...learningState.recentResults.slice(-9),
        {
          questionSetId: result.sessionId,
          level: result.level,
          score: result.score,
          rateAfter: result.nextRate,
          solvedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    await saveLearningState(nextState);
    setLearningState(nextState);
    setPracticeResult(result);
    setActiveSession(null);
    setMode('practiceResult');
  }

  async function submitPracticeAnswer(choiceId: string) {
    if (!activeSession) return;

    const nextSession = submitAnswer(activeSession, choiceId);
    setActiveSession(nextSession);

    if (isSessionComplete(nextSession)) {
      await finishPractice(nextSession);
    }
  }

  function startPromotionExam() {
    if (!learningState) return;

    const session = createPromotionExamSession(learningState);
    setActiveSession(session);
    setMode('promotionExam');
  }

  async function finishPromotionExam(session: ActiveSession) {
    if (!learningState) return;

    const result = buildPromotionExamResult(learningState, session);
    const nextState: LocalLearningState = {
      ...learningState,
      currentLevel: result.passed && result.toLevel ? result.toLevel : learningState.currentLevel,
      currentRate: result.nextRate,
      promotionReady: false,
      updatedAt: new Date().toISOString(),
    };

    await saveLearningState(nextState);
    setLearningState(nextState);
    setPromotionResult(result);
    setActiveSession(null);
    setMode('promotionResult');
  }

  async function submitPromotionAnswer(choiceId: string) {
    if (!activeSession) return;

    const nextSession = submitAnswer(activeSession, choiceId);
    setActiveSession(nextSession);

    if (isSessionComplete(nextSession)) {
      await finishPromotionExam(nextSession);
    }
  }

  if (mode === 'loading' || !learningState) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#24715f" />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  const nextLevel = getNextLevel(learningState.currentLevel);

  return (
    <SafeAreaView style={styles.app}>
      {mode === 'practice' && activeSession ? (
        <PracticeQuestionScreen
          level={learningState.currentLevel}
          rate={learningState.currentRate}
          session={activeSession}
          onSubmitAnswer={submitPracticeAnswer}
        />
      ) : null}

      {mode === 'practiceResult' && practiceResult ? (
        <PracticeResultScreen
          result={practiceResult}
          onNextPractice={() => startPractice(learningState)}
          onStartPromotionExam={startPromotionExam}
        />
      ) : null}

      {mode === 'promotionExam' && activeSession && nextLevel ? (
        <PromotionExamScreen
          session={activeSession}
          fromLevel={learningState.currentLevel}
          toLevel={nextLevel}
          onSubmitAnswer={submitPromotionAnswer}
        />
      ) : null}

      {mode === 'promotionResult' && promotionResult ? (
        <PromotionResultScreen
          result={promotionResult}
          onContinue={() => startPractice(learningState)}
        />
      ) : null}

      <StatusBar style={mode === 'promotionExam' ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#f6f8f5',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: '#f6f8f5',
    flex: 1,
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Run verification**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/App.tsx
git commit -m "feat: wire simple learning flow"
```

## Task 9: Browser Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm --prefix app run typecheck
```

Expected: PASS.

- [ ] **Step 2: Start the app**

Run:

```bash
npm --prefix app run web
```

Expected: Expo web server starts and prints a local URL.

- [ ] **Step 3: Manual flow check**

Open the local URL and verify:

- First visible screen is a problem.
- Rate chip is visible on the problem screen.
- Submit is disabled before answer selection.
- Three submitted answers lead to explanation + rate screen.
- If Rate is below 80, the primary button says `다음 문제`.
- If Rate reaches 80, the primary button says `승급 시험 시작`.
- Promotion exam uses dark background and gold accent.
- Five exam answers lead to promotion result screen.
- Passed result advances level.
- Failed result keeps level.
- Refreshing the app preserves level and rate.

- [ ] **Step 4: Commit final fixes**

```bash
git add app
git commit -m "chore: verify simple learning flow"
```

## Self-Review Notes

- Product requirement coverage: app starts on a problem, local state loads, session result shows explanation and rate, Rate 80 opens promotion exam, promotion UI differs, promotion result updates level.
- Type consistency: all types referenced in screens and services are defined in `app/src/types/learning.ts`.
- Storage consistency: `AsyncStorage` is installed in Task 5 before `learningStorage.ts` imports it.
- Excluded scope stays excluded: no login, sync, audio, ranking, payment, complex home screen, or AI-generated question bank.
