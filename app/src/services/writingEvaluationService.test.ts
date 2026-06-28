import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LearningQuestion } from '../types/learning';
import {
  evaluateWritingAnswer,
  evaluateWritingAnswerLocally,
} from './writingEvaluationService';

const foodWritingQuestion = {
  id: 'a1-writing-like-food-001',
  level: 'A1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '좋아하는 음식을 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'I like apples.',
  evaluationFocusKo: 'I like ... 문장 구조와 음식 단어 사용',
  expectedKeywords: ['i', 'like'],
  explanationKo: 'I like 뒤에 좋아하는 음식을 쓰면 됩니다.',
  weakPointLabel: '좋아하는 것 말하기',
} as unknown as LearningQuestion;

const introductionWritingQuestion = {
  id: 'a1-writing-introduction-001',
  level: 'A1',
  area: 'grammar',
  kind: 'writing',
  promptKo: '자기소개를 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'My name is Mina.',
  evaluationFocusKo: 'My name is ... 기본 자기소개 문장 구조',
  expectedKeywords: ['my', 'name', 'is'],
  explanationKo: 'My name is 뒤에 이름을 쓰면 자연스러운 자기소개 문장이 됩니다.',
  weakPointLabel: '기본 자기소개',
} as unknown as LearningQuestion;

const moodTodayWritingQuestion = {
  id: 'a1-writing-feeling-001',
  level: 'A1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '\uB2E4\uC74C \uBB38\uC7A5\uC744 \uC601\uC5B4\uB85C \uC4F0\uC138\uC694: \uC800\uB294 \uC624\uB298 \uAE30\uBD84\uC774 \uC88B\uC2B5\uB2C8\uB2E4.',
  sampleAnswer: 'I am happy today.',
  evaluationFocusKo: 'I am ... today emotion expression',
  expectedKeywords: ['i', 'am', 'today'],
  explanationKo: 'Use I am ... today to describe your mood.',
  weakPointLabel: 'emotion expression',
} as unknown as LearningQuestion;

const negativeCoffeeWritingQuestion = {
  id: 'a1-double-conversation-writing-004',
  level: 'A1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '다음 문장을 영어로 쓰세요: 저는 커피를 좋아하지 않습니다.',
  sampleAnswer: 'I do not like coffee.',
  evaluationFocusKo: '부정 표현 표현을 정확하고 자연스럽게 사용했는지 평가합니다.',
  expectedKeywords: ['not', 'like', 'coffee'],
  explanationKo: '일반동사 부정문은 do not + 동사원형입니다.',
  weakPointLabel: '부정 표현',
} as unknown as LearningQuestion;

const friendIntroductionWritingQuestion = {
  id: 'a1-writing-introduce-friend-002',
  level: 'A1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '\uCE5C\uAD6C\uB97C \uD55C \uBB38\uC7A5\uC73C\uB85C \uC18C\uAC1C\uD574 \uBCF4\uC138\uC694.',
  sampleAnswer: 'This is my friend Mina.',
  evaluationFocusKo: 'This is ... structure and my/friend introduction expression',
  expectedKeywords: ['friend'],
  explanationKo: 'This is ... is a common way to introduce someone.',
  weakPointLabel: 'friend introduction',
} as unknown as LearningQuestion;

const weekendPlanWritingQuestion = {
  id: 'a2-writing-weekend-plan-001',
  level: 'A2',
  area: 'grammar',
  kind: 'writing',
  promptKo: '이번 주말 계획을 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'I am going to visit my friend this weekend.',
  evaluationFocusKo: 'be going to 미래 계획 표현과 시간 표현',
  expectedKeywords: ['going', 'visit', 'weekend'],
  explanationKo: 'I am going to 뒤에 할 일을 쓰면 계획을 표현할 수 있습니다.',
  weakPointLabel: '미래 계획 표현',
} as unknown as LearningQuestion;

