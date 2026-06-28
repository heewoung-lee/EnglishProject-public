import { describe, expect, it, vi } from 'vitest';

import { scenarios } from '../data/scenarios';
import type { ConversationResult } from '../types/conversation';
import type { LocalLearningState } from '../types/learning';
import {
  buildConversationPracticeResult,
  createConversationSession,
} from './conversationSessionService';

const state = {
  currentLevel: 'A1',
  currentRate: 72,
  solvedQuestionCount: 9,
  promotionReady: false,
  recentResults: [],
  recentConversationResults: [],
  questionStats: {},
  skillStats: {},
  updatedAt: '2026-06-10T00:00:00.000Z',
} as LocalLearningState;

const conversationEvaluation: ConversationResult = {
  totalScore: 86,
  evaluationSource: 'localFallback',
  categoryScores: {
    taskCompletion: 27,
    clarity: 22,
    grammar: 17,
    vocabulary: 12,
    naturalness: 8,
  },
  summaryKo: '목표를 대부분 달성했습니다.',
  strengthsKo: ['질문에 맞게 답했습니다.'],
  weaknessesKo: ['관사를 더 정확히 쓰세요.'],
  correctedExamples: [],
  weaknessTags: ['articles'],
  recommendedScenarioIds: ['a1-hotel-checkin-001'],
};

describe('conversationSessionService', () => {
  it('creates a conversation session with the scenario opening message', () => {
    vi.setSystemTime(new Date('2026-06-10T00:00:00.000Z'));

    const session = createConversationSession(scenarios[0]);

    expect(session.mode).toBe('conversation');
    expect(session.scenario.id).toBe(scenarios[0].id);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]?.role).toBe('assistant');
    expect(session.failureCount).toBe(0);

    vi.useRealTimers();
  });

  it('creates a conversation session with engine state', () => {
    const session = createConversationSession(scenarios[0]);

    expect(session.engineState.pendingSlotKey).toBe(scenarios[0].requiredSlots[0]?.key ?? null);
    expect(session.engineState.userTurnCount).toBe(0);
    expect(session.engineState.endReason).toBeNull();
  });

  it('builds a conversation result with rate and promotion readiness', () => {
    const session = createConversationSession(scenarios[0]);
    const result = buildConversationPracticeResult(state, session, conversationEvaluation);

    expect(result.level).toBe('A1');
    expect(result.previousRate).toBe(72);
    expect(result.nextRate).toBe(82);
    expect(result.promotionReady).toBe(true);
    expect(result.weakAreas).toEqual(['conversation']);
    expect(result.conversationResult.totalScore).toBe(86);
  });
});
