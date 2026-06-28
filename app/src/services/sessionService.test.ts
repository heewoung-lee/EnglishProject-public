import { describe, expect, it } from 'vitest';

import type {
  ActiveSession,
  LearnerLevel,
  LearningQuestion,
  LocalLearningState,
} from '../types/learning';
import {
  applySessionProficiencyStats,
  buildPracticeResult,
  buildPromotionExamResult,
  createPracticeSession,
  createPromotionExamSession,
  isSessionComplete,
  submitAnswer,
} from './sessionService';

const state: LocalLearningState = {
  currentLevel: 'A1',
  currentRate: 72,
  solvedQuestionCount: 0,
  promotionReady: false,
  recentResults: [],
  recentConversationResults: [],
  questionStats: {},
  skillStats: {},
  updatedAt: '2026-06-08T00:00:00.000Z',
};

function stateForLevel(level: LearnerLevel): LocalLearningState {
  return {
    ...state,
    currentLevel: level,
  };
}

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

function answerAllCorrect(session: ActiveSession): ActiveSession {
  return session.questions.reduce(
    (nextSession, question) => {
      if (question.kind === 'writing') {
        return submitAnswer(nextSession, {
          writingAnswer: question.sampleAnswer,
          writingEvaluation: {
            score: 100,
            isCorrect: true,
            correctedAnswer: question.sampleAnswer,
            feedbackKo: '좋은 답안입니다.',
            weakAreaKo: '',
            evaluationSource: 'localFallback',
          },
        });
      }

      return submitAnswer(nextSession, question.correctChoiceId);
    },
    session,
  );
}