const pastTripWritingQuestion = {
  id: 'b1-writing-trip-past-001',
  level: 'B1',
  area: 'grammar',
  kind: 'writing',
  promptKo: '지난 여행 경험을 과거시제로 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'I visited Busan last summer and enjoyed the beach.',
  evaluationFocusKo: '과거시제 동사와 여행 경험 표현',
  expectedKeywords: ['visited', 'last', 'enjoyed'],
  explanationKo: '지난 경험은 visited, enjoyed 같은 과거시제 동사를 사용합니다.',
  weakPointLabel: '과거 여행 경험',
} as unknown as LearningQuestion;

const politeDisagreementWritingQuestion = {
  id: 'b2-writing-polite-disagreement-001',
  level: 'B2',
  area: 'conversation',
  kind: 'writing',
  promptKo: '상대 의견에 공손하게 반대하는 영어 한 문장을 쓰세요.',
  sampleAnswer: 'I understand your point, but I see the issue differently.',
  evaluationFocusKo: '상대 의견 인정 후 but으로 다른 관점 제시',
  expectedKeywords: ['understand', 'point', 'but', 'differently'],
  explanationKo: 'I understand your point로 상대를 인정한 뒤 다른 관점을 말하면 공손합니다.',
  weakPointLabel: '공손한 반대 표현',
} as unknown as LearningQuestion;

const onlineClassOpinionWritingQuestion = {
  id: 'b1-writing-online-class-opinion-001',
  level: 'B1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '온라인 수업에 대한 의견을 이유와 함께 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'I think online classes are convenient because I can study at home.',
  evaluationFocusKo: 'I think ... because ... 의견과 이유 연결',
  expectedKeywords: ['think', 'because', 'online', 'classes'],
  explanationKo: 'I think로 의견을 시작하고 because로 이유를 연결하면 좋습니다.',
  weakPointLabel: '의견과 이유 연결',
} as unknown as LearningQuestion;

const flexibleWorkWritingQuestion = {
  id: 'b2-writing-flexible-work-001',
  level: 'B2',
  area: 'reading',
  kind: 'writing',
  promptKo: '유연근무의 장점을 조건과 함께 영어 한 문장으로 쓰세요.',
  sampleAnswer: 'Flexible work can improve productivity if teams communicate clearly.',
  evaluationFocusKo: '주장, 조건절, productivity 같은 추상 명사 사용',
  expectedKeywords: ['flexible', 'productivity', 'if', 'communicate'],
  explanationKo: '조건절 if를 사용해 주장이 성립하는 조건을 함께 제시할 수 있습니다.',
  weakPointLabel: '조건이 있는 주장',
} as unknown as LearningQuestion;

const politeRequestWritingQuestion = {
  id: 'a2-writing-polite-request-001',
  level: 'A2',
  area: 'conversation',
  kind: 'writing',
  promptKo: '친구에게 숙제를 도와 달라고 정중하게 요청하는 문장을 쓰세요.',
  sampleAnswer: 'Could you help me with my homework?',
  evaluationFocusKo: 'Could you ...? 정중한 요청 표현',
  expectedKeywords: ['could', 'help', 'homework'],
  explanationKo: 'Could you help me with ...?는 도움을 정중하게 요청할 때 씁니다.',
  weakPointLabel: '정중한 요청',
} as unknown as LearningQuestion;

const askWeekendPlanWritingQuestion = {
  id: 'b1-extra-conversation-writing-001',
  level: 'B1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '\uCE5C\uAD6C\uC5D0\uAC8C \uC8FC\uB9D0 \uACC4\uD68D\uC744 \uBB3B\uB294 \uBB38\uC7A5\uC744 \uC601\uC5B4\uB85C \uC4F0\uC138\uC694.',
  sampleAnswer: 'What are you planning to do this weekend?',
  evaluationFocusKo: 'Ask about weekend plans with a natural question.',
  expectedKeywords: ['what', 'planning', 'weekend'],
  explanationKo: 'Ask naturally about weekend plans.',
  weakPointLabel: 'asking about plans',
} as unknown as LearningQuestion;

