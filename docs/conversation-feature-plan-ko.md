# 회화 기능 기획 문서

작성일: 2026-06-10

## 1. 목적

회화 기능은 기존의 `3문제 일반 학습 세트`와 다른 학습 단위다.

일반 문제는 객관식 또는 영작 문제를 3개씩 풀고 해설과 Rate를 받는 흐름이다. 회화는 한 문제 안에서 여러 번 대화를 주고받은 뒤, 전체 대화 흐름을 기준으로 채점한다.

목표는 사용자가 실제 상황에서 영어로 반응하는 능력을 연습하게 만드는 것이다.

```text
상황 제시
-> AI가 역할을 맡고 첫 문장 제시
-> 사용자 답변
-> AI가 답변에 맞춰 다음 대사 생성
-> 4~6턴 대화
-> 전체 대화 채점
-> 회화 Rate와 약점 저장
```

## 2. 핵심 방향

- 회화는 기존 `3문제 세트` 안에 끼워 넣지 않는다.
- 회화는 `conversation session`이라는 별도 세션으로 처리한다.
- 앱은 채팅 UI와 상태 저장만 담당한다.
- OpenAI API Key는 앱 APK에 넣지 않는다.
- Firebase Functions 서버가 OpenAI API를 호출한다.
- 회화 상황 데이터는 DB 또는 hosted question pack처럼 서버에서 받아올 수 있게 설계한다.
- 대화는 무제한으로 열어두지 않고, 처음에는 5 user turns로 제한한다.
- 회화 점수도 기존 Rate 시스템에 반영한다.

## 3. 사용자 경험

### 3.1 진입 방식

앱을 열었을 때 사용자의 로컬 학습 상태를 로드한다.

그 후 선택기는 다음 중 하나를 고른다.

- 일반 문제 세트: 리딩, 문법, 짧은 영작
- 회화 세션: 상황 기반 티키타카 회화
- 승급 시험: Rate 기준 도달 시

회화가 부족 영역으로 판단되면 일반 3문제 대신 회화 세션 하나가 나온다.

### 3.2 회화 화면 흐름

```text
A1 · 회화

상황: 카페에서 음료 주문하기
목표: 원하는 음료, 크기, 포장 여부를 말하세요.

Barista:
Hi, what would you like to order?

사용자 입력
```

사용자가 답변하면 AI가 다음 대사를 만든다.

```text
User:
I want iced americano.

Barista:
Sure. What size would you like?
```

대화가 목표를 달성하거나 최대 턴에 도달하면 평가 화면으로 이동한다.

### 3.3 회화 결과 화면

```text
회화 평가

Score 76
이번 대화에서 주문 의도는 잘 전달했지만, 관사와 공손한 요청 표현이 부족했습니다.

잘한 점
- 원하는 음료를 영어로 말했습니다.
- 질문에 맞게 대답했습니다.

보완할 점
- "I want"보다 "I'd like"가 더 자연스럽습니다.
- "iced americano" 앞에 "an"을 붙이면 좋습니다.

교정 예시
원문: I want iced americano.
교정: I'd like an iced Americano, please.

[다음 문제]
```

## 4. 회화 시나리오 데이터

회화는 정답이 고정된 문제가 아니라, 상황과 목표가 있는 시나리오다.

대화 대사를 전부 저장하지 않는다. DB에는 “무엇을 받아야 하는지”와 “대화가 흔들릴 때 어떻게 복구할지”를 저장한다. 샘플 대화는 설계 참고 자료일 뿐, 실제 앱 흐름의 고정 스크립트가 아니다.

```ts
type ConversationScenario = {
  id: string;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  area: 'conversation';
  titleKo: string;
  titleEn: string;
  situationKo: string;
  aiRole: string;
  userRole: string;
  userGoalKo: string;
  openingMessage: string;
  maxUserTurns: number;
  targetExpressions: string[];
  targetSkills: ConversationSkillTag[];
  completionMessage: string;
  successCriteria: string[];
  repairPolicy: {
    unclear: string;
    offTopic: string;
    correction: string;
    koreanOnly: string;
  };
  requiredSlots: {
    key: string;
    label: string;
    prompt: string;
    matchKeywords: string[];
    required?: boolean;
  }[];
};
```

