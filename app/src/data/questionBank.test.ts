import { describe, expect, it } from 'vitest';

import {
  LEVEL_ORDER,
  PRACTICE_QUESTION_COUNT,
  PROMOTION_EXAM_QUESTION_COUNT,
  QUESTION_PACK_SCHEMA_VERSION,
} from '../constants/learningConfig';
import { isValidLevelQuestionPack } from '../services/questionPackValidation';
import type {
  ChoiceLearningQuestion,
  LearningQuestion,
  WritingLearningQuestion,
} from '../types/learning';
import { questionBank } from './questionBank';

const TARGET_QUESTIONS_PER_LEVEL = 160;

function isWritingQuestion(question: LearningQuestion): question is WritingLearningQuestion {
  return question.kind === 'writing';
}

function isChoiceQuestionWithText(
  question: LearningQuestion,
): question is ChoiceLearningQuestion & { questionText: string } {
  return question.kind === 'choice' && Boolean(question.questionText);
}

describe('questionBank', () => {
  it('has timed Korean translation reading questions by level and difficulty', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;
    const requiredDifficulties = ['easy', 'medium', 'hard'] as const;

    levels.forEach((level) => {
      const translationQuestions = questionBank
        .filter(isWritingQuestion)
        .filter((question) => (
          question.level === level &&
          question.area === 'reading' &&
          question.answerLanguage === 'ko'
        ));

      expect(translationQuestions.length).toBeGreaterThanOrEqual(6);
      requiredDifficulties.forEach((difficulty) => {
        expect(
          translationQuestions.some((question) => question.readingDifficulty === difficulty),
        ).toBe(true);
      });
      translationQuestions.forEach((question) => {
        expect(question.questionText?.trim()).toBeTruthy();
        expect(question.sampleAnswer.trim()).toMatch(/[가-힣]/);
        expect(question.expectedKeywordsKo?.length).toBeGreaterThanOrEqual(3);
        expect(question.timeLimitSeconds).toBeGreaterThanOrEqual(30);
        expect(question.timeLimitSeconds).toBeLessThanOrEqual(90);
      });
    });
  });

  it('has at least two writing questions with required evaluation fields at each level', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;

    levels.forEach((level) => {
      const writingQuestions = questionBank
        .filter((item) => item.level === level)
        .filter(isWritingQuestion);

      expect(writingQuestions.length).toBeGreaterThanOrEqual(2);
      writingQuestions.forEach((question) => {
        expect(question.sampleAnswer.trim()).toBeTruthy();
        expect(question.evaluationFocusKo.trim()).toBeTruthy();
      });
    });
  });

  it('has enough questions per level to avoid immediate repeats across three practice sessions', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;

    levels.forEach((level) => {
      const levelQuestions = questionBank.filter((item) => item.level === level);

      expect(levelQuestions.length).toBeGreaterThanOrEqual(PRACTICE_QUESTION_COUNT * 3);
    });
  });

  it('has enough questions per level to support six varied practice sessions', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;

    levels.forEach((level) => {
      const levelQuestions = questionBank.filter((item) => item.level === level);

      expect(levelQuestions.length).toBeGreaterThanOrEqual(PRACTICE_QUESTION_COUNT * 6);
    });
  });

  it('has at least four writing questions per level to prevent repeated writing prompts', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;

    levels.forEach((level) => {
      const writingQuestions = questionBank
        .filter((item) => item.level === level)
        .filter(isWritingQuestion);

      expect(writingQuestions.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('has enough post-promotion questions to avoid immediate repeats after an exam', () => {
    const promotedLevels = ['A2', 'B1', 'B2'] as const;

    promotedLevels.forEach((level) => {
      const levelQuestions = questionBank.filter((item) => item.level === level);

      expect(levelQuestions.length).toBeGreaterThanOrEqual(
        PROMOTION_EXAM_QUESTION_COUNT + PRACTICE_QUESTION_COUNT * 3,
      );
    });
  });

  it('has enough choice questions at promoted levels for promotion exams', () => {
    const promotedLevels = ['A2', 'B1', 'B2'] as const;

    promotedLevels.forEach((level) => {
      const choiceQuestions = questionBank.filter(
        (item) => item.level === level && item.kind === 'choice',
      );

      expect(choiceQuestions.length).toBeGreaterThanOrEqual(PROMOTION_EXAM_QUESTION_COUNT);
    });
  });

  it('does not make a reading correct choice identical to the source sentence', () => {
    const duplicatedReadingAnswers = questionBank
      .filter(isChoiceQuestionWithText)
      .filter((question) => {
        const correctChoice = question.choices.find(
          (choice) => choice.id === question.correctChoiceId,
        );

        return correctChoice?.text.trim() === question.questionText?.trim();
      });

    expect(duplicatedReadingAnswers).toEqual([]);
  });

  it('has exactly 160 questions for each level', () => {
    const levels = ['A1', 'A2', 'B1', 'B2'] as const;

    levels.forEach((level) => {
      const levelQuestions = questionBank.filter((item) => item.level === level);

      expect(levelQuestions).toHaveLength(TARGET_QUESTIONS_PER_LEVEL);
    });
  });

  it('uses a natural umbrella sentence for rain-related A1 reading translation', () => {
    const question = questionBank.find(
      (item) => item.id === 'a1-reading-translation-umbrella-001',
    );

    expect(question?.questionText).toBe('It is raining, so I brought an umbrella.');
    expect(question?.questionText).not.toContain('I carry an umbrella');
  });

  it('uses learner-friendly wording for advanced grammar prompts', () => {
    const bannedPromptSnippets = [
      '양보의 의미를 자연스럽게 나타내는 문장을 고르세요.',
      '분사구문이 자연스러운 문장을 고르세요.',
      '강조를 위한 도치 문장으로 맞는 것을 고르세요.',
      '분사구문으로 자연스럽게 줄인 문장을 고르세요.',
      '문장의 압축이 가장 자연스러운 것을 고르세요.',
      '상대의 주장에 양보 후 반박하는 문장을 쓰세요.',
      '두 문장을 분사구문으로 한 문장으로 바꾸세요',
      'Not only 도치 구문으로 쓰세요',
    ];

    const jargonOnlyPrompts = questionBank
      .filter((question) => (
        bannedPromptSnippets.some((snippet) => question.promptKo.includes(snippet))
      ))
      .map((question) => ({
        id: question.id,
        promptKo: question.promptKo,
      }));

    expect(jargonOnlyPrompts).toEqual([]);
  });

  it('explains concession questions as contrast rather than using only the grammar term', () => {
    const question = questionBank.find((item) => item.id === 'b2-grammar-concession-001');

    expect(question?.promptKo).toContain('비록');
    expect(question?.promptKo).toContain('지만');
    expect(question?.promptKo).toContain('결과');
  });

  it('makes the B1 suggestion question specific enough to identify the intended answer', () => {
    const question = questionBank.find((item) => item.id === 'b1-conversation-suggest-001');

    expect(question?.kind).toBe('choice');
    if (question?.kind !== 'choice') {
      throw new Error('Expected a choice question.');
    }

    expect(question.choices.find((choice) => choice.id === question.correctChoiceId)?.text).toBe(
      "Why don't we try another option?",
    );
  });

  it('can wrap each bundled level as a valid question pack', () => {
    LEVEL_ORDER.forEach((level) => {
      expect(
        isValidLevelQuestionPack({
          schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
          level,
          version: 1,
          publishedAt: '2026-06-09T00:00:00.000Z',
          questions: questionBank.filter((question) => question.level === level),
        }),
      ).toBe(true);
    });
  });
});
