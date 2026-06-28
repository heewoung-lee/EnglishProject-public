import { describe, expect, it } from 'vitest';

import type { LearningQuestion } from '../types/learning';
import {
  formatTimeLimitLabel,
  getQuestionDisplayParts,
  getWritingAnswerAccessibilityLabel,
  getWritingAnswerPlaceholder,
  isKoreanTranslationQuestion,
  isTimedTranslationExpired,
  shouldAutoSubmitTimedTranslation,
} from './practiceQuestionPresentation';

const translationQuestion = {
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
  evaluationFocusKo: '핵심 의미를 한글로 옮기는지 평가합니다.',
  explanationKo: 'arrives는 도착한다는 뜻입니다.',
} as unknown as LearningQuestion;

const englishWritingQuestion = {
  ...translationQuestion,
  id: 'a1-writing-food-001',
  area: 'conversation',
  promptKo: '좋아하는 음식을 영어 한 문장으로 쓰세요.',
  questionText: undefined,
  answerLanguage: undefined,
  timeLimitSeconds: undefined,
  readingDifficulty: undefined,
  sampleAnswer: 'I like apples.',
  expectedKeywordsKo: undefined,
  expectedKeywords: ['i', 'like'],
} as unknown as LearningQuestion;

describe('practiceQuestionPresentation', () => {
  it('identifies Korean translation questions', () => {
    expect(isKoreanTranslationQuestion(translationQuestion)).toBe(true);
    expect(isKoreanTranslationQuestion(englishWritingQuestion)).toBe(false);
  });

  it('uses Korean translation input copy for translation questions', () => {
    expect(getWritingAnswerPlaceholder(translationQuestion)).toBe('한글 번역을 입력하세요.');
    expect(getWritingAnswerAccessibilityLabel(translationQuestion)).toBe('한글 번역 답안');
  });

  it('keeps English writing copy for normal writing questions', () => {
    expect(getWritingAnswerPlaceholder(englishWritingQuestion)).toBe('영어 문장을 입력하세요.');
    expect(getWritingAnswerAccessibilityLabel(englishWritingQuestion)).toBe('영작 답안');
  });

  it('separates source text embedded after a prompt colon', () => {
    const grammarTransformQuestion = {
      ...englishWritingQuestion,
      area: 'grammar',
      promptKo:
        '두 문장을 분사구문으로 한 문장으로 바꾸세요: She realized the mistake. She immediately contacted the client.',
    } as unknown as LearningQuestion;

    expect(getQuestionDisplayParts(grammarTransformQuestion)).toEqual({
      promptText: '두 문장을 분사구문으로 한 문장으로 바꾸세요.',
      sourceText: 'She realized the mistake. She immediately contacted the client.',
      sourceLabel: '대상 문장',
    });
  });

  it('uses explicit questionText before trying to split prompt text', () => {
    expect(getQuestionDisplayParts(translationQuestion)).toEqual({
      promptText: translationQuestion.promptKo,
      sourceText: translationQuestion.questionText,
      sourceLabel: '지문',
    });
  });

  it('formats time limit labels as seconds', () => {
    expect(formatTimeLimitLabel(90)).toBe('남은 시간 90초');
    expect(formatTimeLimitLabel(0)).toBe('남은 시간 0초');
    expect(formatTimeLimitLabel(-4)).toBe('남은 시간 0초');
  });

  it('detects expired timed translation questions', () => {
    expect(isTimedTranslationExpired(translationQuestion, 0)).toBe(true);
    expect(isTimedTranslationExpired(translationQuestion, 1)).toBe(false);
    expect(isTimedTranslationExpired(englishWritingQuestion, 0)).toBe(false);
  });

  it('auto-submits a timed translation once when the countdown expires', () => {
    expect(
      shouldAutoSubmitTimedTranslation({
        isSubmittingAnswer: false,
        question: translationQuestion,
        remainingTimeSeconds: 0,
        submittedQuestionId: null,
      }),
    ).toBe(true);

    expect(
      shouldAutoSubmitTimedTranslation({
        isSubmittingAnswer: false,
        question: translationQuestion,
        remainingTimeSeconds: 0,
        submittedQuestionId: translationQuestion.id,
      }),
    ).toBe(false);

    expect(
      shouldAutoSubmitTimedTranslation({
        isSubmittingAnswer: true,
        question: translationQuestion,
        remainingTimeSeconds: 0,
        submittedQuestionId: null,
      }),
    ).toBe(false);
  });
});