예시:

```ts
{
  id: 'a1-cafe-order-001',
  level: 'A1',
  area: 'conversation',
  titleKo: '카페에서 음료 주문하기',
  titleEn: 'Ordering at a cafe',
  situationKo: '당신은 카페에서 음료를 주문해야 합니다.',
  aiRole: 'barista',
  userRole: 'customer',
  userGoalKo: '원하는 음료, 크기, 포장 여부를 말하세요.',
  openingMessage: 'Hi, what would you like to order?',
  maxUserTurns: 5,
  targetExpressions: [
    "I'd like ...",
    'Can I get ...?',
    'To go, please.'
  ],
  targetSkills: [
    'polite_requests',
    'articles',
    'task_completion'
  ],
  completionMessage: "Got it. I'll have that ready at the pickup counter.",
  successCriteria: [
    'Say the drink you want.',
    'Say the size.',
    'Say whether it is for here or to go.'
  ],
  repairPolicy: {
    unclear: 'Sorry, could you say that again in English?',
    offTopic: 'Let us come back to this situation. What do you need?',
    correction: 'No problem. Thanks for correcting that.',
    koreanOnly: 'Please try saying that in English.'
  },
  requiredSlots: [
    {
      key: 'drink',
      label: 'drink',
      prompt: 'Sure. What would you like to drink?',
      matchKeywords: ['coffee', 'americano', 'latte', 'tea']
    },
    {
      key: 'size',
      label: 'size',
      prompt: 'Sure. What size would you like?',
      matchKeywords: ['small', 'medium', 'large']
    },
    {
      key: 'diningOption',
      label: 'for here or to go',
      prompt: 'Is that for here or to go?',
      matchKeywords: ['to go', 'takeout', 'for here']
    }
  ]
}
```

### 4.1 예측 불가능한 사용자 답변 처리

사용자가 예상하지 못한 말을 해도, 서버와 앱 fallback은 다음 순서로 처리한다.

1. 사용자 발화가 `requiredSlots.matchKeywords` 중 무엇을 채웠는지 확인한다.
2. 이미 채운 슬롯은 다시 묻지 않는다.
3. 아직 채우지 않은 첫 슬롯의 `prompt`를 다음 질문으로 사용한다.
4. 모든 필수 슬롯을 채우면 `completionMessage`로 역할극을 마무리한다.
5. 한국어만 입력, 의미 불명, 주제 이탈, 정정 발화는 `repairPolicy`로 복구한다.

이 구조를 쓰면 새 회화 문제가 추가되어도 서버 코드를 수정하지 않고 DB 데이터만으로 대화 흐름을 제어할 수 있다.

## 5. LLM 사용 방식

회화 기능은 LLM이 필수다.

사용자가 어떤 답변을 할지 미리 알 수 없기 때문에, DB에 대사를 전부 저장하는 방식으로는 자연스러운 티키타카가 어렵다.

LLM은 두 가지 역할을 한다.

1. 대화 진행자
2. 대화 평가자

### 5.1 대화 진행

앱은 사용자의 최신 답변과 지금까지의 대화를 서버로 보낸다.

서버는 OpenAI API를 호출해서 다음 AI 대사를 만든다.

서버는 먼저 시나리오의 `requiredSlots`를 읽어 현재 대화 상태를 만든다.

```ts
type ConversationState = {
  knownDetails: string[];
  missingDetails: string[];
  requiredSlots: {
    key: string;
    label: string;
    question: string;
  }[];
  nextQuestion: string | null;
  completionMessage: string;
  repairPolicy: ConversationScenario['repairPolicy'];
  successCriteria: string[];
  canComplete: boolean;
};
```

LLM 프롬프트는 이 상태를 기준으로 “한 번에 하나의 질문만 하기”, “이미 받은 정보를 다시 묻지 않기”, “목표 달성 시 종료하기”를 강제한다.

권장 API:

```text
POST /api/conversation/respond
```

요청:

