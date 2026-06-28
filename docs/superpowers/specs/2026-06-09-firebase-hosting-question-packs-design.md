# Firebase Hosting Question Packs Design

## Korean

### 1. 목적

이 문서는 영어 학습 앱의 문제 데이터를 APK 안에 계속 추가하지 않고, Firebase Hosting에 정적 JSON 문제팩으로 배포하는 구조를 정의한다.

사용자별 실력, Rate, 최근 풀이 기록, 정답/오답 기록은 계속 로컬에 저장한다. Firebase Hosting은 문제 콘텐츠 배포에만 사용한다.

대상 Firebase 프로젝트:

```text
englishproject-c42b2
```

### 2. 결정 사항

- 문제 데이터는 Firebase Hosting의 정적 JSON 파일로 관리한다.
- 앱은 시작 시 로컬 플레이어 상태를 먼저 불러온다.
- 앱은 로컬에 캐시된 문제팩이 있으면 즉시 문제를 보여준다.
- 캐시가 없거나 오래되었으면 Firebase Hosting에서 최신 문제팩을 내려받는다.
- 네트워크 실패 시 앱에 포함된 최소 기본 문제팩을 사용한다.
- 문제 선택, 반복 빈도 조절, Rate 계산, 승급 조건 판단은 앱 로컬 로직이 담당한다.
- OpenAI API Key는 앱에 넣지 않는다. 영작 평가는 기존처럼 서버 API를 통해 처리한다.

### 3. 제외 사항

이번 설계에서는 아래 항목을 구현 범위에 넣지 않는다.

- Firestore에서 문제를 직접 쿼리하는 구조
- 앱에서 문제를 작성하거나 수정하는 관리자 화면
- 사용자 학습 기록의 서버 동기화
- 로그인 기반 사용자 계정
- Firebase Functions 기반 문제 생성
- OpenAI Key를 클라이언트에 저장하는 방식

### 4. Firebase Hosting 파일 구조

Firebase Hosting에는 앱 번들과 별도로 문제팩 파일을 배포한다.

```text
public/
  question-packs/
    manifest.json
    packs/
      a1.v1.json
      a2.v1.json
      b1.v1.json
      b2.v1.json
```

배포 후 예상 URL:

```text
https://englishproject-c42b2.web.app/question-packs/manifest.json
https://englishproject-c42b2.web.app/question-packs/packs/a1.v1.json
```

### 5. Manifest 스키마

`manifest.json`은 현재 사용 가능한 문제팩 버전과 파일 위치를 알려준다.

```json
{
  "schemaVersion": 1,
  "publishedAt": "2026-06-09T00:00:00.000Z",
  "packs": [
    {
      "level": "A1",
      "version": 1,
      "path": "packs/a1.v1.json",
      "questionCount": 24
    }
  ]
}
```

규칙:

- `schemaVersion`은 앱이 이해할 수 있는 문제팩 형식 버전이다.
- `publishedAt`은 운영자가 배포한 시각이다.
- `packs[].level`은 `A1`, `A2`, `B1`, `B2` 중 하나다.
- `packs[].version`은 같은 레벨 문제팩이 바뀔 때 증가한다.
- `packs[].path`는 `manifest.json` 위치 기준 상대 경로다.
- `questionCount`는 QA와 운영 확인용이다.
- 파일 무결성 checksum은 v1 범위에서 제외한다. 필요해지면 manifest schemaVersion을 올려 별도 설계로 추가한다.

### 6. 문제팩 스키마

각 레벨 문제팩은 앱의 현재 `LearningQuestion` 타입과 호환되는 JSON 배열을 가진다.

