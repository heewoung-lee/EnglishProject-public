import { describe, expect, it } from 'vitest';

import { PRACTICE_QUESTION_COUNT, PROMOTION_EXAM_QUESTION_COUNT } from '../constants/learningConfig';
import type { LearningQuestion, RecentResult } from '../types/learning';
import { selectPracticeQuestions, selectPromotionExamQuestions } from './questionSelector';

const grammarWeakResult: RecentResult = {
  questionSetId: 'practice-1',
  level: 'A1',
  score: 34,
  rateAfter: 20,
  questionIds: ['a1-reading-main-001', 'a1-conversation-request-001', 'a1-grammar-be-001'],
  weakAreas: ['grammar'],
  solvedAt: '2026-06-08T00:00:00.000Z',
};

const promotionExamA2RecentResult: RecentResult = {
  questionSetId: 'promotion-1',
  level: 'A2',
  score: 100,
  rateAfter: 0,
  questionIds: [
    'a2-reading-inference-001',
    'a2-conversation-polite-001',
    'a2-grammar-perfect-001',
    'a2-reading-purpose-001',
    'a2-conversation-clarify-001',
  ],
  weakAreas: [],
  solvedAt: '2026-06-08T00:01:00.000Z',
};

const a2CorrectFirstHalfRecentResult: RecentResult = {
  questionSetId: 'practice-2',
  level: 'A2',
  score: 100,
  rateAfter: 80,
  questionIds: [
    'a2-reading-inference-001',
    'a2-conversation-polite-001',
    'a2-grammar-perfect-001',
  ],
  correctQuestionIds: [
    'a2-reading-inference-001',
    'a2-conversation-polite-001',
    'a2-grammar-perfect-001',
  ],
  weakAreas: [],
  solvedAt: '2026-06-08T00:02:00.000Z',
};

const a2MixedSecondHalfRecentResult: RecentResult = {
  questionSetId: 'practice-3',
  level: 'A2',
  score: 67,
  rateAfter: 86,
  questionIds: [
    'a2-reading-purpose-001',
    'a2-conversation-clarify-001',
    'a2-grammar-comparative-001',
  ],
  correctQuestionIds: ['a2-reading-purpose-001', 'a2-conversation-clarify-001'],
  weakAreas: ['grammar'],
  solvedAt: '2026-06-08T00:03:00.000Z',
};

const a2PostPromotionPracticeResult: RecentResult = {
  questionSetId: 'practice-after-promotion',
  level: 'A2',
  score: 100,
  rateAfter: 80,
  questionIds: [
    'a2-writing-weekend-plan-001',
    'a2-writing-polite-request-001',
    'a2-grammar-comparative-001',
  ],
  correctQuestionIds: [
    'a2-writing-weekend-plan-001',
    'a2-writing-polite-request-001',
    'a2-grammar-comparative-001',
  ],
  weakAreas: [],
  solvedAt: '2026-06-08T00:03:30.000Z',
};

const legacyPerfectA2RecentResult = {
  ...a2CorrectFirstHalfRecentResult,
  correctQuestionIds: undefined,
  score: 100,
} as unknown as RecentResult;

const legacyMixedSecondHalfRecentResult = {
  ...a2MixedSecondHalfRecentResult,
  correctQuestionIds: undefined,
  score: 67,
} as unknown as RecentResult;

const a1RecentlyCorrectWritingResult: RecentResult = {
  questionSetId: 'practice-writing-correct',
  level: 'A1',
  score: 100,
  rateAfter: 80,
  questionIds: [
    'a1-reading-main-001',
    'a1-writing-introduction-001',
    'a1-writing-like-food-001',
  ],
  correctQuestionIds: [
    'a1-reading-main-001',
    'a1-writing-introduction-001',
    'a1-writing-like-food-001',
  ],
  weakAreas: [],
  solvedAt: '2026-06-08T00:04:00.000Z',
};

const a1RecentlyCorrectChoiceResult: RecentResult = {
  questionSetId: 'practice-choice-correct',
  level: 'A1',
  score: 100,
  rateAfter: 90,
  questionIds: [
    'a1-conversation-request-001',
    'a1-grammar-be-001',
    'a1-reading-detail-001',
  ],
  correctQuestionIds: [
    'a1-conversation-request-001',
    'a1-grammar-be-001',
    'a1-reading-detail-001',
  ],
  weakAreas: [],
  solvedAt: '2026-06-08T00:05:00.000Z',
};

