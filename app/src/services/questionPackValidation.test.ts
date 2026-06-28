import { describe, expect, it } from 'vitest';

import {
  LEVEL_ORDER,
  PRACTICE_QUESTION_COUNT,
  QUESTION_PACK_SCHEMA_VERSION,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  CachedQuestionPackState,
  LearnerLevel,
  LearningQuestion,
  LevelQuestionPack,
  QuestionPackManifest,
} from '../types/learning';
import {
  flattenCachedPacks,
  isValidLearningQuestion,
  isValidLevelQuestionPack,
  isValidQuestionPackManifest,
} from './questionPackValidation';

const publishedAt = '2026-06-09T00:00:00.000Z';

function levelQuestions(level: LearnerLevel): LearningQuestion[] {
  return questionBank.filter((question) => question.level === level);
}

function createLevelPack(level: LearnerLevel, questions = levelQuestions(level)): LevelQuestionPack {
  return {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    level,
    version: 1,
    publishedAt,
    questions,
  };
}

function convertToChoiceQuestion(question: LearningQuestion, index: number): LearningQuestion {
  return {
    id: `${question.id}-choice-${index}`,
    level: question.level,
    area: question.area,
    kind: 'choice',
    promptKo: question.promptKo,
    choices: [
      { id: 'a', text: 'This is correct.' },
      { id: 'b', text: 'This is wrong.' },
      { id: 'c', text: 'This is also wrong.' },
    ],
    correctChoiceId: 'a',
    explanationKo: question.explanationKo,
  };
}

