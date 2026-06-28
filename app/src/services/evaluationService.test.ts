import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ConversationEngineEndReason,
  ConversationEngineState,
  ConversationMessage,
  Scenario,
} from '../types/conversation';
import { evaluateConversation, evaluateConversationWithAi } from './evaluationService';

const libraryScenario: Scenario = {
  id: 'a1-library-card-001',
  level: 'A1',
  area: 'conversation',
  titleKo: '도서관 카드 만들기',
  titleEn: 'Getting a Library Card',
  situationKo: '당신은 도서관에서 새 카드를 만들고 싶습니다.',
  descriptionKo: '필요한 카드 종류와 이름을 말하는 연습입니다.',
  aiRole: 'Librarian',
  userRole: 'Visitor',
  userGoalKo: '새 도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
  difficulty: 'beginner',
  maxUserTurns: 5,
  targetExpressions: ['I need a library card.', 'My name is ...'],
  targetSkills: ['polite_requests', 'vocabulary_range', 'task_completion'],
  openingMessage: 'Hello. How can I help you today?',
  completionMessage: 'Great. I can make a new library card for you.',
  repairPolicy: {
    unclear: 'Sorry, could you say that again in English?',
    offTopic: 'Let us come back to the library card. What do you need?',
    correction: 'No problem. Thanks for correcting that.',
    koreanOnly: 'Please try saying that in English.',
  },
  successCriteria: [
    'Say that a library card is needed.',
    'Provide a name for the card.',
  ],
  requiredSlots: [
    {
      key: 'cardType',
      label: 'library card request',
      prompt: 'Do you need a new card or a replacement card?',
      matchKeywords: ['library card', 'new card', 'replacement card'],
    },
    {
      key: 'name',
      label: 'visitor name',
      prompt: 'May I have your name, please?',
      matchKeywords: ['my name is', 'i am', "i'm", 'name is'],
    },
  ],
};

const userMessages: ConversationMessage[] = [
  {
    id: 'user-1',
    role: 'user',
    content: 'I need a library card, please.',
    createdAt: '2026-06-10T00:00:01.000Z',
    analysis: {
      isRelevant: true,
      isUnderstandable: true,
      detectedIssues: [],
    },
  },
  {
    id: 'user-2',
    role: 'user',
    content: 'My name is Mina Park.',
    createdAt: '2026-06-10T00:00:02.000Z',
    analysis: {
      isRelevant: true,
      isUnderstandable: true,
      detectedIssues: [],
    },
  },
];

describe('conversation evaluation fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('awards task completion from scenario-defined required slots for unknown scenario ids', () => {
    const result = evaluateConversation({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: null,
      endReason: null,
    });

    expect(result.categoryScores.taskCompletion).toBe(30);
    expect(result.summaryKo).toContain(libraryScenario.titleKo);
    expect(result.evaluationSource).toBe('localFallback');
  });

  it('marks API conversation evaluations as AI sourced', async () => {
    const apiResult = {
      totalScore: 90,
      categoryScores: {
        taskCompletion: 30,
        clarity: 25,
        grammar: 18,
        vocabulary: 10,
        naturalness: 7,
      },
      summaryKo: 'AI summary',
      strengthsKo: ['Clear goal'],
      weaknessesKo: [],
      correctedExamples: [],
      weaknessTags: [],
      recommendedScenarioIds: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => apiResult,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateConversationWithAi({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: null,
      endReason: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://englishproject-c42b2.web.app/api/conversation/evaluate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.evaluationSource).toBe('ai');
  });

  it('marks failed API conversation evaluations as local fallback sourced', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network failed'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await evaluateConversationWithAi({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: null,
      endReason: null,
    });

    expect(result.evaluationSource).toBe('localFallback');
  });

  it('caps no_progress endings with missing-slot penalties below a passing fallback score', () => {
    const result = evaluateConversation({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 3,
      engineState: createEngineState({
        filledSlotKeys: [],
        endReason: 'no_progress',
      }),
      endReason: 'no_progress',
    });

    expect(result.categoryScores).toEqual({
      taskCompletion: 6,
      clarity: 13,
      grammar: 20,
      vocabulary: 12,
      naturalness: 7,
    });
    expect(result.totalScore).toBe(58);
  });

  it('caps too_many_failures endings more severely', () => {
    const result = evaluateConversation({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: createEngineState({
        filledSlotKeys: ['cardType', 'name'],
        endReason: 'too_many_failures',
      }),
      endReason: 'too_many_failures',
    });

    expect(result.categoryScores).toEqual({
      taskCompletion: 10,
      clarity: 12,
      grammar: 20,
      vocabulary: 12,
      naturalness: 7,
    });
    expect(result.totalScore).toBe(61);
  });

  it('treats malformed filledSlotKeys as empty while applying endReason caps', () => {
    const malformedEngineState = {
      ...createEngineState({
        filledSlotKeys: ['cardType', 'name'],
        endReason: 'no_progress',
      }),
      filledSlotKeys: null,
    } as unknown as ConversationEngineState;

    const result = evaluateConversation({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: malformedEngineState,
      endReason: 'no_progress',
    });

    expect(result.categoryScores).toEqual({
      taskCompletion: 6,
      clarity: 18,
      grammar: 20,
      vocabulary: 12,
      naturalness: 7,
    });
    expect(result.totalScore).toBe(63);
    expect(result.weaknessesKo.some((weakness) => weakness.includes('library card request'))).toBe(true);
  });

  it('includes the first missing required slot label in weakness feedback', () => {
    const result = evaluateConversation({
      scenario: libraryScenario,
      messages: userMessages,
      communicationFailureCount: 0,
      engineState: createEngineState({
        filledSlotKeys: ['cardType'],
        endReason: 'max_turns',
      }),
      endReason: 'max_turns',
    });

    expect(result.weaknessesKo).toContain('아직 완료하지 못한 목표: visitor name');
  });
});

function createEngineState({
  filledSlotKeys,
  endReason,
}: {
  filledSlotKeys: string[];
  endReason: ConversationEngineEndReason;
}): ConversationEngineState {
  return {
    filledSlotKeys,
    pendingSlotKey: null,
    lastPromptKey: null,
    lastAssistantActionKey: null,
    lastTurnType: null,
    repeatedPromptCount: 0,
    noProgressCount: 0,
    offTopicCount: 0,
    unclearCount: 0,
    userTurnCount: userMessages.length,
    status: endReason === 'goal_completed' ? 'completed' : 'ended',
    endReason,
  };
}
