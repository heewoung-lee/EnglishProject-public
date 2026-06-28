import { createInitialMessages } from './conversationService';
import { createInitialConversationEngineState } from './conversationEngine';
import {
  calculateNextRateFromConversationScore,
  isPromotionReady,
} from './rateService';
import type { ConversationResult, ConversationSession, Scenario } from '../types/conversation';
import type { ConversationPracticeResult, LocalLearningState } from '../types/learning';

export function createConversationSession(scenario: Scenario): ConversationSession {
  return {
    id: `conversation-${Date.now()}`,
    mode: 'conversation',
    level: scenario.level,
    scenario,
    messages: createInitialMessages(scenario),
    failureCount: 0,
    engineState: createInitialConversationEngineState(scenario),
  };
}

export function buildConversationPracticeResult(
  state: LocalLearningState,
  session: ConversationSession,
  conversationResult: ConversationResult,
): ConversationPracticeResult {
  const nextRate = calculateNextRateFromConversationScore(
    state.currentRate,
    conversationResult.totalScore,
  );

  return {
    sessionId: session.id,
    level: session.level,
    scenario: session.scenario,
    previousRate: state.currentRate,
    nextRate,
    score: conversationResult.totalScore,
    promotionReady: isPromotionReady(nextRate),
    weakAreas: ['conversation'],
    messages: session.messages,
    conversationResult,
  };
}