describe('questionPackValidation', () => {
  it('accepts a valid manifest', () => {
    const manifest: QuestionPackManifest = {
      schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
      publishedAt,
      packs: LEVEL_ORDER.map((level) => ({
        level,
        version: 1,
        path: `packs/${level.toLowerCase()}.json`,
        questionCount: PRACTICE_QUESTION_COUNT * 6,
      })),
    };

    expect(isValidQuestionPackManifest(manifest)).toBe(true);
  });

  it('rejects unsafe manifest paths', () => {
    const unsafePaths = [
      'packs/../a1.json',
      'https://example.com/packs/a1.json',
      'a1.json',
      'packs/a1.txt',
    ];

    unsafePaths.forEach((path) => {
      expect(
        isValidQuestionPackManifest({
          schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
          publishedAt,
          packs: [
            {
              level: 'A1',
              version: 1,
              path,
              questionCount: PRACTICE_QUESTION_COUNT * 3,
            },
          ],
        }),
      ).toBe(false);
    });
  });

  it('accepts the bundled A1 questions as a level pack', () => {
    expect(isValidLevelQuestionPack(createLevelPack('A1'))).toBe(true);
  });

  it('rejects level packs that cannot support six varied practice sessions', () => {
    LEVEL_ORDER.forEach((level) => {
      expect(
        isValidLevelQuestionPack(
          createLevelPack(level, levelQuestions(level).slice(0, PRACTICE_QUESTION_COUNT * 6 - 1)),
        ),
      ).toBe(false);
    });
  });

  it('rejects level packs without enough writing questions', () => {
    LEVEL_ORDER.forEach((level) => {
      let convertedWritingCount = 0;
      const questions = levelQuestions(level).map((question, index) => {
        if (question.kind !== 'writing') {
          return question;
        }

        convertedWritingCount += 1;

        return convertedWritingCount <= 3 ? question : convertToChoiceQuestion(question, index);
      });

      expect(questions.length).toBeGreaterThanOrEqual(PRACTICE_QUESTION_COUNT * 6);
      expect(questions.filter((question) => question.kind === 'writing')).toHaveLength(3);
      expect(isValidLevelQuestionPack(createLevelPack(level, questions))).toBe(false);
    });
  });

  it('rejects duplicate question ids within a level pack', () => {
    const questions = levelQuestions('A1').map((question, index) =>
      index === 1 ? { ...question, id: levelQuestions('A1')[0].id } : question,
    );

    expect(isValidLevelQuestionPack(createLevelPack('A1', questions))).toBe(false);
  });

  it('rejects level packs that cannot cover the promotion exam blueprint areas', () => {
    const questions = levelQuestions('A2').map((question, index) => {
      if (question.area !== 'conversation') {
        return question;
      }

      return {
        ...question,
        id: `${question.id}-grammar-${index}`,
        area: 'grammar' as const,
      };
    });

    expect(questions.length).toBeGreaterThanOrEqual(
      PRACTICE_QUESTION_COUNT * 6,
    );
    expect(questions.some((question) => question.area === 'conversation')).toBe(false);
    expect(isValidLevelQuestionPack(createLevelPack('A2', questions))).toBe(false);
  });

  it('rejects a reading choice question whose correct answer repeats the source sentence', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-reading-repeat-001',
        level: 'A1',
        area: 'reading',
        kind: 'choice',
        promptKo: 'Read and choose.',
        questionText: 'The dog is sleeping.',
        choices: [
          { id: 'a', text: 'The dog is sleeping.' },
          { id: 'b', text: 'The dog is running.' },
          { id: 'c', text: 'The cat is sleeping.' },
        ],
        correctChoiceId: 'a',
        explanationKo: 'The correct answer must not duplicate the source sentence.',
      }),
      'correct choice text must not exactly match questionText after trim',
    ).toBe(false);
  });

  it('rejects a choice question with duplicate choice ids', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-duplicate-choice-ids-001',
        level: 'A1',
        area: 'grammar',
        kind: 'choice',
        promptKo: 'Choose the correct sentence.',
        choices: [
          { id: 'a', text: 'I am ready.' },
          { id: 'a', text: 'I is ready.' },
          { id: 'c', text: 'I are ready.' },
        ],
        correctChoiceId: 'a',
        explanationKo: 'Choice IDs must uniquely identify answers.',
      }),
    ).toBe(false);
  });

  it('rejects a writing question carrying malformed choice-only fields', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-writing-choice-fields-001',
        level: 'A1',
        area: 'conversation',
        kind: 'writing',
        promptKo: 'Write one greeting.',
        choices: [{ id: '', text: '' }],
        correctChoiceId: 'missing',
        sampleAnswer: 'Hello.',
        evaluationFocusKo: 'Greeting expression.',
        explanationKo: 'Writing questions are evaluated by sample answer and focus.',
      }),
    ).toBe(false);
  });

  it('accepts a timed Korean translation reading question', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-reading-translation-test-001',
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
        evaluationFocusKo: '시간과 동작을 정확히 번역하는지 평가합니다.',
        explanationKo: 'arrives는 도착한다는 뜻이고 at nine은 9시를 뜻합니다.',
        weakPointLabel: '시간 정보 번역',
      }),
    ).toBe(true);
  });

  it('rejects a Korean translation reading question without timing metadata', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-reading-translation-test-002',
        level: 'A1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 문장을 읽고 한글로 번역하세요.',
        questionText: 'The bus arrives at nine.',
        answerLanguage: 'ko',
        sampleAnswer: '버스는 9시에 도착합니다.',
        expectedKeywordsKo: ['버스', '9시', '도착'],
        evaluationFocusKo: '시간과 동작을 정확히 번역하는지 평가합니다.',
        explanationKo: 'arrives는 도착한다는 뜻입니다.',
      }),
    ).toBe(false);
  });

  it('rejects Korean translation metadata without Hangul sample and keywords', () => {
    expect(
      isValidLearningQuestion({
        id: 'a1-reading-translation-test-003',
        level: 'A1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 문장을 읽고 한글로 번역하세요.',
        questionText: 'The bus arrives at nine.',
        answerLanguage: 'ko',
        timeLimitSeconds: 30,
        readingDifficulty: 'easy',
        sampleAnswer: 'The bus arrives at nine.',
        expectedKeywordsKo: ['bus', 'nine', 'arrive'],
        evaluationFocusKo: '시간과 동작을 정확히 번역하는지 평가합니다.',
        explanationKo: 'arrives는 도착한다는 뜻입니다.',
      }),
    ).toBe(false);
  });

  it('flattens cached packs in learner level order', () => {
    const cache: CachedQuestionPackState = {
      schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
      manifestPublishedAt: publishedAt,
      packs: {
        B2: {
          level: 'B2',
          version: 1,
          publishedAt,
          cachedAt: publishedAt,
          questions: [{ ...levelQuestions('B2')[0], id: 'b2-first' }],
        },
        A2: {
          level: 'A2',
          version: 1,
          publishedAt,
          cachedAt: publishedAt,
          questions: [{ ...levelQuestions('A2')[0], id: 'a2-first' }],
        },
        B1: {
          level: 'B1',
          version: 1,
          publishedAt,
          cachedAt: publishedAt,
          questions: [{ ...levelQuestions('B1')[0], id: 'b1-first' }],
        },
        A1: {
          level: 'A1',
          version: 1,
          publishedAt,
          cachedAt: publishedAt,
          questions: [{ ...levelQuestions('A1')[0], id: 'a1-first' }],
        },
      },
    };

    expect(flattenCachedPacks(cache).map((question) => question.id)).toEqual([
      'a1-first',
      'a2-first',
      'b1-first',
      'b2-first',
    ]);
  });
});