const requestReportByTomorrowWritingQuestion = {
  id: 'b1-extra-conversation-writing-002',
  level: 'B1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '\uB3D9\uB8CC\uC5D0\uAC8C \uBCF4\uACE0\uC11C\uB97C \uB0B4\uC77C\uAE4C\uC9C0 \uBCF4\uB0B4 \uB2EC\uB77C\uACE0 \uC815\uC911\uD788 \uC694\uCCAD\uD558\uC138\uC694.',
  sampleAnswer: 'Could you send me the report by tomorrow?',
  evaluationFocusKo: 'Could you and by tomorrow polite request.',
  expectedKeywords: ['could you', 'report', 'tomorrow'],
  explanationKo: 'Use a polite request and a deadline.',
  weakPointLabel: 'work request',
} as unknown as LearningQuestion;

const refundRequestWritingQuestion = {
  id: 'b1-extra-conversation-writing-005',
  level: 'B1',
  area: 'conversation',
  kind: 'writing',
  promptKo: '\uAC00\uAC8C \uC9C1\uC6D0\uC5D0\uAC8C \uD658\uBD88\uC774 \uAC00\uB2A5\uD55C\uC9C0 \uC815\uC911\uD788 \uBB3C\uC5B4\uBCF4\uC138\uC694.',
  sampleAnswer: 'Could I get a refund for this item?',
  evaluationFocusKo: 'Could I and refund polite request.',
  expectedKeywords: ['could i', 'refund', 'item'],
  explanationKo: 'Ask politely about a refund.',
  weakPointLabel: 'refund request',
} as unknown as LearningQuestion;

const relativeClauseArticleWritingQuestion = {
  id: 'b1-extra-grammar-writing-002',
  level: 'B1',
  area: 'grammar',
  kind: 'writing',
  promptKo: '다음 문장을 영어로 쓰세요: 저는 은행에서 일하는 여자를 만났습니다.',
  sampleAnswer: 'I met a woman who works at the bank.',
  evaluationFocusKo: 'who로 사람을 설명했는지 평가합니다.',
  expectedKeywords: ['woman', 'who', 'works'],
  explanationKo: '사람을 설명하는 관계절 앞 명사에는 필요한 관사를 함께 씁니다.',
  weakPointLabel: '관계절 쓰기',
} as unknown as LearningQuestion;

const comparisonArticleWritingQuestion = {
  id: 'b1-extra-grammar-writing-005',
  level: 'B1',
  area: 'grammar',
  kind: 'writing',
  promptKo: '다음 문장을 영어로 쓰세요: 기차는 버스보다 빠릅니다.',
  sampleAnswer: 'The train is faster than the bus.',
  evaluationFocusKo: 'faster than 구조를 사용했는지 평가합니다.',
  expectedKeywords: ['train', 'faster than', 'bus'],
  explanationKo: '비교급 문장에서도 주어 명사 앞의 관사가 필요합니다.',
  weakPointLabel: '비교급 쓰기',
} as unknown as LearningQuestion;

const a1TranslationQuestion = {
  id: 'a1-reading-translation-bus-001',
  level: 'A1',
  area: 'reading',
  kind: 'writing',
  promptKo: '영어 문장을 읽고 한글로 번역하세요.',
  questionText: 'The bus arrives at nine.',
  answerLanguage: 'ko',
  timeLimitSeconds: 30,
  readingDifficulty: 'easy',
  sampleAnswer: '버스는 9시에 도착합니다.',
  expectedKeywordsKo: ['버스', '9시', '도착'],
  evaluationFocusKo: '핵심 명사, 시간, 동작을 자연스럽게 한국어로 옮기는지 평가합니다.',
  explanationKo: 'arrives는 도착한다는 뜻이고 at nine은 9시를 뜻합니다.',
  weakPointLabel: '기초 독해 번역',
} as unknown as LearningQuestion;

