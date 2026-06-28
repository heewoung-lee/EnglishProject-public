import { describe, expect, it } from 'vitest';

import { scenarios } from '../data/scenarios';
import type { LearnerLevel, LocalLearningState, RecentConversationResult, RecentResult } from '../types/learning';
import { selectNextLearningActivity } from './learningActivitySelector';

const baseState = {
  currentLevel: 'A1',
  currentRate: 42,
  solvedQuestionCount: 0,
  promotionReady: false,
  recentResults: [],
  recentConversationResults: [],
  questionStats: {},
  skillStats: {},
  updatedAt: '2026-06-10T00:00:00.000Z',
} as LocalLearningState;

function practiceResult(
  index: number,
  solvedAt: string,
  level: LearnerLevel = 'A1',
): RecentResult {
  return {
    questionSetId: `practice-${index}`,
    level,
    score: 80,
    rateAfter: 58,
    questionIds: [`q-${index}-1`, `q-${index}-2`, `q-${index}-3`],
    correctQuestionIds: [`q-${index}-1`, `q-${index}-2`],
    weakAreas: ['grammar'],
    solvedAt,
  };
}

function conversationResult(
  index: number,
  solvedAt: string,
  score = 80,
  level: LearnerLevel = 'A1',
): RecentConversationResult {
  return {
    conversationSessionId: `conversation-${index}`,
    scenarioId: `a1-conversation-${index}`,
    level,
    score,
    rateAfter: 58,
    weaknessTags: score < 70 ? ['task_completion'] : [],
    recommendedScenarioIds: score < 70 ? ['a1-hotel-checkin-001'] : [],
    solvedAt,
  };
}

describe('learningActivitySelector', () => {
  it('selects ordinary practice by default', () => {
    expect(selectNextLearningActivity(baseState, scenarios)).toEqual({ kind: 'practice' });
  });

  it('selects a conversation session when conversation is the latest weak area', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentResults: [
          {
            questionSetId: 'practice-weak-conversation',
            level: 'A1',
            score: 67,
            rateAfter: 48,
            questionIds: ['q1', 'q2', 'q3'],
            correctQuestionIds: ['q1', 'q2'],
            weakAreas: ['conversation'],
            solvedAt: '2026-06-10T00:01:00.000Z',
          },
        ],
      },
      scenarios,
    );

    expect(activity.kind).toBe('conversation');
    expect(activity.kind === 'conversation' ? activity.scenario.level : null).toBe('A1');
  });

  it('avoids a recently passed conversation scenario when alternatives remain', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentResults: [
          {
            questionSetId: 'practice-weak-conversation',
            level: 'A1',
            score: 67,
            rateAfter: 48,
            questionIds: ['q1', 'q2', 'q3'],
            correctQuestionIds: ['q1', 'q2'],
            weakAreas: ['conversation'],
            solvedAt: '2026-06-10T00:01:00.000Z',
          },
        ],
        recentConversationResults: [
          {
            conversationSessionId: 'conversation-1',
            scenarioId: 'a1-cafe-order-001',
            level: 'A1',
            score: 90,
            rateAfter: 58,
            weaknessTags: [],
            recommendedScenarioIds: [],
            solvedAt: '2026-06-10T00:02:00.000Z',
          },
        ],
      },
      scenarios,
    );

    expect(activity.kind).toBe('conversation');
    expect(activity.kind === 'conversation' ? activity.scenario.id : null).not.toBe(
      'a1-cafe-order-001',
    );
  });

  it('returns to ordinary practice after all same-level conversation scenarios were recently passed', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentResults: [
          {
            questionSetId: 'practice-weak-conversation',
            level: 'A1',
            score: 67,
            rateAfter: 48,
            questionIds: ['q1', 'q2', 'q3'],
            correctQuestionIds: ['q1', 'q2'],
            weakAreas: ['conversation'],
            solvedAt: '2026-06-10T00:01:00.000Z',
          },
        ],
        recentConversationResults: scenarios
          .filter((scenario) => scenario.level === 'A1')
          .map((scenario, index) => ({
            conversationSessionId: `conversation-${index}`,
            scenarioId: scenario.id,
            level: 'A1',
            score: 86,
            rateAfter: 82,
            weaknessTags: [],
            recommendedScenarioIds: [],
            solvedAt: `2026-06-10T00:0${index + 2}:00.000Z`,
          })),
      },
      scenarios,
    );

    expect(activity).toEqual({ kind: 'practice' });
  });

  it('keeps prioritizing another conversation scenario after a low conversation score', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentConversationResults: [
          {
            conversationSessionId: 'conversation-low',
            scenarioId: 'a1-cafe-order-001',
            level: 'A1',
            score: 45,
            rateAfter: 38,
            weaknessTags: ['task_completion'],
            recommendedScenarioIds: ['a1-hotel-checkin-001'],
            solvedAt: '2026-06-10T00:02:00.000Z',
          },
        ],
      },
      scenarios,
    );

    expect(activity.kind).toBe('conversation');
    expect(activity.kind === 'conversation' ? activity.scenario.id : null).toBe(
      'a1-hotel-checkin-001',
    );
  });

  it('switches to ordinary practice when recent same-level activity already has two conversations', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentResults: [1, 2, 3, 4, 5, 6, 7, 8].map((index) =>
          practiceResult(index, `2026-06-10T00:0${index}:00.000Z`),
        ),
        recentConversationResults: [
          conversationResult(1, '2026-06-10T00:07:00.000Z'),
          conversationResult(2, '2026-06-10T00:10:00.000Z', 45),
        ],
      },
      scenarios,
    );

    expect(activity).toEqual({ kind: 'practice' });
  });

  it('still allows conversation recovery while fewer than two recent same-level activities are conversations', () => {
    const activity = selectNextLearningActivity(
      {
        ...baseState,
        recentResults: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
          practiceResult(index, `2026-06-10T00:0${index}:00.000Z`),
        ),
        recentConversationResults: [
          conversationResult(1, '2026-06-10T00:10:00.000Z', 45),
        ],
      },
      scenarios,
    );

    expect(activity.kind).toBe('conversation');
  });
});