function choiceQuestion(
  id: string,
  level: LearningQuestion['level'],
  area: LearningQuestion['area'] = 'reading',
): LearningQuestion {
  return {
    id,
    level,
    area,
    kind: 'choice',
    promptKo: `Prompt for ${id}`,
    choices: [
      { id: 'a', text: 'Wrong' },
      { id: 'b', text: 'Right' },
    ],
    correctChoiceId: 'b',
    explanationKo: `Explanation for ${id}`,
  };
}

function writingQuestion(
  id: string,
  level: LearningQuestion['level'],
  area: LearningQuestion['area'] = 'grammar',
): LearningQuestion {
  return {
    id,
    level,
    area,
    kind: 'writing',
    promptKo: `Prompt for ${id}`,
    sampleAnswer: 'I like apples.',
    evaluationFocusKo: 'Use a simple sentence.',
    explanationKo: `Explanation for ${id}`,
  };
}

function writingQuestionWithPrompt(
  id: string,
  promptKo: string,
  sampleAnswer: string,
  level: LearningQuestion['level'] = 'A1',
  area: LearningQuestion['area'] = 'conversation',
): LearningQuestion {
  return {
    id,
    level,
    area,
    kind: 'writing',
    promptKo,
    sampleAnswer,
    evaluationFocusKo: 'Write one complete English sentence.',
    explanationKo: `Explanation for ${id}`,
  };
}