```json
{
  "schemaVersion": 1,
  "level": "A1",
  "version": 1,
  "publishedAt": "2026-06-09T00:00:00.000Z",
  "questions": [
    {
      "id": "a1-reading-main-001",
      "level": "A1",
      "area": "reading",
      "kind": "choice",
      "promptKo": "문장을 읽고 의미가 맞는 것을 고르세요.",
      "questionText": "Tom has a red bag.",
      "choices": [
        { "id": "a", "text": "Tom has a blue bag." },
        { "id": "b", "text": "Tom has a bag that is red." },
        { "id": "c", "text": "Tom has two bags." }
      ],
      "correctChoiceId": "b",
      "explanationKo": "red bag은 빨간 가방이라는 뜻입니다.",
      "weakPointLabel": "기초 독해"
    },
    {
      "id": "a1-writing-food-001",
      "level": "A1",
      "area": "conversation",
      "kind": "writing",
      "promptKo": "좋아하는 음식을 영어 한 문장으로 쓰세요.",
      "sampleAnswer": "I like pizza.",
      "evaluationFocusKo": "좋아하는 음식을 I like ... 형태로 자연스럽게 말할 수 있는지 확인합니다.",
      "expectedKeywords": ["like"]
    }
  ]
}
```

검증 규칙:

- `id`는 전체 문제팩에서 고유해야 한다.
- `level`은 파일의 레벨과 같아야 한다.
- `area`는 `reading`, `conversation`, `grammar` 중 하나다.
- `kind`는 `choice` 또는 `writing`이다.
- `choice` 문제는 `choices`와 `correctChoiceId`가 필수다.
- `writing` 문제는 `sampleAnswer`와 `evaluationFocusKo`가 필수다.
- 독해 문제에서 `questionText`와 정답 선택지 텍스트가 완전히 같으면 안 된다.
- 각 레벨은 승급시험 5문제와 최소 3회 일반 세션을 버틸 수 있도록 충분한 문제 수를 가진다.

### 7. 앱 시작 흐름

앱은 문제팩 다운로드 때문에 첫 화면을 늦추지 않는다.

```text
앱 실행
-> 로컬 학습 상태 로드
-> 로컬 문제팩 캐시 로드
-> 사용 가능한 문제팩으로 즉시 문제 세션 생성
-> 백그라운드에서 manifest 확인
-> 새 버전이 있으면 해당 레벨 문제팩 다운로드
-> 검증 성공 시 캐시 교체
-> 다음 세션부터 새 문제팩 사용
```

캐시가 없는 최초 실행에서는 앱에 내장된 최소 기본 문제팩을 사용한다. 네트워크 다운로드가 성공하면 다음 세션부터 Firebase Hosting 문제팩을 사용한다.

### 8. 로컬 캐시 정책

초기 구현은 `AsyncStorage` 기반 JSON 캐시로 시작한다.

저장할 값:

```ts
type CachedQuestionPackState = {
  schemaVersion: 1;
  manifestPublishedAt: string;
  packs: {
    A1?: CachedLevelPack;
    A2?: CachedLevelPack;
    B1?: CachedLevelPack;
    B2?: CachedLevelPack;
  };
};

type CachedLevelPack = {
  level: LearnerLevel;
  version: number;
  publishedAt: string;
  questions: LearningQuestion[];
  cachedAt: string;
};
```

규칙:

- 캐시는 학습 상태와 별도 key로 저장한다.
- 학습 상태 저장 실패와 문제팩 캐시 저장 실패는 별도로 처리한다.
- 문제팩 캐시 저장 실패가 있어도 현재 세션은 계속 진행한다.
- 문제팩이 커져서 AsyncStorage 한계가 보이면 Expo SQLite 또는 파일 기반 캐시로 전환한다.

### 9. 문제 선택과 반복 빈도

Firebase Hosting은 문제를 제공만 한다. 반복 빈도 조절은 기존 로컬 `questionSelector`가 담당한다.

규칙:

- 최근 맞힌 문제는 재출제 우선순위를 낮춘다.
- 최근 틀린 문제는 복습 우선순위를 높인다.
- 새 문제팩이 내려와도 기존 학습 기록은 유지한다.
- 삭제된 문제 id가 최근 기록에 남아 있어도 앱은 무시하고 계속 동작한다.
- 문제 수가 부족한 레벨은 앱 검증에서 실패하도록 한다.

### 10. 실패 처리

네트워크 또는 배포 오류가 있어도 앱은 문제를 계속 보여줘야 한다.

처리:

- `manifest.json` 다운로드 실패: 기존 캐시 또는 내장 기본 문제팩 사용
- 문제팩 JSON 다운로드 실패: 해당 레벨은 기존 캐시 유지
- JSON 파싱 실패: 새 문제팩 폐기
- 스키마 검증 실패: 새 문제팩 폐기
- 레벨별 문제 수 부족: 새 문제팩 폐기
- 일부 문제 id 중복: 새 문제팩 폐기

