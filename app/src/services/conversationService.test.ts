import { describe, expect, it } from 'vitest';

import type { ConversationMessage, Scenario } from '../types/conversation';
import { scenarios } from '../data/scenarios';
import {
  createInitialConversationEngineState,
  getConversationEngineFailureCount,
} from './conversationEngine';
import {
  buildConversationTurnMessages,
  getMockActorResponse as getMockActorResponseBase,
  normalizeActorApiResponse,
} from './conversationService';

function getMockActorResponse(input: Parameters<typeof getMockActorResponseBase>[0]) {
  return getMockActorResponseBase(input);
}

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

const openingMessage: ConversationMessage = {
  id: 'assistant-1',
  role: 'assistant',
  content: libraryScenario.openingMessage,
  createdAt: '2026-06-10T00:00:00.000Z',
};

describe('conversationService fallback actor', () => {
  it('uses scenario-defined slots to ask the next missing question for unknown scenario ids', () => {
    const response = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'I need a library card, please.',
      previousMessages: [openingMessage],
      failureCount: 0,
    });

    expect(response.userAnalysis.isRelevant).toBe(true);
    expect(response.shouldEndSession).toBe(false);
    expect(response.message.content).toBe('May I have your name, please?');
  });

  it('ends the fallback roleplay when all required slots are present', () => {
    const response = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'My name is Mina Park.',
      previousMessages: [
        openingMessage,
        {
          id: 'user-1',
          role: 'user',
          content: 'I need a library card, please.',
          createdAt: '2026-06-10T00:00:01.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('goal_completed');
    expect(response.message.content).toBe(libraryScenario.completionMessage);
  });

  it('keeps the assistant terminal message out of visible chat when the next step is evaluation', () => {
    const userMessage: ConversationMessage = {
      id: 'user-final',
      role: 'user',
      content: 'My name is Mina Park.',
      createdAt: '2026-06-10T00:00:02.000Z',
    };
    const response = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: userMessage.content,
      previousMessages: [
        openingMessage,
        {
          id: 'user-1',
          role: 'user',
          content: 'I need a library card, please.',
          createdAt: '2026-06-10T00:00:01.000Z',
        },
      ],
      failureCount: 0,
    });

    const visibleMessages = buildConversationTurnMessages({
      previousMessages: [openingMessage],
      userMessage,
      actorResponse: response,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(visibleMessages).toHaveLength(2);
    expect(visibleMessages.at(-1)).toBe(userMessage);
    expect(visibleMessages).not.toContain(response.message);
  });

  it('asks for an English retry when the learner answers only in Korean', () => {
    const response = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: '도서관 카드요',
      previousMessages: [openingMessage],
      failureCount: 0,
    });

    expect(response.communicationFailed).toBe(true);
    expect(response.shouldEndSession).toBe(false);
    expect(response.endReason).toBeNull();
    expect(response.message.content).toBe(libraryScenario.repairPolicy.koreanOnly);
  });

  it('does not require polite request markers for simple slot-filling statements', () => {
    const response = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'My name is Mina Park.',
      previousMessages: [
        openingMessage,
        {
          id: 'user-1',
          role: 'user',
          content: 'I need a library card, please.',
          createdAt: '2026-06-10T00:00:01.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.userAnalysis.detectedIssues).not.toContain('polite_requests');
    expect(response.userAnalysis.correctedSentence).toBeUndefined();
  });

  it('ends restaurant fallback roleplay for polite arbitrary food orders', () => {
    const restaurantScenario: Scenario = {
      id: 'a2-restaurant-request-001',
      level: 'A2',
      area: 'conversation',
      titleKo: '식당에서 요청하기',
      titleEn: 'Making a Request at a Restaurant',
      situationKo: '식당에서 직원에게 정중하게 요청해야 합니다.',
      descriptionKo: '필요한 것을 공손하게 말하는 연습입니다.',
      aiRole: 'Restaurant server',
      userRole: 'Customer',
      userGoalKo: '필요한 것을 정중하게 요청하고 대화를 마무리하세요.',
      difficulty: 'intermediate',
      maxUserTurns: 5,
      targetExpressions: ['Could I have ...?', 'Could you bring ...?', 'May I get the bill?'],
      targetSkills: ['polite_requests', 'articles', 'natural_phrasing', 'task_completion'],
      openingMessage: 'Hello. Are you ready to order, or do you need anything?',
      completionMessage: "Of course. I'll bring that right away.",
      repairPolicy: {
        unclear: 'Sorry, could you say that again in English?',
        offTopic: 'Let us come back to this situation. What do you need?',
        correction: 'No problem. Thanks for correcting that.',
        koreanOnly: 'Please try saying that in English.',
      },
      successCriteria: [
        'Ask for the needed restaurant item.',
        'Use a polite request form.',
        'Close the request naturally.',
      ],
      requiredSlots: [
        {
          key: 'requestItem',
          label: 'restaurant request',
          prompt: 'What would you like me to bring?',
          matchKeywords: ['water', 'menu', 'bill', 'check'],
        },
        {
          key: 'politeRequest',
          label: 'polite request',
          prompt: 'Could you ask politely?',
          matchKeywords: ['please', 'could i', 'could you', 'can i', 'may i'],
        },
      ],
    };

    const response = getMockActorResponse({
      scenario: restaurantScenario,
      userMessage: "I'd like a sundubu jjigae please.",
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: restaurantScenario.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('goal_completed');
    expect(response.message.content).toBe(restaurantScenario.completionMessage);
  });

  it('does not end restaurant fallback roleplay when the request item is missing', () => {
    const restaurantScenario: Scenario = {
      id: 'a2-restaurant-request-001',
      level: 'A2',
      area: 'conversation',
      titleKo: '식당에서 요청하기',
      titleEn: 'Making a Request at a Restaurant',
      situationKo: '식당에서 직원에게 정중하게 요청해야 합니다.',
      descriptionKo: '필요한 것을 공손하게 말하는 연습입니다.',
      aiRole: 'Restaurant server',
      userRole: 'Customer',
      userGoalKo: '필요한 것을 정중하게 요청하고 대화를 마무리하세요.',
      difficulty: 'intermediate',
      maxUserTurns: 5,
      targetExpressions: ['Could I have ...?', 'Could you bring ...?', 'May I get the bill?'],
      targetSkills: ['polite_requests', 'articles', 'natural_phrasing', 'task_completion'],
      openingMessage: 'Hello. Are you ready to order, or do you need anything?',
      completionMessage: "Of course. I'll bring that right away.",
      repairPolicy: {
        unclear: 'Sorry, could you say that again in English?',
        offTopic: 'Let us come back to this situation. What do you need?',
        correction: 'No problem. Thanks for correcting that.',
        koreanOnly: 'Please try saying that in English.',
      },
      successCriteria: [
        'Ask for the needed restaurant item.',
        'Use a polite request form.',
        'Close the request naturally.',
      ],
      requiredSlots: [
        {
          key: 'requestItem',
          label: 'restaurant request',
          prompt: 'What would you like me to bring?',
          matchKeywords: ['water', 'menu', 'bill', 'check'],
        },
        {
          key: 'politeRequest',
          label: 'polite request',
          prompt: 'Could you ask politely?',
          matchKeywords: ['please', 'could i', 'could you', 'can i', 'may i'],
        },
      ],
    };

    const response = getMockActorResponse({
      scenario: restaurantScenario,
      userMessage: 'Could I have please?',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: restaurantScenario.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(false);
    expect(response.endReason).toBeNull();
    expect(response.message.content).toBe('What would you like me to bring?');
  });

  it('does not use previous restaurant chat text as the request item', () => {
    const restaurantScenario: Scenario = {
      id: 'a2-restaurant-request-001',
      level: 'A2',
      area: 'conversation',
      titleKo: '식당에서 요청하기',
      titleEn: 'Making a Request at a Restaurant',
      situationKo: '식당에서 직원에게 정중하게 요청해야 합니다.',
      descriptionKo: '필요한 것을 공손하게 말하는 연습입니다.',
      aiRole: 'Restaurant server',
      userRole: 'Customer',
      userGoalKo: '필요한 것을 정중하게 요청하고 대화를 마무리하세요.',
      difficulty: 'intermediate',
      maxUserTurns: 5,
      targetExpressions: ['Could I have ...?', 'Could you bring ...?', 'May I get the bill?'],
      targetSkills: ['polite_requests', 'articles', 'natural_phrasing', 'task_completion'],
      openingMessage: 'Hello. Are you ready to order, or do you need anything?',
      completionMessage: "Of course. I'll bring that right away.",
      repairPolicy: {
        unclear: 'Sorry, could you say that again in English?',
        offTopic: 'Let us come back to this situation. What do you need?',
        correction: 'No problem. Thanks for correcting that.',
        koreanOnly: 'Please try saying that in English.',
      },
      successCriteria: [
        'Ask for the needed restaurant item.',
        'Use a polite request form.',
        'Close the request naturally.',
      ],
      requiredSlots: [
        {
          key: 'requestItem',
          label: 'restaurant request',
          prompt: 'What would you like me to bring?',
          matchKeywords: ['water', 'menu', 'bill', 'check'],
        },
        {
          key: 'politeRequest',
          label: 'polite request',
          prompt: 'Could you ask politely?',
          matchKeywords: ['please', 'could i', 'could you', 'can i', 'may i'],
        },
      ],
    };

    const response = getMockActorResponse({
      scenario: restaurantScenario,
      userMessage: 'Could I have please?',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: restaurantScenario.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: 'What would you like me to bring?',
          createdAt: '2026-06-10T00:00:02.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(false);
    expect(response.endReason).toBeNull();
    expect(response.message.content).toBe('What would you like me to bring?');
  });

  it('fallback actor repairs off-topic turns before ending without repeating the slot prompt', () => {
    const first = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'I like soccer.',
      previousMessages: [openingMessage],
      failureCount: 0,
      engineState: createInitialConversationEngineState(libraryScenario),
    });
    const second = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'I still like soccer.',
      previousMessages: [openingMessage],
      failureCount: 0,
      engineState: first.engineState,
    });
    const third = getMockActorResponse({
      scenario: libraryScenario,
      userMessage: 'soccer again',
      previousMessages: [openingMessage],
      failureCount: 0,
      engineState: second.engineState,
    });

    expect(first.shouldEndSession).toBe(false);
    expect(first.endReason).toBeNull();
    expect(first.message.content).toBe(libraryScenario.repairPolicy.offTopic);
    expect(first.message.content).not.toBe(libraryScenario.requiredSlots[0].prompt);
    expect(second.shouldEndSession).toBe(false);
    expect(second.endReason).toBeNull();
    expect(second.message.content).toBe(libraryScenario.repairPolicy.offTopic);
    expect(third.shouldEndSession).toBe(true);
    expect(third.endReason).toBe('too_many_failures');
    expect(third.message.content).toBe("Let's stop here and review your English together.");
  });

  it('does not end built-in scenarios through legacy completion phrases before required slots are filled', () => {
    const cafeScenario = scenarios.find((scenario) => scenario.id === 'a1-cafe-order-001');

    if (!cafeScenario) {
      throw new Error('Cafe scenario is missing.');
    }

    const response = getMockActorResponse({
      scenario: cafeScenario,
      userMessage: 'To go, please.',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: cafeScenario.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(false);
    expect(response.endReason).toBeNull();
    expect(response.message.content).toBe('Sure. What would you like to drink?');
  });

  it('does not use a success completion message when the fallback ends because max turns are reached', () => {
    const cafeScenario = scenarios.find((scenario) => scenario.id === 'a1-cafe-order-001');

    if (!cafeScenario) {
      throw new Error('Cafe scenario is missing.');
    }

    const previousMessages: ConversationMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: cafeScenario.openingMessage,
        createdAt: '2026-06-10T00:00:00.000Z',
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `user-${index + 1}`,
        role: 'user' as const,
        content: 'Coffee.',
        createdAt: `2026-06-10T00:00:0${index + 1}.000Z`,
      })),
    ];

    const response = getMockActorResponse({
      scenario: cafeScenario,
      userMessage: 'Coffee.',
      previousMessages,
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('no_progress');
    expect(response.message.content).not.toBe(cafeScenario.completionMessage);
  });

  it('does not emit placeholder target expressions as corrected sentences', () => {
    const cafeScenario = scenarios.find((scenario) => scenario.id === 'a1-cafe-order-001');

    if (!cafeScenario) {
      throw new Error('Cafe scenario is missing.');
    }

    const response = getMockActorResponse({
      scenario: cafeScenario,
      userMessage: 'I want coffee.',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: cafeScenario.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.userAnalysis.correctedSentence).not.toBe("I'd like ...");
  });

  it('drops placeholder corrected sentences from the API response path', () => {
    const input = {
      scenario: libraryScenario,
      userMessage: 'I need a library card, please.',
      previousMessages: [openingMessage],
      failureCount: 0,
      engineState: createInitialConversationEngineState(libraryScenario),
    };

    const response = normalizeActorApiResponse(
      {
        message: 'Sure. What size would you like?',
        isUserUnderstandable: true,
        isUserRelevant: true,
        shouldEndSession: false,
        endReason: null,
        detectedIssueTags: ['natural_phrasing'],
        correctedSentence: "I'd like ...",
        shortReasonKo: '더 자연스러운 표현을 연습하세요.',
      },
      input,
    );

    expect(response.userAnalysis.correctedSentence).toBeUndefined();
  });

  it('advances local engine state when an API response omits engine state', () => {
    const input = {
      scenario: libraryScenario,
      userMessage: 'I like soccer.',
      previousMessages: [openingMessage],
      failureCount: 0,
      engineState: createInitialConversationEngineState(libraryScenario),
    };

    const response = normalizeActorApiResponse(
      {
        message: 'Server repair response.',
        isUserUnderstandable: true,
        isUserRelevant: false,
        shouldEndSession: false,
        endReason: null,
        detectedIssueTags: ['task_completion'],
        correctedSentence: null,
        shortReasonKo: 'Stay on the library card task.',
      },
      input,
    );

    expect(response.message.content).toBe('Server repair response.');
    expect(response.userAnalysis.isRelevant).toBe(false);
    expect(response.userAnalysis.detectedIssues).toEqual(['task_completion']);
    expect(response.engineState.userTurnCount).toBe(1);
    expect(response.engineState.noProgressCount).toBe(0);
    expect(getConversationEngineFailureCount(response.engineState)).toBe(1);
    expect(response.shouldEndSession).toBe(false);
    expect(response.endReason).toBeNull();
    expect(response.engineState).not.toBe(input.engineState);
  });

  it('uses local terminal state when a legacy API response omits engine state', () => {
    const input = {
      scenario: libraryScenario,
      userMessage: 'I like soccer.',
      previousMessages: [openingMessage],
      failureCount: 2,
      engineState: {
        ...createInitialConversationEngineState(libraryScenario),
        offTopicCount: 2,
      },
    };

    const response = normalizeActorApiResponse(
      {
        message: 'Server says keep going.',
        isUserUnderstandable: true,
        isUserRelevant: false,
        shouldEndSession: false,
        endReason: null,
        detectedIssueTags: ['task_completion'],
        correctedSentence: null,
        shortReasonKo: 'Stay on the library card task.',
      },
      input,
    );

    expect(response.message.content).toBe('Server says keep going.');
    expect(response.userAnalysis.isRelevant).toBe(false);
    expect(response.engineState.status).toBe('ended');
    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('too_many_failures');
  });
});