describe('questionSelector', () => {
  it('selects a fixed-size practice session for the current level with balanced core formats', () => {
    const questions = selectPracticeQuestions('A1', []);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.every((question) => question.level === 'A1')).toBe(true);
    expect(questions.some((question) => question.kind === 'choice')).toBe(true);
    expect(questions.some((question) => question.area === 'reading')).toBe(true);
    expect(questions.filter((question) => question.area === 'conversation').length).toBeLessThanOrEqual(1);
  });

  it('selects practice questions from an injected A1 source', () => {
    const sourceQuestions = [
      choiceQuestion('injected-a1-choice-001', 'A1', 'reading'),
      writingQuestion('injected-a1-writing-001', 'A1', 'grammar'),
      writingQuestion('injected-a1-writing-002', 'A1', 'conversation'),
      choiceQuestion('injected-a2-choice-distractor', 'A2', 'reading'),
    ];
    const questions = selectPracticeQuestions('A1', [], 0, sourceQuestions);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.some((question) => question.id === 'injected-a1-choice-001')).toBe(true);
    expect(questions.some((question) => question.id === 'injected-a1-writing-002')).toBe(true);
  });

  it('keeps objective choice questions visible even when writing questions are first in the queue', () => {
    const sourceQuestions = [
      writingQuestion('a1-conversation-writing-001', 'A1', 'conversation'),
      writingQuestion('a1-conversation-writing-002', 'A1', 'conversation'),
      writingQuestion('a1-conversation-writing-003', 'A1', 'conversation'),
      choiceQuestion('a1-reading-choice-001', 'A1', 'reading'),
      choiceQuestion('a1-grammar-choice-001', 'A1', 'grammar'),
    ];
    const questions = selectPracticeQuestions('A1', [], 0, sourceQuestions);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.some((question) => question.kind === 'choice')).toBe(true);
    expect(questions.some((question) => question.area === 'reading')).toBe(true);
    expect(questions.filter((question) => question.area === 'conversation')).toHaveLength(1);
  });

  it('prioritizes recently weak areas when choosing practice questions', () => {
    const questions = selectPracticeQuestions('A1', [grammarWeakResult]);

    expect(questions[0]?.area).toBe('grammar');
  });

  it('prioritizes fresh questions that match recent weak skill tags', () => {
    const sourceQuestions = [
      {
        ...writingQuestion('a1-grammar-tense-writing-001', 'A1', 'grammar'),
        skillTags: ['verb_tense'],
      },
      {
        ...writingQuestion('a1-grammar-article-writing-001', 'A1', 'grammar'),
        skillTags: ['articles'],
      },
      choiceQuestion('a1-reading-fresh-001', 'A1', 'reading'),
    ] as unknown as LearningQuestion[];
    const questions = selectPracticeQuestions(
      'A1',
      [
        {
          ...grammarWeakResult,
          weakSkillTags: ['articles'],
        },
      ],
      0,
      sourceQuestions,
    );

    expect(questions.map((question) => question.id)).toContain('a1-grammar-article-writing-001');
  });

  it('uses local weak skill stats to select two weakness questions and one balance question', () => {
    const sourceQuestions = [
      writingQuestion('a1-balance-writing-001', 'A1', 'conversation'),
      writingQuestion('a1-balance-writing-002', 'A1', 'reading'),
      {
        ...choiceQuestion('a1-article-choice-001', 'A1', 'grammar'),
        skillTags: ['articles'],
      },
      {
        ...choiceQuestion('a1-article-choice-002', 'A1', 'grammar'),
        skillTags: ['articles'],
      },
      choiceQuestion('a1-balance-reading-001', 'A1', 'reading'),
    ] as unknown as LearningQuestion[];
    const questions = selectPracticeQuestions('A1', [], 0, sourceQuestions, {
      questionStats: {},
      skillStats: {
        articles: {
          attempts: 4,
          correctCount: 1,
          lastScore: 25,
          lastPracticedAt: '2026-06-19T00:00:00.000Z',
        },
      },
    });

    const selectedIds = questions.map((question) => question.id);
    const articleCount = selectedIds.filter((id) => id.includes('article')).length;
    const balanceCount = selectedIds.filter((id) => id.includes('balance')).length;

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(articleCount).toBe(2);
    expect(balanceCount).toBe(1);
    expect(questions.some((question) => question.kind === 'choice')).toBe(true);
    expect(questions.some((question) => question.area === 'reading')).toBe(true);
  });

  it('keeps one balance question when recent weak signals have enough matches', () => {
    const sourceQuestions = [
      choiceQuestion('a1-grammar-weak-001', 'A1', 'grammar'),
      choiceQuestion('a1-grammar-weak-002', 'A1', 'grammar'),
      choiceQuestion('a1-grammar-weak-003', 'A1', 'grammar'),
      choiceQuestion('a1-reading-balance-001', 'A1', 'reading'),
      choiceQuestion('a1-conversation-balance-001', 'A1', 'conversation'),
    ];
    const questions = selectPracticeQuestions(
      'A1',
      [
        {
          ...grammarWeakResult,
          questionIds: [],
        },
      ],
      0,
      sourceQuestions,
    );

    const grammarCount = questions.filter((question) => question.area === 'grammar').length;
    const balanceCount = questions.filter((question) => question.area !== 'grammar').length;

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(grammarCount).toBe(2);
    expect(balanceCount).toBe(1);
  });

  it('keeps fresh questions first when most next-level questions were just used in an exam', () => {
    const questions = selectPracticeQuestions('A2', [promotionExamA2RecentResult]);

    expect(questions.map((question) => question.id)).toContain('a2-grammar-comparative-001');
    expect(
      questions.every((question) => !promotionExamA2RecentResult.questionIds.includes(question.id)),
    ).toBe(true);
  });

  it('does not immediately repeat promotion exam or first practice questions on the second post-promotion practice', () => {
    const questions = selectPracticeQuestions('A2', [
      promotionExamA2RecentResult,
      a2PostPromotionPracticeResult,
    ]);
    const recentlySeenQuestionIds = new Set([
      ...promotionExamA2RecentResult.questionIds,
      ...a2PostPromotionPracticeResult.questionIds,
    ]);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.every((question) => !recentlySeenQuestionIds.has(question.id))).toBe(true);
  });

  it('rotates practice questions by solved count when older local results have no question ids', () => {
    const legacyResult = {
      ...promotionExamA2RecentResult,
      questionIds: undefined,
      weakAreas: undefined,
    } as unknown as RecentResult;

    const firstSet = selectPracticeQuestions('A2', [legacyResult], 0);
    const rotatedSet = selectPracticeQuestions('A2', [legacyResult], 3);

    expect(rotatedSet.map((question) => question.id)).not.toEqual(
      firstSet.map((question) => question.id),
    );
    expect(rotatedSet.some((question) => question.kind === 'choice')).toBe(true);
  });

  it('keeps fresh questions while allowing a recently incorrect practice question to return', () => {
    const questions = selectPracticeQuestions('A2', [
      a2CorrectFirstHalfRecentResult,
      a2MixedSecondHalfRecentResult,
    ]);
    const recentlyCorrectQuestionIds = new Set([
      ...a2CorrectFirstHalfRecentResult.questionIds,
      ...(a2MixedSecondHalfRecentResult.correctQuestionIds ?? []),
    ]);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.every((question) => !recentlyCorrectQuestionIds.has(question.id))).toBe(
      true,
    );
    expect(questions.map((question) => question.id)).toContain('a2-grammar-comparative-001');
  });

  it('does not immediately repeat recently correct questions when enough fresh questions remain', () => {
    const questions = selectPracticeQuestions('A1', [
      a1RecentlyCorrectWritingResult,
      a1RecentlyCorrectChoiceResult,
    ]);
    const recentlyCorrectQuestionIds = new Set([
      ...a1RecentlyCorrectWritingResult.questionIds,
      ...a1RecentlyCorrectChoiceResult.questionIds,
    ]);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.every((question) => !recentlyCorrectQuestionIds.has(question.id))).toBe(true);
  });

  it('does not select duplicate visible writing tasks in the same practice queue', () => {
    const duplicatePromptKo = '좋아하는 음식을 영어 한 문장으로 쓰세요.';
    const sourceQuestions = [
      writingQuestionWithPrompt('a1-writing-like-food-001', duplicatePromptKo, 'I like apples.'),
      writingQuestionWithPrompt('a1-writing-food-extra-001', duplicatePromptKo, 'I like sushi.'),
      writingQuestionWithPrompt(
        'a1-writing-introduction-extra-001',
        '자기소개를 영어 한 문장으로 쓰세요.',
        'My name is Mina.',
      ),
      choiceQuestion('a1-reading-main-extra-001', 'A1', 'reading'),
    ];
    const questions = selectPracticeQuestions('A1', [], 0, sourceQuestions);

    expect(questions).toHaveLength(PRACTICE_QUESTION_COUNT);
    expect(questions.map((question) => question.id)).not.toEqual(
      expect.arrayContaining(['a1-writing-like-food-001', 'a1-writing-food-extra-001']),
    );
  });

  it('keeps recently correct visible tasks out of the fresh practice queue even with another id', () => {
    const duplicatePromptKo = '좋아하는 음식을 영어 한 문장으로 쓰세요.';
    const sourceQuestions = [
      writingQuestionWithPrompt('a1-writing-like-food-001', duplicatePromptKo, 'I like apples.'),
      writingQuestionWithPrompt('a1-writing-food-extra-001', duplicatePromptKo, 'I like sushi.'),
      writingQuestionWithPrompt(
        'a1-writing-introduction-extra-001',
        '자기소개를 영어 한 문장으로 쓰세요.',
        'My name is Mina.',
      ),
      writingQuestionWithPrompt(
        'a1-writing-daily-routine-extra-001',
        '매일 하는 일을 영어 한 문장으로 쓰세요.',
        'I study every day.',
      ),
      choiceQuestion('a1-reading-main-extra-001', 'A1', 'reading'),
    ];
    const questions = selectPracticeQuestions(
      'A1',
      [
        {
          questionSetId: 'practice-duplicate-correct',
          level: 'A1',
          score: 100,
          rateAfter: 30,
          questionIds: ['a1-writing-like-food-001'],
          correctQuestionIds: ['a1-writing-like-food-001'],
          weakAreas: [],
          solvedAt: '2026-06-08T00:08:00.000Z',
        },
      ],
      0,
      sourceQuestions,
    );

    expect(questions.map((question) => question.id)).not.toContain('a1-writing-food-extra-001');
  });

  it('includes a recently incorrect question even when fresh questions can fill the session', () => {
    const sourceQuestions = [
      choiceQuestion('a1-correct-reading-001', 'A1', 'reading'),
      choiceQuestion('a1-correct-conversation-001', 'A1', 'conversation'),
      choiceQuestion('a1-incorrect-grammar-001', 'A1', 'grammar'),
      choiceQuestion('a1-fresh-reading-001', 'A1', 'reading'),
      choiceQuestion('a1-fresh-conversation-001', 'A1', 'conversation'),
      writingQuestion('a1-fresh-writing-001', 'A1', 'grammar'),
    ];
    const questions = selectPracticeQuestions(
      'A1',
      [
        {
          questionSetId: 'practice-mixed',
          level: 'A1',
          score: 67,
          rateAfter: 30,
          questionIds: [
            'a1-correct-reading-001',
            'a1-correct-conversation-001',
            'a1-incorrect-grammar-001',
          ],
          correctQuestionIds: ['a1-correct-reading-001', 'a1-correct-conversation-001'],
          weakAreas: ['grammar'],
          solvedAt: '2026-06-08T00:06:00.000Z',
        },
      ],
      0,
      sourceQuestions,
    );

    expect(questions.map((question) => question.id)).toContain('a1-incorrect-grammar-001');
    expect(questions.map((question) => question.id)).not.toContain('a1-correct-reading-001');
    expect(questions.map((question) => question.id)).not.toContain('a1-correct-conversation-001');
  });

  it('repeats recently incorrect questions before recently correct questions when fresh questions cannot fill the session', () => {
    const sourceQuestions = [
      choiceQuestion('a1-correct-reading-001', 'A1', 'reading'),
      choiceQuestion('a1-correct-conversation-001', 'A1', 'conversation'),
      choiceQuestion('a1-incorrect-grammar-001', 'A1', 'grammar'),
      choiceQuestion('a1-fresh-reading-001', 'A1', 'reading'),
    ];
    const questions = selectPracticeQuestions(
      'A1',
      [
        {
          questionSetId: 'practice-small-pool',
          level: 'A1',
          score: 67,
          rateAfter: 30,
          questionIds: [
            'a1-correct-reading-001',
            'a1-correct-conversation-001',
            'a1-incorrect-grammar-001',
          ],
          correctQuestionIds: ['a1-correct-reading-001', 'a1-correct-conversation-001'],
          weakAreas: ['grammar'],
          solvedAt: '2026-06-08T00:07:00.000Z',
        },
      ],
      0,
      sourceQuestions,
    );

    expect(questions.map((question) => question.id)).toEqual([
      'a1-fresh-reading-001',
      'a1-incorrect-grammar-001',
      'a1-correct-reading-001',
    ]);
  });

  it('does not treat correct answers from older tracked results as fresh questions', () => {
    const sourceQuestions = [
      choiceQuestion('a1-older-correct-001', 'A1', 'reading'),
      choiceQuestion('a1-fresh-reading-001', 'A1', 'reading'),
      choiceQuestion('a1-fresh-conversation-001', 'A1', 'conversation'),
      choiceQuestion('a1-fresh-grammar-001', 'A1', 'grammar'),
      choiceQuestion('a1-fresh-reading-002', 'A1', 'reading'),
      choiceQuestion('a1-recent-001', 'A1', 'conversation'),
      choiceQuestion('a1-recent-002', 'A1', 'grammar'),
      choiceQuestion('a1-recent-003', 'A1', 'reading'),
    ];
    const results: RecentResult[] = [
      {
        questionSetId: 'practice-older',
        level: 'A1',
        score: 100,
        rateAfter: 40,
        questionIds: ['a1-older-correct-001'],
        correctQuestionIds: ['a1-older-correct-001'],
        weakAreas: [],
        solvedAt: '2026-06-08T00:01:00.000Z',
      },
      ...[
        'a1-recent-001',
        'a1-recent-002',
        'a1-recent-003',
        'a1-recent-004',
        'a1-recent-005',
      ].map((questionId, index) => ({
        questionSetId: `practice-recent-${index}`,
        level: 'A1' as const,
        score: 0,
        rateAfter: 40,
        questionIds: [questionId],
        correctQuestionIds: [],
        weakAreas: ['reading' as const],
        solvedAt: `2026-06-08T00:0${index + 2}:00.000Z`,
      })),
    ];

    const questions = selectPracticeQuestions('A1', results, 0, sourceQuestions);

    expect(questions.map((question) => question.id)).toEqual([
      'a1-fresh-reading-001',
      'a1-fresh-conversation-001',
      'a1-recent-003',
    ]);
    expect(questions.map((question) => question.id)).not.toContain('a1-older-correct-001');
    expect(questions.filter((question) => question.area === 'reading')).toHaveLength(2);
  });

  it('treats legacy perfect results as recently correct answers', () => {
    const questions = selectPracticeQuestions('A2', [
      legacyPerfectA2RecentResult,
      legacyMixedSecondHalfRecentResult,
    ]);

    expect(questions.some((question) => question.kind === 'choice')).toBe(true);
    expect(questions.map((question) => question.id)).not.toContain(
      legacyPerfectA2RecentResult.questionIds[0],
    );
  });

  it('builds a promotion exam from the next level first', () => {
    const questions = selectPromotionExamQuestions('A1');

    expect(questions).toHaveLength(PROMOTION_EXAM_QUESTION_COUNT);
    expect(questions[0]?.level).toBe('A2');
  });

  it('builds a promotion exam from an injected A2 source using a representative blueprint', () => {
    const sourceQuestions = [
      choiceQuestion('injected-a2-exam-001', 'A2', 'reading'),
      choiceQuestion('injected-a2-exam-002', 'A2', 'conversation'),
      choiceQuestion('injected-a2-exam-003', 'A2', 'grammar'),
      choiceQuestion('injected-a2-exam-004', 'A2', 'reading'),
      choiceQuestion('injected-a2-exam-005', 'A2', 'conversation'),
      writingQuestion('injected-a2-writing-001', 'A2', 'grammar'),
      choiceQuestion('injected-a1-current-distractor', 'A1', 'reading'),
    ];
    const questions = selectPromotionExamQuestions('A1', sourceQuestions);

    expect(questions.map((question) => question.id)).toEqual([
      'injected-a2-writing-001',
      'injected-a2-exam-001',
      'injected-a2-exam-002',
      'injected-a2-exam-003',
      'injected-a2-exam-004',
    ]);
    expect(new Set(questions.map((question) => question.area))).toEqual(
      new Set(['reading', 'conversation', 'grammar']),
    );
  });

  it('includes a writing task in promotion exams when one is available', () => {
    const questions = selectPromotionExamQuestions('A1');

    expect(questions.some((question) => question.kind === 'writing')).toBe(true);
  });

  it('does not select duplicate visible tasks in promotion exams even when choice text differs', () => {
    const duplicateReadingOne = {
      ...choiceQuestion('injected-a2-reading-duplicate-001', 'A2', 'reading'),
      promptKo: '문장을 읽고 의미가 맞는 것을 고르세요.',
      questionText: 'Tom has a red bag.',
      choices: [
        { id: 'a', text: 'Tom has a red bag.' },
        { id: 'b', text: 'Tom has a blue bag.' },
        { id: 'c', text: 'Tom has two bags.' },
      ],
    } satisfies LearningQuestion;
    const duplicateReadingTwo = {
      ...choiceQuestion('injected-a2-reading-duplicate-002', 'A2', 'reading'),
      promptKo: '문장을 읽고 의미가 맞는 것을 고르세요.',
      questionText: 'Tom has a red bag.',
      choices: [
        { id: 'a', text: 'The bag is red.' },
        { id: 'b', text: 'The bag is blue.' },
        { id: 'c', text: 'There are two bags.' },
      ],
    } satisfies LearningQuestion;
    const sourceQuestions = [
      writingQuestion('injected-a2-writing-001', 'A2', 'grammar'),
      duplicateReadingOne,
      duplicateReadingTwo,
      choiceQuestion('injected-a2-conversation-001', 'A2', 'conversation'),
      choiceQuestion('injected-a2-grammar-001', 'A2', 'grammar'),
      choiceQuestion('injected-a2-reading-filler-001', 'A2', 'reading'),
    ];
    const questions = selectPromotionExamQuestions('A1', sourceQuestions);
    const selectedIds = questions.map((question) => question.id);

    expect(questions).toHaveLength(PROMOTION_EXAM_QUESTION_COUNT);
    expect(selectedIds).not.toEqual(
      expect.arrayContaining([duplicateReadingOne.id, duplicateReadingTwo.id]),
    );
  });

  it('returns no promotion questions at the final level', () => {
    expect(selectPromotionExamQuestions('B2')).toEqual([]);
  });
});