사용자에게는 복잡한 오류 화면을 보여주지 않는다. 개발 로그와 테스트에서만 원인을 확인한다.

### 11. 배포 절차

운영자가 문제를 늘릴 때의 기본 절차:

```text
1. 로컬에서 question-packs/packs/a1.v2.json 작성
2. 문제팩 검증 스크립트 실행
3. manifest.json의 A1 version/path/questionCount 갱신
4. Firebase Hosting 배포
5. 앱에서 다음 세션부터 새 문제팩 사용 확인
```

예상 명령:

```powershell
firebase.cmd use englishproject-c42b2
firebase.cmd deploy --only hosting
```

### 12. 테스트 기준

구현 후 최소 테스트:

- manifest 파싱 테스트
- 문제팩 스키마 검증 테스트
- 잘못된 choice 문제 거부 테스트
- 잘못된 writing 문제 거부 테스트
- 캐시가 없을 때 내장 문제팩 fallback 테스트
- manifest 다운로드 실패 시 기존 캐시 유지 테스트
- 새 버전 다운로드 성공 시 캐시 교체 테스트
- 문제팩 변경 후에도 최근 정답 문제 반복 빈도가 낮아지는지 테스트

### 13. 성공 기준

- APK에 많은 문제를 넣지 않아도 문제를 계속 늘릴 수 있다.
- 앱은 실행 즉시 문제를 보여준다.
- Firebase Hosting 장애가 있어도 기존 캐시나 기본 문제로 학습이 계속된다.
- 사용자별 실력 데이터는 로컬에 유지된다.
- 문제 업데이트는 앱 재배포 없이 가능하다.

## English

### 1. Purpose

This design moves English-learning question content out of the APK and into static JSON packs served by Firebase Hosting.

Learner level, Rate, recent results, and correct/incorrect history remain local. Firebase Hosting is used only for distributing question content.

Firebase project:

```text
englishproject-c42b2
```

### 2. Architecture

- Firebase Hosting serves `manifest.json` and level-specific question-pack JSON files.
- The app loads local learner state first.
- The app shows a question immediately from cached packs or a bundled fallback pack.
- The app checks the remote manifest in the background.
- If a newer pack is available, the app downloads, validates, and caches it.
- Question selection, repeat suppression, Rate calculation, and promotion logic remain local.
- OpenAI API keys never live in the app.

### 3. Hosting Layout

```text
public/
  question-packs/
    manifest.json
    packs/
      a1.v1.json
      a2.v1.json
      b1.v1.json
      b2.v1.json
```

Expected URLs:

```text
https://englishproject-c42b2.web.app/question-packs/manifest.json
https://englishproject-c42b2.web.app/question-packs/packs/a1.v1.json
```

### 4. Runtime Flow

```text
App launch
-> Load local learner state
-> Load cached question packs
-> Start a session immediately
-> Fetch remote manifest in the background
-> Download newer packs when available
-> Validate downloaded JSON
-> Replace cache after validation
-> Use the new pack from the next session
```

### 5. Failure Model

Remote content must never block learning.

- Manifest fetch fails: use cache or bundled fallback.
- Pack fetch fails: keep the existing cached pack for that level.
- JSON parse fails: discard the downloaded pack.
- Schema validation fails: discard the downloaded pack.
- Insufficient question count: discard the downloaded pack.
- Duplicate question ids: discard the downloaded pack.

### 6. Scope

Included:

- Static question-pack files on Firebase Hosting.
- Manifest-based versioning.
- App-side cache and fallback behavior.
- App-side validation before cache replacement.

Excluded:

- Direct Firestore question queries.
- Admin UI for editing questions.
- Server-side learner progress sync.
- Login/account support.
- Client-side OpenAI keys.

### 7. Acceptance Criteria

- The APK can stay small while question content grows remotely.
- The first screen still shows a question immediately.
- The app keeps working when Firebase Hosting is unavailable.
- User-specific learning data remains local.
- Question updates can ship without rebuilding the app.
