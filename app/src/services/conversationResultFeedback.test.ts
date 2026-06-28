import { describe, expect, it } from 'vitest';

import type { ConversationMessage, CorrectedExample } from '../types/conversation';
import { buildConversationImprovementItems } from './conversationResultFeedback';

describe('buildConversationImprovementItems', () => {
  it('uses evaluator corrected examples as concrete improvement feedback', () => {
    const correctedExamples: CorrectedExample[] = [
      {
        original: 'i want coffee',
        corrected: "I'd like a coffee, please.",
        explanationKo: '카페 주문에서는 want보다 would like가 더 자연스럽고 공손합니다.',
        tags: ['polite_requests', 'natural_phrasing'],
      },
    ];

    const items = buildConversationImprovementItems({
      correctedExamples,
      messages: [],
    });

    expect(items).toEqual([
      {
        id: 'i want coffee::i’d like a coffee please',
        original: 'i want coffee',
        corrected: "I'd like a coffee, please.",
        explanationKo: '카페 주문에서는 want보다 would like가 더 자연스럽고 공손합니다.',
        tags: ['polite_requests', 'natural_phrasing'],
      },
    ]);
  });

  it('falls back to analyzed user messages when the evaluator omits corrected examples', () => {
    const messages: ConversationMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Hello. What would you like?',
        createdAt: '2026-06-22T00:00:00.000Z',
      },
      {
        id: 'user-1',
        role: 'user',
        content: 'i want americano',
        createdAt: '2026-06-22T00:00:01.000Z',
        analysis: {
          isRelevant: true,
          isUnderstandable: true,
          detectedIssues: ['polite_requests'],
          correctedSentence: "I'd like an Americano, please.",
          shortReasonKo: '주문할 때는 would like와 please를 쓰면 더 공손합니다.',
        },
      },
    ];

    const items = buildConversationImprovementItems({
      correctedExamples: [],
      messages,
    });

    expect(items).toEqual([
      {
        id: 'i want americano::i’d like an americano please',
        original: 'i want americano',
        corrected: "I'd like an Americano, please.",
        explanationKo: '주문할 때는 would like와 please를 쓰면 더 공손합니다.',
        tags: ['polite_requests'],
      },
    ]);
  });

  it('deduplicates unchanged and repeated corrections', () => {
    const correctedExamples: CorrectedExample[] = [
      {
        original: 'I need passport.',
        corrected: 'I need my passport.',
        explanationKo: 'my를 넣으면 필요한 물건이 더 분명합니다.',
        tags: ['natural_phrasing'],
      },
      {
        original: 'I need passport.',
        corrected: 'I need my passport.',
        explanationKo: '중복 예시입니다.',
        tags: ['natural_phrasing'],
      },
      {
        original: 'Thank you.',
        corrected: 'Thank you.',
        explanationKo: '이미 자연스러운 문장입니다.',
        tags: ['natural_phrasing'],
      },
    ];

    const items = buildConversationImprovementItems({
      correctedExamples,
      messages: [],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.original).toBe('I need passport.');
    expect(items[0]?.corrected).toBe('I need my passport.');
  });
});
