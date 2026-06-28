import { describe, expect, it } from 'vitest';

import { shouldShowInlineConversationFeedback } from './conversationInlineFeedback';
import type { UserMessageAnalysis } from '../types/conversation';

function analysis(overrides: Partial<UserMessageAnalysis>): UserMessageAnalysis {
  return {
    isRelevant: true,
    isUnderstandable: true,
    detectedIssues: [],
    shortReasonKo: '더 자연스럽게 말할 수 있습니다.',
    ...overrides,
  };
}

describe('conversationInlineFeedback', () => {
  it('hides natural phrasing advice when the learner made valid conversation progress', () => {
    expect(shouldShowInlineConversationFeedback(analysis({
      detectedIssues: ['natural_phrasing'],
      correctedSentence: "No thanks, I don't have any bags.",
    }))).toBe(false);
  });

  it('shows feedback when the answer blocks conversation progress', () => {
    expect(shouldShowInlineConversationFeedback(analysis({
      detectedIssues: ['task_completion'],
      shortReasonKo: '필요한 정보를 아직 말하지 않았어요.',
    }))).toBe(true);
  });

  it('shows feedback when the answer is unclear or off topic', () => {
    expect(shouldShowInlineConversationFeedback(analysis({
      isUnderstandable: false,
      detectedIssues: ['clarification'],
      shortReasonKo: '영어로 다시 말해 주세요.',
    }))).toBe(true);

    expect(shouldShowInlineConversationFeedback(analysis({
      isRelevant: false,
      detectedIssues: ['task_completion'],
      shortReasonKo: '상황과 다른 답변이에요.',
    }))).toBe(true);
  });
});