```ts
type ConversationRespondRequest = {
  scenario: ConversationScenario;
  userMessage: string;
  messages: ConversationMessage[];
  failureCount: number;
};
```

응답:

```ts
type ConversationRespondResponse = {
  message: string;
  isUserUnderstandable: boolean;
  isUserRelevant: boolean;
  shouldEndSession: boolean;
  endReason: 'goal_completed' | 'max_turns' | 'too_many_failures' | null;
  detectedIssueTags: ConversationSkillTag[];
  correctedSentence: string | null;
  shortReasonKo: string | null;
};
```

### 5.2 대화 평가

대화가 끝나면 앱은 전체 transcript를 서버로 보낸다.

권장 API:

```text
POST /api/conversation/evaluate
```

요청:

```ts
type ConversationEvaluateRequest = {
  scenario: ConversationScenario;
  messages: ConversationMessage[];
  communicationFailureCount: number;
};
```

응답:

```ts
type ConversationEvaluation = {
  totalScore: number;
  categoryScores: {
    taskCompletion: number;
    clarity: number;
    grammar: number;
    vocabulary: number;
    naturalness: number;
  };
  summaryKo: string;
  strengthsKo: string[];
  weaknessesKo: string[];
  correctedExamples: {
    original: string;
    corrected: string;
    explanationKo: string;
    tags: ConversationSkillTag[];
  }[];
  weaknessTags: ConversationSkillTag[];
  recommendedScenarioIds: string[];
};
```

## 6. 채점 기준

총점은 100점 기준이다.

```text
Task completion: 30점
Communication clarity: 25점
Grammar accuracy: 20점
Vocabulary appropriateness: 15점
Naturalness and flow: 10점
```

기준:

- 85점 이상: 매우 자연스럽게 목표 달성
- 70~84점: 목표는 달성했지만 일부 표현 개선 필요
- 50~69점: 의미 전달은 일부 됐지만 대화 지속이 불안정함
- 49점 이하: 상황 목표를 제대로 달성하지 못함

## 7. Rate 반영

회화 세션은 하나의 큰 문제로 본다.

기존 3문제 세트처럼 `correctCount / totalCount`로 계산하지 않고, 대화 평가 점수로 Rate를 조정한다.

권장 규칙:

```text
85~100점: +10
70~84점: +6
50~69점: +2
0~49점: -4
```

Rate가 80 이상이면 기존과 동일하게 승급 시험으로 이동할 수 있다.

회화 실패 또는 낮은 점수는 `weakAreas: ['conversation']`으로 저장한다.

## 8. 로컬 저장 구조

기존 `LocalLearningState`는 일반 문제 결과를 `recentResults`에 저장한다.

회화는 결과 구조가 다르므로 별도 이력을 추가하는 방향이 안전하다.

```ts
type RecentConversationResult = {
  conversationSessionId: string;
  scenarioId: string;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  score: number;
  rateAfter: number;
  weaknessTags: ConversationSkillTag[];
  recommendedScenarioIds: string[];
  solvedAt: string;
};
```

확장된 로컬 상태:

```ts
type LocalLearningState = {
  currentLevel: LearnerLevel;
  currentRate: number;
  solvedQuestionCount: number;
  promotionReady: boolean;
  recentResults: RecentResult[];
  recentConversationResults: RecentConversationResult[];
  updatedAt: string;
};
```

마이그레이션 규칙:

- 기존 저장값에 `recentConversationResults`가 없으면 빈 배열로 초기화한다.
- 저장 키는 당장 바꾸지 않는다.
- 저장 포맷만 확장한다.

## 9. 출제 선택 규칙

회화는 너무 자주 나오면 사용자가 부담을 느낄 수 있다.

초기 MVP에서는 다음 규칙을 추천한다.

```text
1. promotionReady가 true면 승급 시험 우선
2. 최근 약점에 conversation이 있으면 회화 세션 우선
3. 최근 3번 연속 일반 문제만 풀었다면 회화 세션 후보 추가
4. 같은 시나리오는 높은 점수로 통과한 뒤 일정 기간 반복하지 않음
5. 실패한 시나리오는 그대로 반복하기보다 같은 난이도의 비슷한 시나리오를 우선 출제
```