describe('sessionService', () => {
  it('creates a practice session from the learner state', () => {
    const session = createPracticeSession(state);

    expect(session.mode).toBe('practice');
    expect(session.level).toBe('A1');
    expect(session.questions).toHaveLength(3);
    expect(session.currentQuestionIndex).toBe(0);
  });

  it('creates a practice session from an injected question source', () => {
    const sourceQuestions = [
      choiceQuestion('session-a1-choice-001', 'A1', 'reading'),
      writingQuestion('session-a1-writing-001', 'A1', 'grammar'),
      writingQuestion('session-a1-writing-002', 'A1', 'conversation'),
    ];
    const session = createPracticeSession(state, sourceQuestions);

    expect(session.questions.map((question) => question.id)).toEqual([
      'session-a1-choice-001',
      'session-a1-writing-001',
      'session-a1-writing-002',
    ]);
  });

  it('creates a practice session using local weak skill stats', () => {
    const sourceQuestions = [
      writingQuestion('session-balance-writing-001', 'A1', 'conversation'),
      writingQuestion('session-balance-writing-002', 'A1', 'reading'),
      {
        ...choiceQuestion('session-article-choice-001', 'A1', 'grammar'),
        skillTags: ['articles'],
      },
      {
        ...choiceQuestion('session-article-choice-002', 'A1', 'grammar'),
        skillTags: ['articles'],
      },
      choiceQuestion('session-balance-reading-001', 'A1', 'reading'),
    ] as unknown as LearningQuestion[];
    const session = createPracticeSession(
      {
        ...state,
        skillStats: {
          articles: {
            attempts: 4,
            correctCount: 1,
            lastScore: 25,
            lastPracticedAt: '2026-06-19T00:00:00.000Z',
          },
        },
      },
      sourceQuestions,
    );

    const selectedIds = session.questions.map((question) => question.id);
    const articleCount = selectedIds.filter((id) => id.includes('article')).length;
    const balanceCount = selectedIds.filter((id) => id.includes('balance')).length;

    expect(articleCount).toBe(2);
    expect(balanceCount).toBe(1);
  });

  it('shuffles choice answers when creating a practice session', () => {
    const sourceQuestions = [
      choiceQuestion('session-a1-choice-shuffle-001', 'A1', 'reading'),
      writingQuestion('session-a1-writing-shuffle-001', 'A1', 'grammar'),
      writingQuestion('session-a1-writing-shuffle-002', 'A1', 'conversation'),
    ];
    const session = createPracticeSession(state, sourceQuestions, { random: () => 0 });
    const choice = session.questions.find(
      (question) => question.id === 'session-a1-choice-shuffle-001',
    );

    if (choice?.kind !== 'choice') {
      throw new Error('Expected a choice question');
    }

    expect(choice.choices.map((item) => item.id)).toEqual(['b', 'a']);
    expect(choice.correctChoiceId).toBe('b');
  });

  it('does not keep the original answer order after shuffling', () => {
    const sourceQuestions = [
      choiceQuestion('session-a1-choice-shuffle-002', 'A1', 'reading'),
      writingQuestion('session-a1-writing-shuffle-003', 'A1', 'grammar'),
      writingQuestion('session-a1-writing-shuffle-004', 'A1', 'conversation'),
    ];
    const session = createPracticeSession(state, sourceQuestions, { random: () => 0.99 });
    const choice = session.questions.find(
      (question) => question.id === 'session-a1-choice-shuffle-002',
    );

    if (choice?.kind !== 'choice') {
      throw new Error('Expected a choice question');
    }

    expect(choice.choices.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it.each<LearnerLevel>(['A2', 'B1', 'B2'])(
    'shuffles choice answers for %s practice sessions',
    (level) => {
      const sourceQuestions = [
        choiceQuestion(`session-${level.toLowerCase()}-choice-shuffle-001`, level, 'reading'),
        writingQuestion(`session-${level.toLowerCase()}-writing-shuffle-001`, level, 'grammar'),
        writingQuestion(
          `session-${level.toLowerCase()}-writing-shuffle-002`,
          level,
          'conversation',
        ),
      ];
      const session = createPracticeSession(stateForLevel(level), sourceQuestions, {
        random: () => 0.99,
      });
      const choice = session.questions.find((question) => question.kind === 'choice');

      if (choice?.kind !== 'choice') {
        throw new Error('Expected a choice question');
      }

      expect(choice.level).toBe(level);
      expect(choice.choices.map((item) => item.id)).toEqual(['b', 'a']);
    },
  );

  it('creates a promotion exam session from an injected question source', () => {
    const sourceQuestions = [
      choiceQuestion('session-a2-exam-001', 'A2', 'reading'),
      choiceQuestion('session-a2-exam-002', 'A2', 'conversation'),
      choiceQuestion('session-a2-exam-003', 'A2', 'grammar'),
      choiceQuestion('session-a2-exam-004', 'A2', 'reading'),
      choiceQuestion('session-a2-exam-005', 'A2', 'conversation'),
    ];
    const session = createPromotionExamSession(state, sourceQuestions);

    expect(session.questions.map((question) => question.id)).toEqual([
      'session-a2-exam-001',
      'session-a2-exam-002',
      'session-a2-exam-003',
      'session-a2-exam-004',
      'session-a2-exam-005',
    ]);
  });

  it('shuffles choice answers for promotion exam sessions across levels', () => {
    const sourceQuestions = [
      choiceQuestion('session-b1-exam-shuffle-001', 'B1', 'reading'),
      choiceQuestion('session-b1-exam-shuffle-002', 'B1', 'conversation'),
      choiceQuestion('session-a2-exam-shuffle-001', 'A2', 'grammar'),
      choiceQuestion('session-a2-exam-shuffle-002', 'A2', 'reading'),
      choiceQuestion('session-a2-exam-shuffle-003', 'A2', 'conversation'),
    ];
    const session = createPromotionExamSession(stateForLevel('A2'), sourceQuestions, {
      random: () => 0.99,
    });

    expect(session.questions).toHaveLength(5);
    expect(session.questions.every((question) => question.kind === 'choice')).toBe(true);
    session.questions.forEach((question) => {
      if (question.kind !== 'choice') {
        throw new Error('Expected a choice question');
      }

      expect(question.choices.map((item) => item.id)).toEqual(['b', 'a']);
    });
  });

  it('records submitted answers and completes after every question is answered', () => {
    const session = createPracticeSession(state);
    const answeredSession = answerAllCorrect(session);

    expect(answeredSession.answers).toHaveLength(session.questions.length);
    expect(isSessionComplete(answeredSession)).toBe(true);
  });

  it('builds a practice result with next rate, explanations, and weak areas', () => {
    const session = createPracticeSession(state);
    const answeredSession = session.questions.reduce((nextSession, question, index) => {
      if (question.kind === 'writing') {
        return submitAnswer(nextSession, {
          writingAnswer: index === 0 ? 'bad' : question.sampleAnswer,
          writingEvaluation: {
            score: index === 0 ? 20 : 100,
            isCorrect: index !== 0,
            correctedAnswer: question.sampleAnswer,
            feedbackKo: index === 0 ? '핵심 내용이 부족합니다.' : '좋은 답안입니다.',
            weakAreaKo: index === 0 ? '문장 구성' : '',
            evaluationSource: 'localFallback',
          },
        });
      }

      const selectedChoiceId = index === 0 ? 'wrong-choice' : question.correctChoiceId;
      return submitAnswer(nextSession, selectedChoiceId);
    }, session);

    const result = buildPracticeResult(state, answeredSession);

    expect(result.correctCount).toBe(2);
    expect(result.nextRate).toBe(78);
    expect(result.promotionReady).toBe(false);
    expect(result.explanations).toHaveLength(3);
    expect(result.weakAreas).toEqual([session.questions[0]?.area]);
    expect(result.correctQuestionIds).toEqual(
      session.questions.slice(1).map((question) => question.id),
    );
  });

  it('builds a passing promotion result with the next level', () => {
    const examSession = createPromotionExamSession(state);
    const answeredSession = examSession.questions.reduce((nextSession, question, index) => {
      if (question.kind === 'writing') {
        return submitAnswer(nextSession, {
          writingAnswer: question.sampleAnswer,
          writingEvaluation: {
            score: index < 4 ? 100 : 0,
            isCorrect: index < 4,
            correctedAnswer: question.sampleAnswer,
            feedbackKo: index < 4 ? '좋은 답안입니다.' : '보완이 필요합니다.',
            evaluationSource: 'localFallback',
          },
        });
      }

      const selectedChoiceId =
        index < 4 ? question.correctChoiceId : 'wrong-choice';
      return submitAnswer(nextSession, selectedChoiceId);
    }, examSession);

    const result = buildPromotionExamResult(state, answeredSession);

    expect(result.score).toBe(80);
    expect(result.passed).toBe(true);
    expect(result.toLevel).toBe('A2');
    expect(result.questionIds).toEqual(examSession.questions.map((question) => question.id));
    expect(result.correctQuestionIds).toEqual(
      examSession.questions.slice(0, 4).map((question) => question.id),
    );
    expect(result.explanations).toHaveLength(5);
  });

  it('reflects writing evaluation in correct counts, correct question ids, and explanations', () => {
    const writingQuestion = {
      id: 'a1-writing-test-001',
      level: 'A1',
      area: 'grammar',
      kind: 'writing',
      promptKo: '좋아하는 음식을 영어로 한 문장 쓰세요.',
      questionText: 'Employees who receive clear training make fewer mistakes during busy hours.',
      sampleAnswer: 'I like apples.',
      evaluationFocusKo: 'I like ... 문장 구조와 음식 단어 사용',
      expectedKeywords: ['like', 'apples'],
      explanationKo: 'I like 뒤에 좋아하는 대상을 쓰면 됩니다.',
      weakPointLabel: '기본 문장 구성',
    };
    const choiceQuestion = {
      id: 'a1-choice-test-001',
      level: 'A1',
      area: 'reading',
      kind: 'choice',
      promptKo: '맞는 답을 고르세요.',
      questionText: 'Tom has a red bag.',
      choices: [
        { id: 'a', text: 'Wrong' },
        { id: 'b', text: 'Right' },
      ],
      correctChoiceId: 'b',
      explanationKo: 'b가 정답입니다.',
      weakPointLabel: 'Basic reading',
    };
    const session = {
      id: 'practice-writing',
      mode: 'practice',
      level: 'A1',
      questions: [writingQuestion, choiceQuestion],
      currentQuestionIndex: 2,
      answers: [
        {
          questionId: writingQuestion.id,
          writingAnswer: 'I like apples.',
          writingEvaluation: {
            score: 92,
            isCorrect: true,
            correctedAnswer: 'I like apples.',
            feedbackKo: '핵심 표현을 정확히 사용했습니다.',
            weakAreaKo: 'No real weakness.',
            evaluationSource: 'localFallback',
            rubric: {
              taskCompletion: 32,
              meaning: 28,
              grammar: 19,
              naturalness: 13,
            },
            scoreReasonsKo: ['과제 요구를 충족했습니다.', '핵심 의미가 전달되었습니다.'],
            skillTags: [],
          },
        },
        {
          questionId: choiceQuestion.id,
          selectedChoiceId: 'b',
        },
      ],
    } as unknown as ActiveSession;

    const result = buildPracticeResult(state, session);
    const writingExplanation = result.explanations.find(
      (item) => item.questionId === writingQuestion.id,
    ) as Record<string, unknown>;
    const choiceExplanation = result.explanations.find(
      (item) => item.questionId === choiceQuestion.id,
    ) as Record<string, unknown>;

    expect(result.correctCount).toBe(2);
    expect(result.correctQuestionIds).toEqual([writingQuestion.id, choiceQuestion.id]);
    expect(writingExplanation.isCorrect).toBe(true);
    expect(writingExplanation.area).toBe('grammar');
    expect(writingExplanation.writingAnswer).toBe('I like apples.');
    expect(writingExplanation.questionText).toBe(
      'Employees who receive clear training make fewer mistakes during busy hours.',
    );
    expect(writingExplanation.correctedAnswer).toBe('I like apples.');
    expect(writingExplanation.writingFeedbackKo).toBe('핵심 표현을 정확히 사용했습니다.');
    expect(writingExplanation.writingRubric).toEqual({
      taskCompletion: 32,
      meaning: 28,
      grammar: 19,
      naturalness: 13,
    });
    expect(writingExplanation.writingScoreReasonsKo).toEqual([
      '과제 요구를 충족했습니다.',
      '핵심 의미가 전달되었습니다.',
    ]);
    expect(writingExplanation.writingSkillTags).toEqual([]);
    expect(writingExplanation.weakPointLabel).toBe('');
    expect(writingExplanation.evaluationSource).toBe('localFallback');
    expect(choiceExplanation.isCorrect).toBe(true);
    expect(choiceExplanation.area).toBe('reading');
    expect(choiceExplanation.questionText).toBe('Tom has a red bag.');
    expect(choiceExplanation.weakPointLabel).toBe('');
  });

  it('keeps the reading area on translation writing explanations', () => {
    const readingTranslationQuestion = {
      id: 'a1-reading-translation-test-001',
      level: 'A1',
      area: 'reading',
      kind: 'writing',
      promptKo: '영어 지문을 읽고 한글로 번역하세요.',
      questionText: 'Please call me tomorrow.',
      sampleAnswer: '내일 나에게 전화해 주세요.',
      evaluationFocusKo: 'Translate the meaning into Korean.',
      explanationKo: 'Please call me tomorrow.는 내일 전화해 달라는 뜻입니다.',
      weakPointLabel: '기초 독해',
    };
    const session = {
      id: 'practice-reading-writing',
      mode: 'practice',
      level: 'A1',
      questions: [readingTranslationQuestion],
      currentQuestionIndex: 1,
      answers: [
        {
          questionId: readingTranslationQuestion.id,
          writingAnswer: '내일 나에게 연락해',
          writingEvaluation: {
            score: 72,
            isCorrect: false,
            correctedAnswer: '내일 나에게 전화해 주세요.',
            feedbackKo: '의미는 전달됐지만 call은 전화하다는 뜻입니다.',
            weakAreaKo: 'call의 의미',
            evaluationSource: 'localFallback',
          },
        },
      ],
    } as unknown as ActiveSession;

    const result = buildPracticeResult(state, session);

    expect(result.explanations[0]?.area).toBe('reading');
    expect(result.explanations[0]?.writingScore).toBe(72);
  });

  it('aggregates weak skill tags from incorrect writing evaluations', () => {
    const writingQuestion = {
      id: 'a1-writing-skill-tag-001',
      level: 'A1',
      area: 'conversation',
      kind: 'writing',
      promptKo: '좋아하는 음식을 영어로 쓰세요.',
      sampleAnswer: 'I like apples.',
      evaluationFocusKo: 'I like ... 문장 구조와 음식 어휘',
      expectedKeywords: ['i', 'like'],
      explanationKo: 'I like 뒤에 좋아하는 음식을 쓰면 됩니다.',
      weakPointLabel: '음식 어휘',
    };
    const session = {
      id: 'practice-skill-tags',
      mode: 'practice',
      level: 'A1',
      questions: [writingQuestion],
      currentQuestionIndex: 1,
      answers: [
        {
          questionId: writingQuestion.id,
          writingAnswer: 'I like susui.',
          writingEvaluation: {
            score: 45,
            isCorrect: false,
            correctedAnswer: 'I like sushi.',
            feedbackKo: '철자를 확인하세요.',
            weakAreaKo: '음식 단어 철자',
            evaluationSource: 'localFallback',
            skillTags: ['vocabulary_range', 'task_completion'],
          },
        },
      ],
    } as unknown as ActiveSession;

    const result = buildPracticeResult(state, session);

    expect(result.weakSkillTags).toEqual(['vocabulary_range', 'task_completion']);
    expect(result.explanations[0]?.writingSkillTags).toEqual([
      'vocabulary_range',
      'task_completion',
    ]);
  });

  it('accumulates question and skill proficiency stats from a completed session', () => {
    const choice = {
      ...choiceQuestion('a1-choice-stat-001', 'A1', 'reading'),
      skillTags: ['question_comprehension'],
    } satisfies LearningQuestion;
    const writing = {
      ...writingQuestion('a1-writing-stat-001', 'A1', 'conversation'),
      skillTags: ['task_completion'],
    } satisfies LearningQuestion;
    const session = {
      id: 'practice-stat',
      mode: 'practice',
      level: 'A1',
      questions: [choice, writing],
      currentQuestionIndex: 2,
      answers: [
        {
          questionId: choice.id,
          kind: 'choice',
          selectedChoiceId: choice.correctChoiceId,
        },
        {
          questionId: writing.id,
          kind: 'writing',
          writingAnswer: 'I like susui.',
          writingEvaluation: {
            score: 45,
            isCorrect: false,
            correctedAnswer: 'I like sushi.',
            feedbackKo: '철자를 확인하세요.',
            weakAreaKo: '음식 단어 철자',
            evaluationSource: 'localFallback',
            skillTags: ['vocabulary_range'],
          },
        },
      ],
    } as ActiveSession;
    const stateWithHistory: LocalLearningState = {
      ...state,
      questionStats: {
        [choice.id]: {
          attempts: 1,
          correctCount: 1,
          lastScore: 100,
          lastPracticedAt: '2026-06-07T00:00:00.000Z',
        },
      },
      skillStats: {
        question_comprehension: {
          attempts: 1,
          correctCount: 1,
          lastScore: 100,
          lastPracticedAt: '2026-06-07T00:00:00.000Z',
        },
      },
    };

    const nextState = applySessionProficiencyStats(
      stateWithHistory,
      session,
      '2026-06-08T00:05:00.000Z',
    );

    expect(nextState.questionStats).toEqual({
      [choice.id]: {
        attempts: 2,
        correctCount: 2,
        lastScore: 100,
        lastPracticedAt: '2026-06-08T00:05:00.000Z',
      },
      [writing.id]: {
        attempts: 1,
        correctCount: 0,
        lastScore: 45,
        lastPracticedAt: '2026-06-08T00:05:00.000Z',
      },
    });
    expect(nextState.skillStats).toEqual({
      question_comprehension: {
        attempts: 2,
        correctCount: 2,
        lastScore: 100,
        lastPracticedAt: '2026-06-08T00:05:00.000Z',
      },
      vocabulary_range: {
        attempts: 1,
        correctCount: 0,
        lastScore: 45,
        lastPracticedAt: '2026-06-08T00:05:00.000Z',
      },
    });
  });
});
