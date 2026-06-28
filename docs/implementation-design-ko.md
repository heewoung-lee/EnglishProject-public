# 구현 설계 문서

## 1. 목적

이 문서는 현재 확정된 단순 학습 플로우를 실제 Expo 앱으로 구현하기 위한 기준 문서다.

기준 문서:

- `docs/product-plan-draft-ko.md`
- `docs/screen-flow-design-ko.md`
- `docs/mockups/simple-rate-flow.png`

구현 목표는 다음 흐름을 만드는 것이다.

```text
앱 실행
-> 로컬 학습 상태 로드
-> 현재 레벨에 맞는 일반 문제 표시
-> 3문제 풀이
-> 해설 + 레이트 표시
-> Rate 80 이상이면 승급 시험
-> 승급 시험 5문제
-> 통과 시 레벨 상승, 실패 시 유지
-> 로컬 저장
```

## 2. 기술 방향

### 2.1 앱 구조

- Expo SDK 56
- React Native
- TypeScript
- 앱 내부 seed 문제 데이터
- 로컬 저장 기반 학습 상태

### 2.2 로컬 저장

MVP에서는 `AsyncStorage`를 사용한다.

이유:

- 저장할 데이터가 작은 JSON이다.
- 서버 계정 없이 바로 시작할 수 있다.
- Expo SDK 56 문서 기준으로 `@react-native-async-storage/async-storage`는 비동기, 비암호화, persistent key-value storage API다.
- 설치 명령은 `npx expo install @react-native-async-storage/async-storage`를 사용한다.

참고:

- Expo AsyncStorage SDK 56: https://docs.expo.dev/versions/v56.0.0/sdk/async-storage/
- Expo SQLite SDK 56: https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/

`expo-sqlite`는 이후 학습 기록이 커졌을 때 검토한다. 초기 MVP에는 필요 없다.

## 3. 구현 파일 구조

새 구현은 아래 파일 구조를 기준으로 한다.

```text
app/
  App.tsx
  src/
    constants/
      learningConfig.ts
    data/
      questionBank.ts
    screens/
      PracticeQuestionScreen.tsx
      PracticeResultScreen.tsx
      PromotionExamScreen.tsx
      PromotionResultScreen.tsx
    services/
      learningStorage.ts
      questionSelector.ts
      rateService.ts
      sessionService.ts
    types/
      learning.ts
```

### 3.1 파일 역할

`App.tsx`

- 앱 전체 상태를 보관한다.
- 로컬 상태를 로드한다.
- 현재 화면 모드를 전환한다.
- 세션 완료, 승급 시험 완료 후 로컬 저장을 호출한다.

`src/types/learning.ts`

- 레벨, 문제, 세션, 결과, 로컬 상태 타입을 정의한다.

`src/constants/learningConfig.ts`

- 일반 세션 문제 수, 승급 시험 문제 수, 레이트 기준, 통과 점수 등 상수를 정의한다.

`src/data/questionBank.ts`

- 레벨별 seed 문제를 정의한다.
- MVP에서는 선택형 문제를 중심으로 시작한다.

`src/services/learningStorage.ts`

- `AsyncStorage`에서 학습 상태를 로드/저장/초기화한다.

`src/services/questionSelector.ts`

- 현재 레벨과 세션 종류에 맞는 문제를 선택한다.

`src/services/rateService.ts`

- 일반 세션 결과로 새 레이트를 계산한다.
- 승급 시험 결과로 레벨 변경 여부를 계산한다.

`src/services/sessionService.ts`

- 일반 세션과 승급 시험 세션을 생성한다.
- 제출된 답안을 채점하고 결과 객체를 만든다.

`src/screens/PracticeQuestionScreen.tsx`

- 일반 문제 화면을 렌더링한다.

`src/screens/PracticeResultScreen.tsx`

- 해설과 레이트 화면을 렌더링한다.

`src/screens/PromotionExamScreen.tsx`

- 승급 시험 화면을 렌더링한다.

`src/screens/PromotionResultScreen.tsx`

- 승급 성공 또는 유지 결과를 렌더링한다.

## 4. 핵심 타입 설계