const b1DeliveryScheduleTranslationQuestion = {
  id: 'b1-extra-reading-translation-007',
  level: 'B1',
  area: 'reading',
  kind: 'writing',
  promptKo: '영어 지문을 읽고 한글로 번역하세요.',
  questionText: 'The company changed its delivery schedule to reduce delays during busy hours.',
  sampleAnswer: '그 회사는 바쁜 시간대의 지연을 줄이기 위해 배송 일정을 바꾸었습니다.',
  evaluationFocusKo: 'to reduce delays의 목적을 자연스럽게 번역했는지 평가합니다.',
  expectedKeywordsKo: ['회사', '배송', '지연'],
  answerLanguage: 'ko',
  readingDifficulty: 'easy',
  timeLimitSeconds: 60,
  explanationKo: 'to reduce는 줄이기 위해라는 목적 표현입니다.',
  weakPointLabel: '목적 표현 번역',
} as unknown as LearningQuestion;

describe('writingEvaluationService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scores an empty local answer as low and incorrect', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: '',
    });

    expect(result.score).toBeLessThan(40);
    expect(result.isCorrect).toBe(false);
    expect(result.feedbackKo).toContain('답안을 입력');
  });

  it('marks a local answer correct when it matches the sample answer and keywords', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: 'I like apples.',
    });

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe('I like apples.');
    expect(result.rubric).toEqual({
      taskCompletion: 35,
      meaning: 30,
      grammar: 20,
      naturalness: 15,
    });
    expect(result.scoreReasonsKo).toEqual(
      expect.arrayContaining([
        expect.stringContaining('과제'),
        expect.stringContaining('의미'),
      ]),
    );
    expect(result.skillTags).toEqual([]);
  });

  it('marks a natural food substitution correct when the expected structure is complete', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: 'I like bananas.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a natural name substitution correct when the expected structure is complete', () => {
    const result = evaluateWritingAnswerLocally({
      question: introductionWritingQuestion,
      answer: 'My name is John.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks natural mood expressions correct when wording differs from the sample', () => {
    const result = evaluateWritingAnswerLocally({
      question: moodTodayWritingQuestion,
      answer: "I'm feeling good today.",
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe("I'm feeling good today.");
    expect(result.weakAreaKo).toBe('');
  });

  it('accepts feel good today as equivalent to being happy today', () => {
    const result = evaluateWritingAnswerLocally({
      question: moodTodayWritingQuestion,
      answer: 'I feel good today.',
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.isCorrect).toBe(true);
  });

  it('accepts contracted do not answers for negative preference writing questions', () => {
    const result = evaluateWritingAnswerLocally({
      question: negativeCoffeeWritingQuestion,
      answer: "I don't like a coffee",
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe("I don't like a coffee");
  });

  it('marks a natural weekend-plan substitution correct when sample-specific action changes', () => {
    const result = evaluateWritingAnswerLocally({
      question: weekendPlanWritingQuestion,
      answer: 'I am going to play soccer this weekend.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a natural past-trip substitution correct when sample-specific details change', () => {
    const result = evaluateWritingAnswerLocally({
      question: pastTripWritingQuestion,
      answer: 'I went to Jeju last winter and ate seafood.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a polite disagreement substitution correct when the alternate opinion wording changes', () => {
    const result = evaluateWritingAnswerLocally({
      question: politeDisagreementWritingQuestion,
      answer: 'I understand your point, but I have a different opinion.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a plausible online-class opinion reason correct when sample-specific reason changes', () => {
    const result = evaluateWritingAnswerLocally({
      question: onlineClassOpinionWritingQuestion,
      answer: 'I think online classes are useful because they save time.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a plausible flexible-work condition correct when sample-specific condition changes', () => {
    const result = evaluateWritingAnswerLocally({
      question: flexibleWorkWritingQuestion,
      answer: 'Flexible work can improve productivity if teams work together.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a core-complete polite request correct when a polite modifier is added', () => {
    const result = evaluateWritingAnswerLocally({
      question: politeRequestWritingQuestion,
      answer: 'Could you please help me with my homework?',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a natural weekend-plan question correct when wording differs from the sample', () => {
    const result = evaluateWritingAnswerLocally({
      question: askWeekendPlanWritingQuestion,
      answer: 'Do you have a plan this weekend?',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a polite document-by-tomorrow request correct when document replaces report', () => {
    const result = evaluateWritingAnswerLocally({
      question: requestReportByTomorrowWritingQuestion,
      answer: 'Could you send me the document by tomorrow?',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
  });

  it('marks a polite refund possibility question correct when the item is omitted', () => {
    const result = evaluateWritingAnswerLocally({
      question: refundRequestWritingQuestion,
      answer: 'Could I have a refund?',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
    expect(result.weakAreaKo).toBe('');
  });

  it('labels a missing article before a relative-clause noun as an article weakness', () => {
    const result = evaluateWritingAnswerLocally({
      question: relativeClauseArticleWritingQuestion,
      answer: 'I met woman who works at the bank',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.weakAreaKo).toBe('관사 사용');
    expect(result.feedbackKo).toContain('a/an/the');
    expect(result.skillTags).toEqual(expect.arrayContaining(['articles']));
  });

  it('labels a missing article in a comparison sentence as an article weakness', () => {
    const result = evaluateWritingAnswerLocally({
      question: comparisonArticleWritingQuestion,
      answer: 'Train faster than a bus',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.weakAreaKo).toBe('관사 사용');
    expect(result.feedbackKo).toContain('a/an/the');
    expect(result.skillTags).toEqual(expect.arrayContaining(['articles']));
  });

  it('marks a Korean translation answer correct when core meaning is preserved', () => {
    const result = evaluateWritingAnswerLocally({
      question: a1TranslationQuestion,
      answer: '버스가 아홉 시에 도착합니다.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toMatch(/[가-힣]/);
  });

  it('gives full credit when a Korean reading translation is accepted as its own correction', () => {
    const result = evaluateWritingAnswerLocally({
      question: {
        id: 'b1-reading-translation-candidate-001',
        level: 'B1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 지문을 읽고 한글로 번역하세요.',
        questionText: 'The candidate explained why the previous project had failed.',
        sampleAnswer: '그 지원자는 이전 프로젝트가 왜 실패했는지 설명했습니다.',
        expectedKeywordsKo: ['지원자', '설명', '이전', '프로젝트', '실패'],
        answerLanguage: 'ko',
        readingDifficulty: 'hard',
        timeLimitSeconds: 90,
        evaluationFocusKo: '간접의문문과 과거완료의 핵심 의미를 자연스럽게 번역했는지 평가합니다.',
        explanationKo: 'explained why는 왜 그랬는지 설명했다는 뜻입니다.',
        weakPointLabel: '간접의문문 번역',
      } as unknown as LearningQuestion,
      answer: '그 후보자는 설명했다. 왜 이전 프로젝트가 실패했는지에 대해',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe('그 후보자는 설명했다. 왜 이전 프로젝트가 실패했는지에 대해');
    expect(result.score).toBe(100);
    expect(result.rubric).toEqual({
      taskCompletion: 35,
      meaning: 30,
      grammar: 20,
      naturalness: 15,
    });
    expect(result.scoreReasonsKo).not.toEqual(
      expect.arrayContaining([expect.stringContaining('문장부호')]),
    );
  });

  it('accepts a Korean reading translation with ticket synonyms and concession wording', () => {
    const result = evaluateWritingAnswerLocally({
      question: {
        id: 'b1-reading-translation-ticket-worth-001',
        level: 'B1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 지문을 읽고 한글로 번역하세요.',
        questionText: 'Although the ticket was expensive, the performance was worth the price.',
        sampleAnswer: '표는 비쌌지만 그 공연은 가격만큼 가치가 있었습니다.',
        expectedKeywordsKo: ['표', '비쌌', '가치'],
        answerLanguage: 'ko',
        readingDifficulty: 'hard',
        timeLimitSeconds: 90,
        evaluationFocusKo: 'Although와 worth the price를 자연스럽게 옮겼는지 평가합니다.',
        explanationKo: 'Although는 양보를 나타냅니다.',
        weakPointLabel: '양보 구문 번역',
      } as unknown as LearningQuestion,
      answer: '티켓이 비쌈에도, 공연은 가격만큼 가치있었다.',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(result.correctedAnswer).toBe('티켓이 비쌈에도, 공연은 가격만큼 가치있었다.');
  });

  it('uses learner-facing focus terms for incomplete Korean reading translation feedback', () => {
    const result = evaluateWritingAnswerLocally({
      question: {
        id: 'b1-reading-translation-ticket-worth-002',
        level: 'B1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 지문을 읽고 한글로 번역하세요.',
        questionText: 'Although the ticket was expensive, the performance was worth the price.',
        sampleAnswer: '표는 비쌌지만 그 공연은 가격만큼 가치가 있었습니다.',
        expectedKeywordsKo: ['표', '비쌌', '가치'],
        answerLanguage: 'ko',
        readingDifficulty: 'hard',
        timeLimitSeconds: 90,
        evaluationFocusKo: 'Although와 worth the price를 자연스럽게 옮겼는지 평가합니다.',
        explanationKo: 'Although는 양보를 나타냅니다.',
        weakPointLabel: '양보 구문 번역',
      } as unknown as LearningQuestion,
      answer: '티켓이 비쌌다.',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.feedbackKo).toContain('Although, worth the price');
    expect(result.feedbackKo).not.toContain('표, 비쌌');
  });

  it('rejects English answers for Korean translation questions', () => {
    const result = evaluateWritingAnswerLocally({
      question: a1TranslationQuestion,
      answer: 'The bus arrives at nine.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
    expect(result.feedbackKo).toContain('한글');
  });

  it.each(['I like sushi.', 'I like kimchi.'])(
    'marks a common food substitution correct: %s',
    (answer) => {
      const result = evaluateWritingAnswerLocally({
        question: foodWritingQuestion,
        answer,
      });

      expect(result.score).toBe(100);
      expect(result.isCorrect).toBe(true);
      expect(result.weakAreaKo).toBe('');
    },
  );

  it('explains a misspelled food answer with a targeted correction', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: 'i like susui it is very delicious',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.correctedAnswer).toBe('I like sushi because it is very delicious.');
    expect(result.feedbackKo).toContain('sushi');
    expect(result.feedbackKo).toContain('because');
    expect(result.rubric).toBeDefined();
    expect(
      Object.values(result.rubric ?? {}).reduce((total, score) => total + score, 0),
    ).toBe(result.score);
    expect(result.scoreReasonsKo).toEqual(
      expect.arrayContaining([expect.stringContaining('보완')]),
    );
    expect(result.skillTags).toEqual(expect.arrayContaining(['vocabulary_range']));
    expect(result.feedbackKo).not.toContain('구체적인 내용');
  });

  it('marks an incomplete local answer incorrect even when short expected keywords match', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: 'I like',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
    expect(result.feedbackKo).toContain('구체적인 내용');
  });

  it('keeps a low-quality replacement incorrect even when the expected structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: 'I like table.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('keeps a nonsensical weekend-plan replacement incorrect even when structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: weekendPlanWritingQuestion,
      answer: 'I am going to table this weekend.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('keeps unrelated polite-disagreement content incorrect even when contrast structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: politeDisagreementWritingQuestion,
      answer: 'I understand your point, but pizza sushi.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('keeps unrelated past-trip content incorrect even when the time structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: pastTripWritingQuestion,
      answer: 'I went to Jeju last winter and pizza sushi.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('keeps unrelated online-class opinion content incorrect even when opinion structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: onlineClassOpinionWritingQuestion,
      answer: 'I think online classes are good because pizza sushi.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('keeps unrelated flexible-work content incorrect even when condition structure matches', () => {
    const result = evaluateWritingAnswerLocally({
      question: flexibleWorkWritingQuestion,
      answer: 'Flexible work can improve productivity if pizza sushi.',
    });

    expect(result.score).toBeLessThan(75);
    expect(result.isCorrect).toBe(false);
  });

  it('accepts a clear friend-introduction answer even when the tone is negative', () => {
    const result = evaluateWritingAnswerLocally({
      question: friendIntroductionWritingQuestion,
      answer: 'My friend is stupid.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
    expect(result.feedbackKo).toContain('\uD45C\uD604');
  });

  it('scores a Korean-only local answer as very low and incorrect', () => {
    const result = evaluateWritingAnswerLocally({
      question: foodWritingQuestion,
      answer: '나는 사과를 좋아해요.',
    });

    expect(result.score).toBeLessThan(20);
    expect(result.isCorrect).toBe(false);
    expect(result.feedbackKo).toContain('영어');
  });

  it('falls back to local evaluation when the server API fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: foodWritingQuestion,
      answer: 'I like apples.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://englishproject-c42b2.web.app/api/writing/evaluate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.isCorrect).toBe(true);
    expect(result.evaluationSource).toBe('localFallback');
  });

  it('does not trust a low-score API response that claims the answer is correct', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 20,
        isCorrect: true,
        correctedAnswer: 'I like apples.',
        feedbackKo: '좋습니다.',
        weakAreaKo: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: foodWritingQuestion,
      answer: 'I like',
    });

    expect(result.score).toBe(20);
    expect(result.isCorrect).toBe(false);
    expect(result.evaluationSource).toBe('ai');
    expect(result.rubric).toBeDefined();
    expect(result.scoreReasonsKo?.length).toBeGreaterThan(0);
    expect(result.skillTags).toEqual(['vocabulary_range']);
  });

  it('preserves rubric details from a trusted API response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 82,
        isCorrect: true,
        correctedAnswer: 'Could you help me with my homework?',
        feedbackKo: '과제를 충족했습니다.',
        weakAreaKo: '',
        rubric: {
          taskCompletion: 30,
          meaning: 25,
          grammar: 17,
          naturalness: 10,
        },
        scoreReasonsKo: ['과제 요구를 충족했습니다.', '요청 표현이 자연스럽습니다.'],
        skillTags: ['polite_requests'],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: politeRequestWritingQuestion,
      answer: 'Could you help me with my homework?',
    });

    expect(result.score).toBe(82);
    expect(result.rubric).toEqual({
      taskCompletion: 30,
      meaning: 25,
      grammar: 17,
      naturalness: 10,
    });
    expect(result.scoreReasonsKo).toEqual([
      '과제 요구를 충족했습니다.',
      '요청 표현이 자연스럽습니다.',
    ]);
    expect(result.skillTags).toEqual(['polite_requests']);
  });

  it('does not trust a low-score API response that rejects a clear friend introduction only for tone', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 20,
        isCorrect: false,
        correctedAnswer: 'This is my friend Mina.',
        feedbackKo: '\uB0B4\uC6A9\uC774 \uBD80\uC815\uC801\uC785\uB2C8\uB2E4.',
        weakAreaKo: '\uD45C\uD604\uC758 \uC5B4\uAC10',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: friendIntroductionWritingQuestion,
      answer: 'My friend is stupid.',
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe('My friend is stupid.');
    expect(result.evaluationSource).toBe('ai');
  });

  it('normalizes a high-score correct API writing response to a clean full-score result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 95,
        isCorrect: true,
        correctedAnswer: 'I like sushi.',
        feedbackKo: 'Good, but try more food words.',
        weakAreaKo: 'No real weakness.',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: foodWritingQuestion,
      answer: 'I like sushi.',
    });

    expect(result.score).toBe(100);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe('I like sushi.');
    expect(result.feedbackKo).toContain('잘 사용');
    expect(result.weakAreaKo).toBe('');
    expect(result.evaluationSource).toBe('ai');
  });

  it('does not reject a high-score API translation response only because the answer is Korean', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 90,
        isCorrect: true,
        correctedAnswer: '버스는 9시에 도착합니다.',
        feedbackKo: '핵심 의미를 정확히 옮겼습니다.',
        weakAreaKo: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: a1TranslationQuestion,
      answer: '버스가 아홉 시에 도착합니다.',
    });

    expect(result.score).toBe(90);
    expect(result.isCorrect).toBe(true);
    expect(result.evaluationSource).toBe('ai');
  });

  it('accepts a local Korean translation with equivalent spacing and delivery wording', () => {
    const result = evaluateWritingAnswerLocally({
      question: b1DeliveryScheduleTranslationQuestion,
      answer: '그 회사는 바쁜시간동안 지연을 줄이기 위해 배달일정을 변경했다.',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.weakAreaKo).toBe('');
  });

  it('gives full credit to a complete equivalent local Korean translation', () => {
    const result = evaluateWritingAnswerLocally({
      question: b1DeliveryScheduleTranslationQuestion,
      answer: '그 회사는 바쁜시간에 지연을 줄이고자 배달일정을 변경했다.',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(100);
    expect(result.correctedAnswer).toBe('그 회사는 바쁜시간에 지연을 줄이고자 배달일정을 변경했다.');
  });

  it('rejects a local Korean translation that only mentions topic keywords but misses the action', () => {
    const result = evaluateWritingAnswerLocally({
      question: b1DeliveryScheduleTranslationQuestion,
      answer: '그 회사는 바쁜 시간대에 배송 지연이 있었다.',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeLessThan(75);
    expect(result.weakAreaKo).toContain('to reduce delays');
  });

  it('accepts a high-score API translation response when the correction matches the answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 88,
        isCorrect: false,
        correctedAnswer: '차 마실래?',
        feedbackKo: '자연스럽고 의미도 잘 전달됐습니다.',
        weakAreaKo: '질문 이해',
        scoreReasonsKo: [
          '과제 요구를 완전히 충족하지 못했습니다.',
          '직역형 표현에서는 Do you want를 어떻게 자연스럽게 질문으로 옮기는지 더 연습하면 좋습니다.',
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const teaTranslationQuestion = {
      ...a1TranslationQuestion,
      id: 'a1-reading-translation-tea-001',
      questionText: 'Do you want some tea?',
      sampleAnswer: '차 마실래?',
      expectedKeywordsKo: ['차', '마실래'],
    } as unknown as LearningQuestion;

    const result = await evaluateWritingAnswer({
      question: teaTranslationQuestion,
      answer: '차 마실래?',
    });

    expect(result.score).toBe(88);
    expect(result.isCorrect).toBe(true);
    expect(result.correctedAnswer).toBe('차 마실래?');
    expect(result.weakAreaKo).toBe('');
    expect(result.scoreReasonsKo).toEqual(
      expect.arrayContaining([expect.stringContaining('충족')]),
    );
    expect(result.evaluationSource).toBe('ai');
  });

  it('accepts a natural Korean contraction for a high-score friends translation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 78,
        isCorrect: false,
        correctedAnswer: '우리는 친구입니다.',
        feedbackKo: '의미는 잘 전달되었습니다.',
        weakAreaKo: '주어와 보어의 관계',
        scoreReasonsKo: [
          '과제 요구를 완전히 충족하지 못했습니다.',
          '주어와 보어의 관계를 문장형에 맞게 정중하고 자연스럽게 번역하는 부분을 더 연습하세요.',
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const friendsTranslationQuestion = {
      ...a1TranslationQuestion,
      id: 'a1-reading-translation-friends-001',
      questionText: 'We are friends.',
      sampleAnswer: '우리는 친구입니다.',
      expectedKeywordsKo: ['우리', '친구'],
    } as unknown as LearningQuestion;

    const result = await evaluateWritingAnswer({
      question: friendsTranslationQuestion,
      answer: '우린 친구야',
    });

    expect(result.score).toBe(78);
    expect(result.isCorrect).toBe(true);
    expect(result.weakAreaKo).toBe('');
    expect(result.skillTags).toEqual([]);
    expect(result.evaluationSource).toBe('ai');
  });

  it('rejects a high-score API translation response when the Korean answer misses core meaning', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 92,
        isCorrect: true,
        correctedAnswer: '오늘 날씨가 좋습니다.',
        feedbackKo: '좋습니다.',
        weakAreaKo: '',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateWritingAnswer({
      question: a1TranslationQuestion,
      answer: '오늘 날씨가 좋습니다.',
    });

    expect(result.score).toBe(92);
    expect(result.isCorrect).toBe(false);
    expect(result.evaluationSource).toBe('ai');
  });
});