예:

- `a1-cafe-order-001`에서 90점: 당분간 제외
- `a1-cafe-order-001`에서 45점: `a1-cafe-order-002` 또는 `a1-restaurant-order-001` 우선
- 같은 유형 시나리오가 부족하면 이전 실패 시나리오 재출제 허용

## 10. UI 설계 방향

### 10.1 회화 시작 화면

일반 문제처럼 앱을 켜자마자 바로 진입할 수 있어야 한다.

별도 설명 페이지를 길게 두지 않는다.

구성:

- 상단: 현재 레벨, 회화 영역, Rate
- 제목: 상황 이름
- 짧은 상황 설명
- 목표 1줄
- AI 첫 대사
- 입력창

### 10.2 대화 화면

채팅 UI를 사용한다.

단, 일반 메신저처럼 복잡하게 만들지 않는다.

구성:

- AI 말풍선
- 사용자 말풍선
- 입력창
- 제출 버튼
- 남은 턴 표시

키보드가 올라와도 제출 버튼과 입력창이 가려지면 안 된다.

### 10.3 회화 결과 화면

일반 해설 화면과 비슷한 톤을 유지한다.

구성:

- Score
- 이번 대화 요약
- 잘한 점
- 보완할 점
- 교정 예시
- 다음 문제 버튼

## 11. 서버 설계

서버는 Firebase Functions를 사용한다.

현재 서버에는 이미 다음 형태의 초안이 있다.

- `/api/conversation/respond`
- `/api/conversation/evaluate`
- `/api/writing/evaluate`

회화 기능 구현 시 기존 회화 API를 그대로 믿고 쓰지 말고, 새 학습 흐름에 맞춰 검토 후 정리한다.

특히 확인할 점:

- 기존 API가 현재 `A1~B2` 레벨 체계와 맞는가
- 기존 scenario 타입이 새 question pack 구조와 맞는가
- mock fallback이 실제 출시 APK에서 사용자에게 이상한 결과를 주지 않는가
- OpenAI 응답이 항상 JSON schema를 지키는가
- 실패 시 앱이 무한 로딩에 빠지지 않는가

## 12. 비용 제한

회화는 비용이 발생한다.

초기 MVP 제한:

- 한 회화 세션당 최대 user turn 5
- turn 응답 1회당 OpenAI 호출 1회
- 최종 평가 OpenAI 호출 1회
- 한 세션 최대 6회 호출
- 모델은 비용이 낮은 mini 계열 우선

나중에 비용을 더 줄이는 방법:

- 상황별 deterministic fallback 질문 사용
- 대화 중에는 간단한 응답 모델 사용
- 최종 평가에만 더 강한 모델 사용
- 같은 transcript 재평가 금지
- 서버에서 rate limit 적용

## 13. 안전 장치

필수 안전 장치:

- API Key는 서버에만 저장
- 앱 APK에 API Key 포함 금지
- 서버 timeout 설정
- OpenAI 실패 시 사용자에게 재시도 안내
- 대화가 3번 이상 이해 불가하면 세션 종료 후 평가
- 한국어만 입력하거나 무의미한 입력이면 간단히 다시 말하라고 유도
- AI는 roleplay 중 문법 설명을 길게 하지 않음

roleplay 중 AI 원칙:

- 영어로만 대화
- 한 번에 한 질문만 하기
- 사용자 답변을 그대로 반복하지 않기
- 문법 설명은 결과 화면에서만 하기
- 사용자의 의미가 통하면 자연스럽게 대화 이어가기

## 14. MVP 범위

### 포함

- A1 회화 시나리오 3개
- A2 회화 시나리오 3개
- 채팅형 회화 화면
- 서버 기반 AI 응답
- 서버 기반 최종 평가
- 회화 결과 화면
- 회화 Rate 반영
- 로컬 회화 이력 저장
- 최근 고득점 시나리오 반복 방지

초기 시나리오:

```text
A1
- 카페에서 음료 주문하기
- 호텔에서 이름 말하고 체크인하기
- 길 묻기

A2
- 공항 체크인하기
- 친구와 약속 시간 바꾸기
- 음식점에서 요청하기
```

### 제외

- 음성 입력
- 발음 평가
- 실시간 음성 대화
- 캐릭터 아바타
- 긴 자유 대화
- 결제 또는 사용량 제한 UI
- 멀티플레이 또는 다른 사용자와 대화

## 15. 구현 단계 제안

### 1단계: 데이터 타입 정리

- `ConversationScenario`
- `ConversationMessage`
- `ConversationEvaluation`
- `RecentConversationResult`
- `ConversationSession`

### 2단계: 시나리오 팩 설계

- 앱 내 bundled seed
- Firebase Hosting 기반 remote scenario pack
- 캐시 구조
- pack version 관리

### 3단계: 서버 API 확정

- `/api/conversation/respond`
- `/api/conversation/evaluate`
- JSON schema 검증
- 실패 응답 형식 통일

### 4단계: 앱 세션 로직 추가

- `createConversationSession`
- `submitConversationTurn`
- `buildConversationResult`
- `calculateNextRateFromConversationScore`

### 5단계: 화면 추가

- `ConversationScreen`
- `ConversationResultScreen`

### 6단계: 선택기 연결

- 기존 `questionSelector`와 별도 `learningActivitySelector` 도입 검토
- 일반 문제와 회화 세션 중 무엇을 낼지 결정

### 7단계: QA

- API 실패
- 네트워크 끊김
- 키보드 입력
- 긴 답변
- 한국어 답변
- 의미 불명 답변
- 같은 시나리오 반복 방지

## 16. 테스트 기준

필수 테스트:

- 회화 시나리오가 현재 레벨에 맞게 선택된다.
- 최근 고득점 시나리오는 fresh 후보에서 제외된다.
- 낮은 점수의 회화 결과는 `conversation` 약점으로 저장된다.
- 회화 점수에 따라 Rate가 변한다.
- 기존 저장 데이터에 `recentConversationResults`가 없어도 로드된다.
- API 응답이 비정상이어도 앱이 크래시하지 않는다.
- 회화 세션 종료 조건이 동작한다.
- 결과 화면에 교정 예시가 표시된다.

수동 QA:

- 카페 주문 시나리오에서 5턴 대화 후 평가가 나온다.
- 사용자가 짧게 답해도 AI가 다음 질문을 한다.
- 사용자가 한국어만 입력하면 다시 영어로 말하라고 한다.
- 새 시나리오 ID라도 `requiredSlots`만 있으면 다음 질문과 종료 조건이 동작한다.
- 이미 채운 슬롯은 다시 묻지 않는다.
- 목표를 달성하면 최대 턴 전에도 종료될 수 있다.
- 결과 화면에서 다음 문제로 돌아간다.

## 17. 성공 기준

MVP 성공 기준:

- 사용자가 앱을 켰을 때 회화가 필요한 경우 회화 세션이 바로 나온다.
- 사용자가 4~6턴 동안 AI와 영어로 대화할 수 있다.
- AI는 사용자의 답변에 맞춰 다음 대사를 자연스럽게 만든다.
- 대화 종료 후 점수와 한국어 피드백이 나온다.
- 회화 결과가 로컬 학습 상태와 Rate에 반영된다.
- 같은 회화 시나리오가 불필요하게 반복되지 않는다.
- OpenAI API Key가 APK에 포함되지 않는다.

## 18. 다음 결정 사항

구현 전에 결정해야 할 것:

- 회화 세션을 몇 턴으로 고정할지
- A1/A2 초기 시나리오를 몇 개 넣을지
- 회화 점수의 Rate 반영 폭을 기존 일반 문제와 동일하게 둘지
- 회화 결과가 승급 시험 진입 조건에 얼마나 영향을 줄지
- API 실패 시 mock fallback을 사용자에게 허용할지, 재시도만 허용할지
- 회화 시나리오 팩을 question pack과 같은 Hosting 구조로 둘지, 별도 manifest로 둘지