```ts
export type LearnerLevel = 'A1' | 'A2' | 'B1' | 'B2';

export type AppMode =
  | 'loading'
  | 'practice'
  | 'practiceResult'
  | 'promotionExam'
  | 'promotionResult';

export type QuestionKind = 'choice';

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

export type QuestionChoice = {
  id: string;
  text: string;
};

export type LocalLearningState = {
  currentLevel: LearnerLevel;
  currentRate: number;
  solvedQuestionCount: number;
  promotionReady: boolean;
  recentResults: RecentResult[];
  updatedAt: string;
};

export type RecentResult = {
  questionSetId: string;
  level: LearnerLevel;
  score: number;
  rateAfter: number;
  solvedAt: string;
};

export type ActiveSession = {
  id: string;
  mode: 'practice' | 'promotionExam';
  level: LearnerLevel;
  questions: LearningQuestion[];
  currentQuestionIndex: number;
  answers: SubmittedAnswer[];
};

export type SubmittedAnswer = {
  questionId: string;
  selectedChoiceId: string;
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

export type QuestionExplanation = {
  questionId: string;
  promptKo: string;
  selectedChoiceText: string;
  correctChoiceText: string;
  isCorrect: boolean;
  explanationKo: string;
  weakPointLabel?: string;
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

## 5. 상수 설계

```ts
export const LEARNING_STORAGE_KEY = 'englishProject.learningState.v1';

export const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2'] as const;

export const PRACTICE_QUESTION_COUNT = 3;

export const PROMOTION_EXAM_QUESTION_COUNT = 5;

export const PROMOTION_RATE_THRESHOLD = 80;

export const PROMOTION_PASS_SCORE = 80;

export const INITIAL_RATE = 0;

export const PROMOTION_SUCCESS_RATE = 0;

export const PROMOTION_FAILURE_RATE = 70;
```

상수 의미:

- 일반 세션은 3문제로 고정한다.
- 승급 시험은 5문제로 고정한다.
- 일반 세션 후 `Rate >= 80`이면 승급 시험을 열 수 있다.
- 승급 시험은 80점 이상이면 통과한다.
- 승급 성공 시 다음 레벨의 레이트는 0으로 시작한다.
- 승급 실패 시 현재 레벨을 유지하고 레이트는 70으로 낮춘다.

## 6. 로컬 저장 설계

### 6.1 기본 상태

로컬 저장소에 값이 없으면 아래 상태를 만든다.

```ts
export function createDefaultLearningState(): LocalLearningState {
  return {
    currentLevel: 'A1',
    currentRate: 0,
    solvedQuestionCount: 0,
    promotionReady: false,
    recentResults: [],
    updatedAt: new Date().toISOString(),
  };
}
```

### 6.2 저장 서비스 API

```ts
export async function loadLearningState(): Promise<LocalLearningState>;

export async function saveLearningState(
  state: LocalLearningState,
): Promise<void>;

export async function resetLearningState(): Promise<LocalLearningState>;
```

### 6.3 저장 규칙

저장은 다음 시점에 수행한다.

- 앱 첫 실행에서 기본 상태를 생성할 때
- 일반 문제 세션이 끝나고 새 레이트가 계산되었을 때
- 승급 시험에 진입 가능한 상태가 되었을 때
- 승급 시험 결과가 계산되었을 때
- 레벨이 바뀌었을 때

### 6.4 오류 처리

`AsyncStorage` 로드 실패 시:

- 기본 상태를 만든다.
- 앱은 문제 화면으로 계속 진입한다.
- 오류 메시지는 개발 로그에만 남긴다.

저장 실패 시:

- 현재 메모리 상태는 유지한다.
- 다음 저장 시도에서 다시 저장한다.
- 사용자에게 복잡한 오류 화면을 보여주지 않는다.

## 7. 문제 데이터 설계

MVP 문제는 앱 내부 seed data로 시작한다.

```ts
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
];
```

문제 데이터 기준:

- `id`는 전역에서 고유해야 한다.
- `level`은 출제 기준이다.
- `promptKo`는 한국어 문제 지시문이다.
- `choices`는 MVP에서 항상 3개를 사용한다.
- `explanationKo`는 해설 화면에 표시한다.
- `weakPointLabel`은 선택 항목이며 해설 화면의 약점 라벨에 사용한다.

## 8. 문제 선택 설계

### 8.1 일반 문제 선택

```ts
export function selectPracticeQuestions(
  level: LearnerLevel,
  recentResults: RecentResult[],
): LearningQuestion[];
```

규칙:

- 현재 레벨의 문제만 선택한다.
- 기본 3문제를 선택한다.
- 최근 결과가 있으면 최근에 사용된 문제 묶음은 우선 제외한다.
- 선택할 문제가 부족하면 같은 레벨의 문제를 다시 사용할 수 있다.

### 8.2 승급 시험 문제 선택

```ts
export function selectPromotionExamQuestions(
  currentLevel: LearnerLevel,
): LearningQuestion[];
```

규칙:

- 현재 레벨보다 한 단계 높은 레벨을 목표로 한다.
- 시험 문제는 5문제를 선택한다.
- 다음 레벨 문제가 부족하면 현재 레벨의 고난도 문제를 섞을 수 있다.
- `B2`에서는 더 높은 레벨이 없으므로 승급 시험을 제공하지 않는다.

## 9. 레이트 계산 설계

### 9.1 일반 세션 레이트

```ts
export function calculateNextRate(
  currentRate: number,
  correctCount: number,
  totalCount: number,
): number;
```

기본 규칙:

```text
3 / 3 정답: +10
2 / 3 정답: +6
1 / 3 정답: +2
0 / 3 정답: -4
```

결과는 항상 0~100 사이로 제한한다.

```ts
function clampRate(rate: number): number {
  return Math.max(0, Math.min(100, Math.round(rate)));
}
```

### 9.2 승급 가능 여부

```ts
export function isPromotionReady(rate: number): boolean {
  return rate >= PROMOTION_RATE_THRESHOLD;
}
```

### 9.3 승급 시험 점수

```ts
export function calculateExamScore(
  correctCount: number,
  totalCount: number,
): number {
  return Math.round((correctCount / totalCount) * 100);
}
```

### 9.4 승급 결과

```ts
export function calculatePromotionResult(
  currentLevel: LearnerLevel,
  score: number,
): Pick<PromotionExamResult, 'toLevel' | 'passed' | 'nextRate'>;
```

규칙:

- `score >= 80`: 통과
- 통과하면 다음 레벨로 이동
- 통과하면 새 레벨의 레이트는 0
- 실패하면 현재 레벨 유지
- 실패하면 레이트는 70

## 10. 세션 생성과 채점

### 10.1 일반 세션 생성

```ts
export function createPracticeSession(
  state: LocalLearningState,
): ActiveSession;
```

생성 규칙:

- `state.currentLevel` 기준으로 문제를 고른다.
- `mode`는 `practice`다.
- `currentQuestionIndex`는 0으로 시작한다.
- `answers`는 빈 배열로 시작한다.

### 10.2 승급 시험 세션 생성

```ts
export function createPromotionExamSession(
  state: LocalLearningState,
): ActiveSession;
```

생성 규칙:

- `state.promotionReady`가 `true`일 때만 생성한다.
- `B2`에서는 생성하지 않는다.
- `mode`는 `promotionExam`이다.
- 문제 수는 5개다.

### 10.3 답안 제출

```ts
export function submitAnswer(
  session: ActiveSession,
  selectedChoiceId: string,
): ActiveSession;
```

규칙:

- 현재 문제에 대한 답안을 `answers`에 추가한다.
- 다음 문제 인덱스로 이동한다.
- 마지막 문제 이후에는 결과 계산 단계로 넘어간다.

### 10.4 일반 세션 결과 생성

```ts
export function buildPracticeResult(
  state: LocalLearningState,
  session: ActiveSession,
): PracticeSessionResult;
```

결과에 포함할 내용:

- 맞힌 개수
- 전체 문제 수
- 이전 레이트
- 새 레이트
- 승급 가능 여부
- 문제별 해설

### 10.5 승급 시험 결과 생성

```ts
export function buildPromotionExamResult(
  state: LocalLearningState,
  session: ActiveSession,
): PromotionExamResult;
```

결과에 포함할 내용:

- 시험 점수
- 통과 여부
- 이전 레벨
- 다음 레벨
- 다음 레이트

## 11. 앱 상태 전환

### 11.1 화면 모드

```ts
type AppMode =
  | 'loading'
  | 'practice'
  | 'practiceResult'
  | 'promotionExam'
  | 'promotionResult';
```

### 11.2 전환 규칙

```text
loading
-> practice

practice
-> practiceResult

practiceResult + promotionReady false
-> practice

practiceResult + promotionReady true
-> promotionExam

promotionExam
-> promotionResult

promotionResult
-> practice
```

### 11.3 App.tsx 책임

`App.tsx`는 다음 상태를 가진다.

```ts
const [mode, setMode] = useState<AppMode>('loading');
const [learningState, setLearningState] = useState<LocalLearningState | null>(null);
const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
const [practiceResult, setPracticeResult] = useState<PracticeSessionResult | null>(null);
const [promotionResult, setPromotionResult] = useState<PromotionExamResult | null>(null);
```

`App.tsx`는 비즈니스 계산을 직접 하지 않는다. 계산은 service 함수에 맡긴다.

## 12. 화면별 props 설계

### 12.1 PracticeQuestionScreen

```ts
type PracticeQuestionScreenProps = {
  level: LearnerLevel;
  rate: number;
  session: ActiveSession;
  onSubmitAnswer: (choiceId: string) => void;
};
```

### 12.2 PracticeResultScreen

```ts
type PracticeResultScreenProps = {
  result: PracticeSessionResult;
  onNextPractice: () => void;
  onStartPromotionExam: () => void;
};
```

### 12.3 PromotionExamScreen

```ts
type PromotionExamScreenProps = {
  session: ActiveSession;
  fromLevel: LearnerLevel;
  toLevel: LearnerLevel;
  onSubmitAnswer: (choiceId: string) => void;
};
```

### 12.4 PromotionResultScreen

```ts
type PromotionResultScreenProps = {
  result: PromotionExamResult;
  onContinue: () => void;
};
```

## 13. 화면 스타일 기준

### 13.1 일반 문제 화면

- 배경: 밝은 회색 또는 흰색
- 주요 색상: 차분한 녹색
- 레이트 칩은 상단 오른쪽에 배치
- 답안은 세로 목록
- 제출 버튼은 하단 고정에 가깝게 배치

### 13.2 해설 + 레이트 화면

- 레이트 숫자를 가장 크게 표시
- 해설은 짧은 문장 목록
- 승급 가능 시 버튼 문구를 `승급 시험 시작`으로 변경

### 13.3 승급 시험 화면

- 배경: 어두운 녹색 또는 남색
- 포인트: 금색
- 상단에 `승급 시험`과 `A1 -> A2` 배지
- 진행률 표시
- 시험 중 해설 없음

### 13.4 승급 결과 화면

- 통과와 실패를 명확히 구분
- 통과 시 다음 레벨을 크게 표시
- 실패 시 현재 단계 유지와 계속 연습 안내

## 14. 구현 순서

### 14.1 1단계: 타입과 상수

작업:

- `app/src/types/learning.ts` 생성
- `app/src/constants/learningConfig.ts` 생성

검증:

```bash
npm --prefix app run typecheck
```

### 14.2 2단계: 문제 데이터

작업:

- `app/src/data/questionBank.ts` 생성
- A1 문제 최소 8개 작성
- A2 문제 최소 5개 작성

검증:

```bash
npm --prefix app run typecheck
```

### 14.3 3단계: 계산 서비스

작업:

- `rateService.ts`
- `questionSelector.ts`
- `sessionService.ts`

검증:

```bash
npm --prefix app run typecheck
```

### 14.4 4단계: 로컬 저장

작업:

- `@react-native-async-storage/async-storage` 설치
- `learningStorage.ts` 생성
- 로드, 저장, 초기화 구현

설치 명령:

```bash
npx expo install @react-native-async-storage/async-storage
```

검증:

```bash
npm --prefix app run typecheck
```

### 14.5 5단계: 화면 구현

작업:

- `PracticeQuestionScreen.tsx`
- `PracticeResultScreen.tsx`
- `PromotionExamScreen.tsx`
- `PromotionResultScreen.tsx`

검증:

```bash
npm --prefix app run typecheck
```

### 14.6 6단계: App.tsx 연결

작업:

- 앱 실행 시 로컬 상태 로드
- 일반 세션 생성
- 화면 모드 전환
- 결과 저장
- 승급 처리

검증:

```bash
npm --prefix app run typecheck
npm --prefix app run web
```

## 15. 테스트 기준

현재 프로젝트에는 테스트 러너가 없으므로 1차 검증은 TypeScript와 수동 플로우 확인으로 한다.

수동 확인 항목:

- 앱 실행 후 바로 일반 문제가 보인다.
- 답을 선택하기 전에는 제출할 수 없다.
- 3문제를 풀면 해설 + 레이트 화면이 나온다.
- 레이트가 80 미만이면 다음 일반 문제로 간다.
- 레이트가 80 이상이면 승급 시험 시작 버튼이 나온다.
- 승급 시험은 일반 문제와 다른 스타일이다.
- 승급 시험 통과 시 레벨이 오른다.
- 승급 시험 실패 시 레벨이 유지된다.
- 앱을 다시 열면 레벨과 레이트가 복원된다.

## 16. 구현에서 제외할 것

이번 구현에서 제외한다.

- 로그인
- 서버 동기화
- 음성 입력
- 발음 평가
- 결제
- 랭킹
- 복잡한 홈 화면
- AI 기반 무제한 문제 생성

## 17. 확정된 기본값

```text
일반 세션 문제 수: 3
승급 시험 문제 수: 5
승급 가능 레이트: 80
승급 시험 통과 점수: 80
승급 성공 후 레이트: 0
승급 실패 후 레이트: 70
초기 레벨: A1
초기 레이트: 0
```
