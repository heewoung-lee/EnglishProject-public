import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bootstrapConversationEngineState,
  createInitialConversationEngineState,
  normalizeConversationEngineState,
  normalizeInterpreterOutput,
  runConversationEngineTurn,
} from './conversationEngine.mjs';
import {
  api,
  buildConversationState,
  createConversationResponseFromInterpretation,
  handleRequest,
  normalizeActorOutput,
  normalizeEvaluation,
  normalizeWritingEvaluation,
  readJsonBody,
} from './index.mjs';

const conversationEngineFixtureUrl = new URL('../test-fixtures/conversation-engine-v2.json', import.meta.url);

test('handleRequest returns health status without starting a standalone server', async () => {
  const request = Readable.from([]);
  request.method = 'GET';
  request.url = '/health';
  request.headers = { host: 'localhost:3001' };

  const response = createResponse();

  await handleRequest(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.model, process.env.OPENAI_MODEL || 'gpt-5.4-mini');
  assert.equal(typeof response.payload.hasApiKey, 'boolean');
});

test('exports a Firebase HTTPS function named api', () => {
  assert.equal(typeof api, 'function');
});

test('readJsonBody accepts parsed Firebase Functions request bodies', async () => {
  const parsedBody = {
    question: { id: 'a1-writing-like-food-001' },
    writingAnswer: 'I like apples.',
  };
  const request = Readable.from([]);
  request.body = parsedBody;

  const body = await readJsonBody(request);

  assert.deepEqual(body, parsedBody);
});

test('hotel check-in scenarios ask for check-in details instead of room reservation details', () => {
  const scenario = {
    id: 'a1-hotel-checkin-001',
    maxUserTurns: 5,
  };
  const state = buildConversationState(scenario, [
    { role: 'assistant', content: 'Hello, welcome to our hotel. How can I help you?' },
    { role: 'user', content: 'I have a reservation.' },
  ]);

  assert.equal(state.scenarioType, 'hotelCheckin');
  assert.equal(state.knownDetails.includes('reservation'), true);
  assert.equal(state.missingDetails.includes('room type'), false);
  assert.equal(state.missingDetails.includes('guest count'), false);
  assert.equal(state.nextQuestion, 'May I have your name, please?');
});

test('buildConversationState uses scenario-defined slots before id heuristics', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleKo: '도서관 카드 만들기',
    titleEn: 'Getting a Library Card',
    userGoalKo: '새 도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
    maxUserTurns: 5,
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
  const state = buildConversationState(scenario, [
    { role: 'assistant', content: 'Hello. How can I help you today?' },
    { role: 'user', content: 'I need a library card, please.' },
  ]);

  assert.equal(state.scenarioType, 'a1-library-card-001');
  assert.deepEqual(state.knownDetails, ['library card request']);
  assert.deepEqual(state.missingDetails, ['visitor name']);
  assert.equal(state.nextQuestion, 'May I have your name, please?');
  assert.deepEqual(state.successCriteria, [
    'Say that a library card is needed.',
    'Provide a name for the card.',
  ]);
  assert.equal(state.repairPolicy.koreanOnly, 'Please try saying that in English.');
  assert.equal(state.requiredSlots[0].key, 'cardType');
  assert.equal(state.canComplete, false);
});

test('actor output is forced to end when the conversation reaches the max user turns', () => {
  const scenario = {
    id: 'a1-cafe-order-001',
    maxUserTurns: 5,
  };
  const conversationState = buildConversationState(scenario, [
    { role: 'user', content: 'I want coffee.' },
  ]);
  const output = normalizeActorOutput(
    {
      message: 'Sure. What size would you like?',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: false,
      endReason: null,
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    [{ role: 'assistant', content: 'Hi, what would you like to order?' }],
    scenario,
    {
      userTurnCount: 5,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(output.shouldEndSession, true);
  assert.equal(output.endReason, 'max_turns');
});

test('actor output is forced to end when scenario-defined slots are complete', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleKo: '도서관 카드 만들기',
    titleEn: 'Getting a Library Card',
    userGoalKo: '새 도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
    maxUserTurns: 5,
    completionMessage: 'Great. I can make a new library card for you.',
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
  const messages = [
    { role: 'assistant', content: 'Hello. How can I help you today?' },
    { role: 'user', content: 'I need a library card, please.' },
    { role: 'assistant', content: 'May I have your name, please?' },
  ];
  const conversationState = buildConversationState(scenario, [
    ...messages,
    { role: 'user', content: 'My name is Mina Park.' },
  ]);
  const output = normalizeActorOutput(
    {
      message: 'Anything else?',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: false,
      endReason: null,
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    messages,
    scenario,
    {
      userTurnCount: 2,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(conversationState.canComplete, true);
  assert.equal(output.shouldEndSession, true);
  assert.equal(output.endReason, 'goal_completed');
  assert.equal(output.message, 'Great. I can make a new library card for you.');
});

test('actor output cannot end a scenario-defined slot flow while required slots are missing', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleKo: '도서관 카드 만들기',
    titleEn: 'Getting a Library Card',
    userGoalKo: '새 도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
    maxUserTurns: 5,
    completionMessage: 'Great. I can make a new library card for you.',
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
  const messages = [
    { role: 'assistant', content: 'Hello. How can I help you today?' },
    { role: 'user', content: 'I need a library card, please.' },
  ];
  const conversationState = buildConversationState(scenario, messages);
  const output = normalizeActorOutput(
    {
      message: 'Great, that is enough for this practice.',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: true,
      endReason: 'goal_completed',
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    messages,
    scenario,
    {
      userTurnCount: 1,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(conversationState.canComplete, false);
  assert.deepEqual(conversationState.missingDetails, ['visitor name']);
  assert.equal(output.shouldEndSession, false);
  assert.equal(output.endReason, null);
  assert.equal(output.message, 'May I have your name, please?');
});

test('restaurant order phrases with arbitrary food names complete the request slot', () => {
  const scenario = {
    id: 'a2-restaurant-request-001',
    maxUserTurns: 5,
    completionMessage: "Of course. I'll bring that right away.",
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
  const messages = [
    {
      role: 'assistant',
      content: 'Hello. Are you ready to order, or do you need anything?',
    },
  ];
  const conversationState = buildConversationState(scenario, [
    ...messages,
    { role: 'user', content: "I'd like a sundubu jjigae please." },
  ]);
  const output = normalizeActorOutput(
    {
      message: 'What would you like me to bring?',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: false,
      endReason: null,
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    messages,
    scenario,
    {
      userTurnCount: 1,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.deepEqual(conversationState.missingDetails, []);
  assert.equal(conversationState.canComplete, true);
  assert.equal(output.shouldEndSession, true);
  assert.equal(output.endReason, 'goal_completed');
  assert.equal(output.message, "Of course. I'll bring that right away.");
});

test('restaurant order phrases without an item do not complete the request slot', () => {
  const scenario = {
    id: 'a2-restaurant-request-001',
    maxUserTurns: 5,
    completionMessage: "Of course. I'll bring that right away.",
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
  const conversationState = buildConversationState(scenario, [
    { role: 'assistant', content: 'Hello. Are you ready to order?' },
    { role: 'user', content: 'Could I have please?' },
  ]);

  assert.deepEqual(conversationState.knownDetails, ['polite request']);
  assert.deepEqual(conversationState.missingDetails, ['restaurant request']);
  assert.equal(conversationState.canComplete, false);
  assert.equal(conversationState.nextQuestion, 'What would you like me to bring?');
});

test('restaurant request object is scoped to the same utterance as the request phrase', () => {
  const scenario = {
    id: 'a2-restaurant-request-001',
    maxUserTurns: 5,
    completionMessage: "Of course. I'll bring that right away.",
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
  const conversationState = buildConversationState(scenario, [
    { role: 'assistant', content: 'Hello. Are you ready to order?' },
    { role: 'user', content: 'Hello.' },
    { role: 'assistant', content: 'What would you like me to bring?' },
    { role: 'user', content: 'Could I have please?' },
  ]);

  assert.deepEqual(conversationState.knownDetails, ['polite request']);
  assert.deepEqual(conversationState.missingDetails, ['restaurant request']);
  assert.equal(conversationState.canComplete, false);
});

test('actor output preserves natural LLM reply while required slots are still missing', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleKo: '도서관 카드 만들기',
    titleEn: 'Getting a Library Card',
    userGoalKo: '도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
    maxUserTurns: 5,
    completionMessage: 'Great. I can make a new library card for you.',
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
  const messages = [
    { role: 'assistant', content: 'Hello. How can I help you today?' },
    { role: 'user', content: 'I need a library card, please.' },
  ];
  const conversationState = buildConversationState(scenario, messages);
  const output = normalizeActorOutput(
    {
      message: 'Sure, I can help with that. May I have your name, please?',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: false,
      endReason: null,
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    messages,
    scenario,
    {
      userTurnCount: 1,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(conversationState.canComplete, false);
  assert.deepEqual(conversationState.missingDetails, ['visitor name']);
  assert.equal(
    output.message,
    'Sure, I can help with that. May I have your name, please?',
  );
  assert.equal(output.shouldEndSession, false);
  assert.equal(output.endReason, null);
});

test('actor output falls back when the model returns a blank reply', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleKo: '도서관 카드 만들기',
    titleEn: 'Getting a Library Card',
    userGoalKo: '도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
    maxUserTurns: 5,
    completionMessage: 'Great. I can make a new library card for you.',
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
  const messages = [
    { role: 'assistant', content: 'Hello. How can I help you today?' },
    { role: 'user', content: 'I need a library card, please.' },
  ];
  const conversationState = buildConversationState(scenario, messages);
  const output = normalizeActorOutput(
    {
      message: '   ',
      isUserUnderstandable: true,
      isUserRelevant: true,
      shouldEndSession: false,
      endReason: null,
      detectedIssueTags: [],
      correctedSentence: null,
      shortReasonKo: null,
    },
    conversationState,
    messages,
    scenario,
    {
      userTurnCount: 1,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(output.message, 'May I have your name, please?');
  assert.equal(output.shouldEndSession, false);
  assert.equal(output.endReason, null);
});

test('actor output drops placeholder corrected sentences', () => {
  const scenario = {
    id: 'a1-cafe-order-001',
    titleKo: '카페에서 음료 주문하기',
    titleEn: 'Ordering at a Cafe',
    userGoalKo: '원하는 음료, 크기, 포장 여부를 말하고 주문을 완료하세요.',
    maxUserTurns: 5,
    targetExpressions: ["I'd like ..."],
  };
  const conversationState = buildConversationState(scenario, [
    { role: 'user', content: 'I want coffee.' },
  ]);
  const output = normalizeActorOutput(
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
    conversationState,
    [{ role: 'assistant', content: 'Hi, what would you like to order?' }],
    scenario,
    {
      userTurnCount: 1,
      failureCount: 0,
      maxUserTurns: 5,
    },
  );

  assert.equal(output.correctedSentence, null);
});

test('server conversation engine matches shared fixture', () => {
  const fixture = JSON.parse(readFileSync(conversationEngineFixtureUrl, 'utf8'));

  for (const fixtureCase of fixture.cases) {
    let state = createInitialConversationEngineState(fixture.scenario);

    for (const turn of fixtureCase.turns) {
      const response = runConversationEngineTurn({
        scenario: fixture.scenario,
        previousMessages: [],
        state,
        userMessage: turn.userMessage,
      });

      assert.equal(
        response.engineState.endReason,
        turn.expectedEndReason,
        `${fixtureCase.name}: ${turn.userMessage} endReason`,
      );
      assert.equal(
        response.engineState.pendingSlotKey,
        turn.expectedPendingSlotKey,
        `${fixtureCase.name}: ${turn.userMessage} pendingSlotKey`,
      );
      state = response.engineState;
    }
  }
});

test('server engine resets counters after progress', () => {
  const scenario = getPharmacyFixtureScenario();
  const firstTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I need help.',
  });
  const secondTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: firstTurn.engineState,
    userMessage: "I'm feeling stomachache.",
  });

  assert.equal(secondTurn.engineState.noProgressCount, 0);
  assert.equal(secondTurn.engineState.repeatedPromptCount, 0);
  assert.equal(secondTurn.engineState.pendingSlotKey, 'medicineQuestion');
});

test('server engine moves past an understandable passport handoff mistake instead of looping', () => {
  const scenario = {
    id: 'a2-airport-checkin-001',
    titleEn: 'Airport Check-In',
    aiRole: 'Airline check-in staff',
    userRole: 'Passenger',
    maxUserTurns: 5,
    targetExpressions: ['Here is my passport.', 'I have one bag.', 'Could I have a window seat?'],
    successCriteria: [
      'Respond to the passport request.',
      'Say the destination or flight context.',
    ],
    completionMessage: 'Great. Here is your boarding pass. Boarding starts at gate 12.',
    repairPolicy: {
      unclear: 'Sorry, could you say that again in English?',
      offTopic: 'Let us come back to this situation. What do you need?',
      correction: 'No problem. Thanks for correcting that.',
      koreanOnly: 'Please try saying that in English.',
    },
    requiredSlots: [
      {
        key: 'passport',
        label: 'passport',
        prompt: 'May I see your passport, please?',
        matchKeywords: ['passport', 'here it is', 'here you go'],
      },
      {
        key: 'destination',
        label: 'destination',
        prompt: 'Where are you flying today?',
        matchKeywords: ['seoul', 'tokyo'],
      },
    ],
  };
  const state = {
    ...createInitialConversationEngineState(scenario),
    repeatedPromptCount: 1,
    noProgressCount: 1,
  };
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state,
    userMessage: 'of course, here is this',
  });

  assert.equal(response.shouldEndSession, false);
  assert.equal(response.engineState.pendingSlotKey, 'destination');
  assert.deepEqual(response.engineState.skippedSlotKeys, ['passport']);
  assert.equal(response.message.content, 'Where are you flying today?');
  assert.equal(response.message.content.includes('One simple answer'), false);
});

test('server engine accepts accident as a change-plans reason', () => {
  const scenario = {
    id: 'a2-change-plans-001',
    titleEn: 'Changing Plans',
    aiRole: 'Friend',
    userRole: 'Friend',
    maxUserTurns: 5,
    targetExpressions: ['Can we meet later?', 'I have to ...', 'How about ...?'],
    successCriteria: [
      'Say that the plan needs to change.',
      'Give a short reason.',
      'Suggest a new time.',
    ],
    completionMessage: "No problem. Let's change it to that time.",
    repairPolicy: {
      unclear: 'Sorry, could you say that again in English?',
      offTopic: 'Let us come back to this situation. What do you need?',
      correction: 'No problem. Thanks for correcting that.',
      koreanOnly: 'Please try saying that in English.',
    },
    requiredSlots: [
      {
        key: 'planChange',
        label: 'plan change request',
        prompt: 'Do you need to change our plan?',
        matchKeywords: ['change', 'meet later', 'reschedule', 'can we meet', 'another time', 'plan'],
      },
      {
        key: 'reason',
        label: 'reason for changing plans',
        prompt: 'Why do you need to change it?',
        matchKeywords: ['busy', 'late', 'work', 'school', 'sick', 'traffic', 'appointment'],
      },
      {
        key: 'newTime',
        label: 'new time',
        prompt: 'What new time works for you?',
        matchKeywords: ['later', 'tomorrow', 'today', 'at 4', 'at 5'],
      },
    ],
  };
  const first = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: "I'm sorry, Could we change our meeting time at 4?",
  });
  const second = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: first.engineState,
    userMessage: 'I have an accident suddenly. so we have to change our meeting time.',
  });

  assert.deepEqual(first.engineState.filledSlotKeys, ['planChange', 'newTime']);
  assert.equal(first.engineState.pendingSlotKey, 'reason');
  assert.equal(second.endReason, 'goal_completed');
  assert.equal(second.engineState.filledSlotKeys.includes('reason'), true);
  assert.equal(second.message.content, scenario.completionMessage);
});

test('server engine uses natural retry examples for every hosted scenario slot', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/conversation-scenarios/manifest.json', import.meta.url), 'utf8'),
  );

  for (const entry of manifest.packs) {
    const pack = JSON.parse(
      readFileSync(new URL(`../public/conversation-scenarios/${entry.path}`, import.meta.url), 'utf8'),
    );

    for (const scenario of pack.scenarios) {
      for (const slot of scenario.requiredSlots) {
        const response = runConversationEngineTurn({
          scenario,
          previousMessages: [],
          state: {
            ...createInitialConversationEngineState(scenario),
            filledSlotKeys: scenario.requiredSlots
              .filter((candidate) => candidate.key !== slot.key)
              .map((candidate) => candidate.key),
            pendingSlotKey: slot.key,
            repeatedPromptCount: 1,
            noProgressCount: 1,
            userTurnCount: 1,
          },
          userMessage: 'I need help.',
        });
        const context = `${scenario.id}:${slot.key}`;

        assert.equal(
          /"I need /.test(response.message.content),
          false,
          `${context}: ${response.message.content}`,
        );
        assert.equal(
          /\b(undefined|null)\b/i.test(response.message.content),
          false,
          `${context}: ${response.message.content}`,
        );
      }
    }
  }
});

test('server engine repairs off-topic turns before ending after repeated failures', () => {
  const scenario = getPharmacyFixtureScenario();
  const first = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I like soccer.',
  });
  const second = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: first.engineState,
    userMessage: 'I still like soccer.',
  });
  const third = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: second.engineState,
    userMessage: 'soccer again',
  });

  assert.equal(first.shouldEndSession, false);
  assert.equal(first.engineState.offTopicCount, 1);
  assert.equal(first.endReason, null);
  assert.equal(first.message.content, scenario.repairPolicy.offTopic);
  assert.equal(second.shouldEndSession, false);
  assert.equal(second.engineState.offTopicCount, 2);
  assert.equal(second.endReason, null);
  assert.equal(second.message.content, scenario.repairPolicy.offTopic);
  assert.equal(third.shouldEndSession, true);
  assert.equal(third.engineState.offTopicCount, 3);
  assert.equal(third.endReason, 'too_many_failures');
});

test('server engine counts mixed unclear and off-topic failures toward one terminal threshold', () => {
  const scenario = getPharmacyFixtureScenario();
  const unclear = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: '???',
  });
  const offTopic = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: unclear.engineState,
    userMessage: 'I want to buy a computer.',
  });
  const terminal = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: offTopic.engineState,
    userMessage: 'random computer again',
  });

  assert.equal(unclear.shouldEndSession, false);
  assert.equal(offTopic.shouldEndSession, false);
  assert.equal(terminal.shouldEndSession, true);
  assert.equal(terminal.endReason, 'too_many_failures');
  assert.equal(terminal.message.content.includes('One simple answer'), false);
  assert.equal(terminal.message.content.includes('Try saying'), false);
});

test('server interpreter normalization allowlists slot keys and rejects low confidence fills', () => {
  const scenario = getPharmacyFixtureScenario();
  const interpretation = normalizeInterpreterOutput(
    {
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'progress',
      filledSlotKeys: ['symptom', 'nonexistentSlot'],
      confidence: 0.4,
    },
    scenario,
  );

  assert.deepEqual(interpretation.filledSlotKeys, []);
  assert.equal(interpretation.turnType, 'no_progress');
});

test('server engine cannot complete from low confidence filled slots', () => {
  const scenario = getPharmacyFixtureScenario();
  const interpretation = normalizeInterpreterOutput(
    {
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'progress',
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      confidence: 0.4,
    },
    scenario,
  );
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I have a stomachache. Do you have any medicine?',
    interpretation,
  });

  assert.equal(response.endReason, null);
  assert.deepEqual(response.engineState.skippedSlotKeys, ['symptom']);
  assert.equal(response.engineState.pendingSlotKey, 'medicineQuestion');
});

test('server engine rejects unclear progress slot fills', () => {
  const scenario = getPharmacyFixtureScenario();
  const interpretation = normalizeInterpreterOutput(
    {
      isUnderstandable: false,
      isOnTopic: true,
      turnType: 'progress',
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      confidence: 0.9,
    },
    scenario,
  );
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'garbled',
    interpretation,
  });

  assert.equal(interpretation.turnType, 'unclear');
  assert.deepEqual(interpretation.filledSlotKeys, []);
  assert.equal(response.shouldEndSession, false);
  assert.equal(response.endReason, null);
  assert.equal(response.engineState.pendingSlotKey, 'symptom');
});

test('server engine rejects off-topic progress slot fills', () => {
  const scenario = getPharmacyFixtureScenario();
  const interpretation = normalizeInterpreterOutput(
    {
      isUnderstandable: true,
      isOnTopic: false,
      turnType: 'progress',
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      confidence: 0.9,
    },
    scenario,
  );
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I like soccer.',
    interpretation,
  });

  assert.equal(interpretation.turnType, 'off_topic');
  assert.deepEqual(interpretation.filledSlotKeys, []);
  assert.equal(response.shouldEndSession, false);
  assert.equal(response.endReason, null);
  assert.equal(response.engineState.pendingSlotKey, 'symptom');
});

test('server engine keeps an already completed state completed', () => {
  const scenario = getPharmacyFixtureScenario();
  const completedState = normalizeConversationEngineState(
    {
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      pendingSlotKey: 'symptom',
      status: 'active',
      endReason: null,
    },
    scenario,
  );
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: completedState,
    userMessage: 'I like soccer.',
    interpretation: {
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'no_progress',
      filledSlotKeys: [],
      confidence: 0.9,
    },
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'goal_completed');
  assert.equal(response.engineState.status, 'completed');
});

test('server engine preserves terminal ended states', () => {
  const scenario = getPharmacyFixtureScenario();
  const terminalState = {
    ...createInitialConversationEngineState(scenario),
    status: 'ended',
    endReason: 'no_progress',
  };
  const response = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: terminalState,
    userMessage: "I'm feeling stomachache.",
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'no_progress');
  assert.equal(response.engineState.status, 'ended');
  assert.equal(response.message.content, "Let's stop here and review this situation together.");
});

test('server engine skips no-progress slots without retry examples', () => {
  const scenario = getPharmacyFixtureScenario();
  const firstTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I need help.',
  });
  const secondTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: firstTurn.engineState,
    userMessage: 'Can you help me?',
  });

  assert.equal(firstTurn.engineState.pendingSlotKey, 'medicineQuestion');
  assert.deepEqual(firstTurn.engineState.skippedSlotKeys, ['symptom']);
  assert.equal(firstTurn.message.content, 'Do you need medicine, or do you have a question about how to take it?');
  assert.equal(secondTurn.endReason, 'no_progress');
  assert.equal(secondTurn.message.content, "Let's stop here and review this situation together.");
});

test('server engine treats malformed progress without valid new slots as no progress for counters', () => {
  const scenario = getPharmacyFixtureScenario();

  for (const filledSlotKeys of [[], ['nonexistentSlot']]) {
    const response = runConversationEngineTurn({
      scenario,
      previousMessages: [],
      state: {
        ...createInitialConversationEngineState(scenario),
        noProgressCount: 1,
        repeatedPromptCount: 1,
      },
      userMessage: 'I am making progress.',
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys,
        confidence: 0.9,
      },
    });

    assert.equal(response.engineState.lastTurnType, 'no_progress');
    assert.equal(response.engineState.noProgressCount, 2);
    assert.equal(response.engineState.repeatedPromptCount, 0);
    assert.deepEqual(response.engineState.skippedSlotKeys, ['symptom']);
    assert.equal(response.engineState.pendingSlotKey, 'medicineQuestion');
  }
});

test('server engine bootstraps state from user messages with fallback matching', () => {
  const scenario = getPharmacyFixtureScenario();
  const state = bootstrapConversationEngineState(
    scenario,
    [
      { role: 'assistant', content: 'Hello. How can I help you today?' },
      { role: 'user', content: "I'm feeling stomachache." },
      { role: 'assistant', content: 'Do you need medicine?' },
    ],
    2,
  );

  assert.deepEqual(state.filledSlotKeys, ['symptom']);
  assert.equal(state.pendingSlotKey, 'medicineQuestion');
  assert.equal(state.userTurnCount, 1);
  assert.equal(state.unclearCount, 2);
  assert.equal(state.offTopicCount, 0);
  assert.equal(state.noProgressCount, 0);
  assert.equal(state.repeatedPromptCount, 0);
});

test('respond normalization ignores legacy failureCount when engineState is present', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'I like soccer.',
    messages: [],
    failureCount: 0,
    engineState: {
      ...createInitialConversationEngineState(scenario),
      offTopicCount: 2,
      noProgressCount: 2,
      repeatedPromptCount: 2,
    },
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: false,
        turnType: 'off_topic',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: ['task_completion'],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'too_many_failures');
  assert.equal(response.engineState.offTopicCount, 3);
});

test('respond normalization returns the app-facing API response shape', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: "I'm feeling stomachache.",
    messages: [],
    failureCount: 0,
    engineState: createInitialConversationEngineState(scenario),
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys: ['symptom'],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(typeof response.message, 'string');
  assert.notEqual(typeof response.message, 'object');
  assert.equal(typeof response.isUserUnderstandable, 'boolean');
  assert.equal(typeof response.isUserRelevant, 'boolean');
  assert.equal(Array.isArray(response.detectedIssueTags), true);
  assert.equal(Boolean(response.engineState), true);
});

test('respond normalization accepts a bare guest name after the hotel name prompt', () => {
  const scenario = {
    id: 'a1-hotel-checkin-001',
    titleEn: 'Checking In at a Hotel',
    userGoalKo: 'Say your name, confirm your reservation, and complete check-in.',
    maxUserTurns: 5,
    openingMessage: 'Hello, welcome to our hotel. How can I help you?',
    completionMessage: "Perfect. You're checked in. Here is your room key.",
    repairPolicy: {
      unclear: 'Sorry, could you say that again in English?',
      offTopic: 'Let us come back to this situation. What do you need?',
      correction: 'No problem. Thanks for correcting that.',
      koreanOnly: 'Please try saying that in English.',
    },
    successCriteria: [
      'Say that you have a reservation.',
      'Provide the reservation name.',
      'Respond to the ID or passport request.',
    ],
    requiredSlots: [
      {
        key: 'reservation',
        label: 'reservation',
        prompt: 'Do you have a reservation?',
        matchKeywords: ['reservation', 'booking', 'booked', 'check in', 'check-in', 'i have a room'],
      },
      {
        key: 'name',
        label: 'guest name',
        prompt: 'May I have your name, please?',
        matchKeywords: ['my name is', 'i am', "i'm", 'this is', 'under', 'name is'],
      },
      {
        key: 'id',
        label: 'id or passport',
        prompt: 'May I see your ID or passport?',
        matchKeywords: ['id', 'passport', 'here it is', 'here you go'],
      },
    ],
  };
  const reservationTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I have a reservation. Could you check it?',
  });
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'lee hee woung',
    messages: [
      { role: 'assistant', content: scenario.openingMessage },
      { role: 'user', content: 'I have a reservation. Could you check it?' },
      { role: 'assistant', content: 'May I have your name, please?' },
    ],
    failureCount: 0,
    engineState: reservationTurn.engineState,
    interpreterOutput: {
      interpretation: {
        isUnderstandable: false,
        isOnTopic: true,
        turnType: 'unclear',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: ['clarification'],
        shortReasonKo: 'Looks like a name, but spelling is uncertain.',
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.isUserUnderstandable, true);
  assert.equal(response.isUserRelevant, true);
  assert.equal(response.shortReasonKo, null);
  assert.deepEqual(response.engineState.filledSlotKeys, ['reservation', 'name']);
  assert.equal(response.engineState.pendingSlotKey, 'id');
  assert.equal(response.message, 'May I see your ID or passport?');
});

test('server engine accepts short document handoff answers after the hotel ID prompt', () => {
  const scenario = {
    id: 'a1-hotel-checkin-001',
    titleEn: 'Checking In at a Hotel',
    userGoalKo: 'Say your name, confirm your reservation, and complete check-in.',
    maxUserTurns: 5,
    openingMessage: 'Hello, welcome to our hotel. How can I help you?',
    completionMessage: "Perfect. You're checked in. Here is your room key.",
    repairPolicy: {
      unclear: 'Sorry, could you say that again in English?',
      offTopic: 'Let us come back to this situation. What do you need?',
      correction: 'No problem. Thanks for correcting that.',
      koreanOnly: 'Please try saying that in English.',
    },
    successCriteria: [
      'Say that you have a reservation.',
      'Provide the reservation name.',
      'Respond to the ID or passport request.',
    ],
    requiredSlots: [
      {
        key: 'reservation',
        label: 'reservation',
        prompt: 'Do you have a reservation?',
        matchKeywords: ['reservation', 'booking', 'booked', 'check in', 'check-in', 'i have a room'],
      },
      {
        key: 'name',
        label: 'guest name',
        prompt: 'May I have your name, please?',
        matchKeywords: ['my name is', 'i am', "i'm", 'this is', 'under', 'name is'],
      },
      {
        key: 'id',
        label: 'id or passport',
        prompt: 'May I see your ID or passport?',
        matchKeywords: ['id', 'passport', 'here it is', 'here you go'],
      },
    ],
  };
  const reservationTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I have a reservation. Could you check it?',
  });
  const nameTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: reservationTurn.engineState,
    userMessage: 'my name is hee woung',
  });

  for (const userMessage of ['yes, here is', 'of course']) {
    const response = createConversationResponseFromInterpretation({
      scenario,
      userMessage,
      messages: [
        { role: 'assistant', content: scenario.openingMessage },
        { role: 'user', content: 'I have a reservation. Could you check it?' },
        { role: 'assistant', content: 'May I have your name, please?' },
        { role: 'user', content: 'my name is hee woung' },
        { role: 'assistant', content: 'May I see your ID or passport?' },
      ],
      failureCount: 0,
      engineState: nameTurn.engineState,
      interpreterOutput: {
        interpretation: {
          isUnderstandable: true,
          isOnTopic: false,
          turnType: 'off_topic',
          filledSlotKeys: [],
          correctedSentence: null,
          detectedIssueTags: ['task_completion'],
          shortReasonKo: '상황과 다른 답변이에요.',
          confidence: 0.7,
        },
      },
    });

    assert.equal(response.isUserUnderstandable, true, userMessage);
    assert.equal(response.isUserRelevant, true, userMessage);
    assert.deepEqual(response.engineState.filledSlotKeys, ['reservation', 'name', 'id'], userMessage);
    assert.equal(response.endReason, 'goal_completed', userMessage);
    assert.equal(response.message, scenario.completionMessage, userMessage);
  }
});

test('respond normalization does not treat common non-name phrases as a guest name', () => {
  const scenario = {
    id: 'a1-hotel-checkin-001',
    titleEn: 'Checking In at a Hotel',
    userGoalKo: 'Say your name, confirm your reservation, and complete check-in.',
    maxUserTurns: 5,
    openingMessage: 'Hello, welcome to our hotel. How can I help you?',
    completionMessage: "Perfect. You're checked in. Here is your room key.",
    repairPolicy: {
      unclear: 'Sorry, could you say that again in English?',
      offTopic: 'Let us come back to this situation. What do you need?',
      correction: 'No problem. Thanks for correcting that.',
      koreanOnly: 'Please try saying that in English.',
    },
    successCriteria: [
      'Say that you have a reservation.',
      'Provide the reservation name.',
      'Respond to the ID or passport request.',
    ],
    requiredSlots: [
      {
        key: 'reservation',
        label: 'reservation',
        prompt: 'Do you have a reservation?',
        matchKeywords: ['reservation', 'booking', 'booked', 'check in', 'check-in', 'i have a room'],
      },
      {
        key: 'name',
        label: 'guest name',
        prompt: 'May I have your name, please?',
        matchKeywords: ['my name is', 'i am', "i'm", 'this is', 'under', 'name is'],
      },
      {
        key: 'id',
        label: 'id or passport',
        prompt: 'May I see your ID or passport?',
        matchKeywords: ['id', 'passport', 'here it is', 'here you go'],
      },
    ],
  };
  const reservationTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I have a reservation. Could you check it?',
  });

  for (const userMessage of ['one moment', 'credit card', 'late checkout']) {
    const response = createConversationResponseFromInterpretation({
      scenario,
      userMessage,
      messages: [
        { role: 'assistant', content: scenario.openingMessage },
        { role: 'user', content: 'I have a reservation. Could you check it?' },
        { role: 'assistant', content: 'May I have your name, please?' },
      ],
      failureCount: 0,
      engineState: reservationTurn.engineState,
      interpreterOutput: {
        interpretation: {
          isUnderstandable: false,
          isOnTopic: true,
          turnType: 'unclear',
          filledSlotKeys: [],
          correctedSentence: null,
          detectedIssueTags: ['clarification'],
          shortReasonKo: 'This is not a guest name.',
          confidence: 0.9,
        },
      },
    });

    assert.equal(response.isUserUnderstandable, false, userMessage);
    assert.equal(response.engineState.filledSlotKeys.includes('name'), false, userMessage);
    assert.equal(response.engineState.pendingSlotKey, 'name', userMessage);
    assert.equal(response.shouldEndSession, false, userMessage);
    assert.equal(response.endReason, null, userMessage);
    assert.equal(response.message, scenario.repairPolicy.unclear, userMessage);
  }
});

test('respond normalization accepts a bare name for a non-hotel name slot', () => {
  const scenario = {
    id: 'a1-library-card-001',
    titleEn: 'Getting a Library Card',
    userGoalKo: 'Say that you need a library card and provide your name.',
    maxUserTurns: 5,
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
  const cardTurn = runConversationEngineTurn({
    scenario,
    previousMessages: [],
    state: createInitialConversationEngineState(scenario),
    userMessage: 'I need a library card, please.',
  });
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'mina park',
    messages: [
      { role: 'assistant', content: scenario.openingMessage },
      { role: 'user', content: 'I need a library card, please.' },
      { role: 'assistant', content: 'May I have your name, please?' },
    ],
    failureCount: 0,
    engineState: cardTurn.engineState,
    interpreterOutput: {
      interpretation: {
        isUnderstandable: false,
        isOnTopic: true,
        turnType: 'unclear',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: ['clarification'],
        shortReasonKo: 'Looks like a name, but spelling is uncertain.',
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.isUserUnderstandable, true);
  assert.equal(response.endReason, 'goal_completed');
  assert.deepEqual(response.engineState.filledSlotKeys, ['cardType', 'name']);
});

test('server evaluation caps no_progress endings and reports the first missing slot', () => {
  const scenario = getPharmacyFixtureScenario();
  const result = normalizeEvaluation(createHighEvaluation(), {
    scenario,
    engineState: {
      ...createInitialConversationEngineState(scenario),
      endReason: 'no_progress',
    },
    endReason: 'no_progress',
  });

  assert.equal(result.categoryScores.taskCompletion, 6);
  assert.equal(result.categoryScores.clarity, 18);
  assert.equal(result.totalScore, 69);
  assert.equal(
    result.weaknessesKo.includes('아직 완료하지 못한 목표: symptom'),
    true,
  );
});

test('server writing normalization accepts Korean answers for translation questions', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 90,
      isCorrect: true,
      correctedAnswer: '버스는 9시에 도착합니다.',
      feedbackKo: '핵심 의미를 정확히 옮겼습니다.',
      weakAreaKo: '',
    },
    {
      id: 'a1-reading-translation-bus-001',
      level: 'A1',
      area: 'reading',
      promptKo: '영어 문장을 읽고 한글로 번역하세요.',
      questionText: 'The bus arrives at nine.',
      answerLanguage: 'ko',
      sampleAnswer: '버스는 9시에 도착합니다.',
      evaluationFocusKo: '핵심 의미를 한글로 옮기는지 평가합니다.',
      expectedKeywordsKo: ['버스', '9시', '도착'],
    },
    '버스가 아홉 시에 도착합니다.',
  );

  assert.equal(result.score, 90);
  assert.equal(result.isCorrect, true);
});

test('server writing normalization still rejects Korean-only answers for English writing questions', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 90,
      isCorrect: true,
      correctedAnswer: 'I like apples.',
      feedbackKo: '좋습니다.',
      weakAreaKo: '',
    },
    {
      id: 'a1-writing-like-food-001',
      level: 'A1',
      area: 'conversation',
      promptKo: '좋아하는 음식을 영어 한 문장으로 쓰세요.',
      sampleAnswer: 'I like apples.',
      evaluationFocusKo: 'I like ... 문장 구조',
    },
    '나는 사과를 좋아합니다.',
  );

  assert.equal(result.isCorrect, false);
});

test('server writing normalization cleans high-score correct English writing feedback', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 95,
      isCorrect: true,
      correctedAnswer: 'I like sushi.',
      feedbackKo: 'Good, but try more food words.',
      weakAreaKo: 'No real weakness.',
    },
    {
      id: 'a1-writing-like-food-001',
      level: 'A1',
      area: 'conversation',
      promptKo: '\uC88B\uC544\uD558\uB294 \uC74C\uC2DD\uC744 \uC601\uC5B4 \uD55C \uBB38\uC7A5\uC73C\uB85C \uC4F0\uC138\uC694.',
      sampleAnswer: 'I like apples.',
      evaluationFocusKo: 'I like ... sentence structure',
      expectedKeywords: ['i', 'like'],
    },
    'I like sushi.',
  );

  assert.equal(result.score, 100);
  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, 'I like sushi.');
  assert.match(result.feedbackKo, /\uC798 \uC0AC\uC6A9/);
  assert.equal(result.weakAreaKo, '');
});

test('server writing normalization accepts clear friend introductions even when the model dislikes tone', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 20,
      isCorrect: false,
      correctedAnswer: 'This is my friend Mina.',
      feedbackKo: '\uB0B4\uC6A9\uC774 \uBD80\uC815\uC801\uC785\uB2C8\uB2E4.',
      weakAreaKo: '\uD45C\uD604\uC758 \uC5B4\uAC10',
    },
    {
      id: 'a1-writing-introduce-friend-002',
      level: 'A1',
      area: 'conversation',
      promptKo: '\uCE5C\uAD6C\uB97C \uD55C \uBB38\uC7A5\uC73C\uB85C \uC18C\uAC1C\uD574 \uBCF4\uC138\uC694.',
      sampleAnswer: 'This is my friend Mina.',
      evaluationFocusKo: 'This is ... structure and friend introduction expression',
      expectedKeywords: ['friend'],
    },
    'My friend is stupid.',
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, 'My friend is stupid.');
  assert.ok(result.score >= 75);
});

test('server writing normalization accepts natural weekend-plan questions with alternate wording', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 31,
      isCorrect: false,
      correctedAnswer: 'What are you planning to do this weekend?',
      feedbackKo: 'Try a more specific answer.',
      weakAreaKo: 'asking about plans',
    },
    {
      id: 'b1-extra-conversation-writing-001',
      level: 'B1',
      area: 'conversation',
      promptKo: '\uCE5C\uAD6C\uC5D0\uAC8C \uC8FC\uB9D0 \uACC4\uD68D\uC744 \uBB3B\uB294 \uBB38\uC7A5\uC744 \uC601\uC5B4\uB85C \uC4F0\uC138\uC694.',
      sampleAnswer: 'What are you planning to do this weekend?',
      evaluationFocusKo: 'Ask about weekend plans with a natural question.',
      expectedKeywords: ['what', 'planning', 'weekend'],
    },
    'Do you have a plan this weekend?',
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, 'Do you have a plan this weekend?');
  assert.ok(result.score >= 75);
});

test('server writing normalization accepts natural mood expressions with alternate wording', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 38,
      isCorrect: false,
      correctedAnswer: 'I am happy today.',
      feedbackKo: 'Use I am ... today.',
      weakAreaKo: 'emotion expression',
    },
    {
      id: 'a1-writing-feeling-001',
      level: 'A1',
      area: 'conversation',
      promptKo: '\uB2E4\uC74C \uBB38\uC7A5\uC744 \uC601\uC5B4\uB85C \uC4F0\uC138\uC694: \uC800\uB294 \uC624\uB298 \uAE30\uBD84\uC774 \uC88B\uC2B5\uB2C8\uB2E4.',
      sampleAnswer: 'I am happy today.',
      evaluationFocusKo: 'I am ... today emotion expression',
      expectedKeywords: ['i', 'am', 'today'],
    },
    "I'm feeling good today.",
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, "I'm feeling good today.");
  assert.equal(result.weakAreaKo, '');
  assert.ok(result.score >= 90);
});

test('server writing normalization accepts contracted do not answers for negative preferences', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 48,
      isCorrect: false,
      correctedAnswer: 'I do not like coffee.',
      feedbackKo: 'Use do not for a negative sentence.',
      weakAreaKo: 'negative expression',
    },
    {
      id: 'a1-double-conversation-writing-004',
      level: 'A1',
      area: 'conversation',
      promptKo: '\uB2E4\uC74C \uBB38\uC7A5\uC744 \uC601\uC5B4\uB85C \uC4F0\uC138\uC694: \uC800\uB294 \uCEE4\uD53C\uB97C \uC88B\uC544\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
      sampleAnswer: 'I do not like coffee.',
      evaluationFocusKo: '\uBD80\uC815 \uD45C\uD604 \uD45C\uD604\uC744 \uC815\uD655\uD558\uACE0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC0AC\uC6A9\uD588\uB294\uC9C0 \uD3C9\uAC00\uD569\uB2C8\uB2E4.',
      expectedKeywords: ['not', 'like', 'coffee'],
      weakPointLabel: '\uBD80\uC815 \uD45C\uD604',
    },
    "I don't like a coffee",
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, "I don't like a coffee");
  assert.ok(result.score >= 75);
});

test('server writing normalization accepts polite document-by-tomorrow requests with alternate object wording', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 54,
      isCorrect: false,
      correctedAnswer: 'Could you send me the report by tomorrow?',
      feedbackKo: 'Use the key expression more accurately.',
      weakAreaKo: 'polite request',
    },
    {
      id: 'b1-extra-conversation-writing-002',
      level: 'B1',
      area: 'conversation',
      promptKo: '\uB3D9\uB8CC\uC5D0\uAC8C \uBCF4\uACE0\uC11C\uB97C \uB0B4\uC77C\uAE4C\uC9C0 \uBCF4\uB0B4 \uB2EC\uB77C\uACE0 \uC815\uC911\uD788 \uC694\uCCAD\uD558\uC138\uC694.',
      sampleAnswer: 'Could you send me the report by tomorrow?',
      evaluationFocusKo: 'Could you and by tomorrow polite request.',
      expectedKeywords: ['could you', 'report', 'tomorrow'],
    },
    'Could you send me the document by tomorrow?',
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, 'Could you send me the document by tomorrow?');
  assert.ok(result.score >= 75);
});

test('server writing normalization accepts polite refund questions when the item is omitted', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 40,
      isCorrect: false,
      correctedAnswer: 'Could I get a refund for this item?',
      feedbackKo: 'Try to include the item.',
      weakAreaKo: 'Could I and refund',
    },
    {
      id: 'b1-extra-conversation-writing-005',
      level: 'B1',
      area: 'conversation',
      promptKo: '\uAC00\uAC8C \uC9C1\uC6D0\uC5D0\uAC8C \uD658\uBD88\uC774 \uAC00\uB2A5\uD55C\uC9C0 \uC815\uC911\uD788 \uBB3C\uC5B4\uBCF4\uC138\uC694.',
      sampleAnswer: 'Could I get a refund for this item?',
      evaluationFocusKo: 'Could I and refund polite request.',
      expectedKeywords: ['could i', 'refund', 'item'],
    },
    'Could I have a refund?',
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctedAnswer, 'Could I have a refund?');
  assert.equal(result.weakAreaKo, '');
  assert.ok(result.score >= 75);
});

test('server rejects malformed Korean translation writing questions before model calls', async () => {
  const request = Readable.from([]);
  request.method = 'POST';
  request.url = '/api/writing/evaluate';
  request.headers = { host: 'localhost:3001' };
  request.body = {
    question: {
      id: 'a1-reading-translation-bus-001',
      level: 'A1',
      area: 'reading',
      promptKo: '영어 문장을 읽고 한글로 번역하세요.',
      questionText: 'The bus arrives at nine.',
      answerLanguage: 'ko',
      sampleAnswer: 'The bus arrives at nine.',
      evaluationFocusKo: '핵심 의미를 한글로 옮기는지 평가합니다.',
      expectedKeywordsKo: ['bus', 'nine', 'arrive'],
    },
    answer: '버스가 아홉 시에 도착합니다.',
  };
  const response = createResponse();

  await handleRequest(request, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /timeLimitSeconds|sampleAnswer|expectedKeywordsKo/);
});

test('handleRequest rejects AI requests over the daily client quota before evaluation', async () => {
  const previousClientLimit = process.env.AI_DAILY_CLIENT_CREDITS;
  const previousIpLimit = process.env.AI_DAILY_IP_CREDITS;

  process.env.AI_DAILY_CLIENT_CREDITS = '0';
  process.env.AI_DAILY_IP_CREDITS = '100';

  try {
    const request = Readable.from([]);
    request.method = 'POST';
    request.url = '/api/writing/evaluate';
    request.headers = {
      host: 'localhost:3001',
      'x-english-project-client-id': 'ep-quota-test',
      'x-forwarded-for': '203.0.113.21',
    };

    const response = createResponse();

    await handleRequest(request, response);

    assert.equal(response.statusCode, 429);
    assert.equal(response.payload.error, 'AI_DAILY_LIMIT_REACHED');
    assert.equal(response.payload.operation, 'writing.evaluate');
  } finally {
    if (previousClientLimit === undefined) {
      delete process.env.AI_DAILY_CLIENT_CREDITS;
    } else {
      process.env.AI_DAILY_CLIENT_CREDITS = previousClientLimit;
    }

    if (previousIpLimit === undefined) {
      delete process.env.AI_DAILY_IP_CREDITS;
    } else {
      process.env.AI_DAILY_IP_CREDITS = previousIpLimit;
    }
  }
});

test('server writing normalization rejects high-score Korean translations missing core keywords', () => {
  const result = normalizeWritingEvaluation(
    {
      score: 91,
      isCorrect: true,
      correctedAnswer: '오늘 날씨가 좋습니다.',
      feedbackKo: '좋습니다.',
      weakAreaKo: '',
    },
    {
      id: 'a1-reading-translation-bus-001',
      level: 'A1',
      area: 'reading',
      promptKo: '영어 문장을 읽고 한글로 번역하세요.',
      questionText: 'The bus arrives at nine.',
      answerLanguage: 'ko',
      sampleAnswer: '버스는 9시에 도착합니다.',
      evaluationFocusKo: '핵심 의미를 한글로 옮기는지 평가합니다.',
      expectedKeywordsKo: ['버스', '9시', '도착'],
    },
    '오늘 날씨가 좋습니다.',
  );

  assert.equal(result.score, 91);
  assert.equal(result.isCorrect, false);
});

test('server evaluation caps too_many_failures endings', () => {
  const scenario = getPharmacyFixtureScenario();
  const result = normalizeEvaluation(createHighEvaluation(), {
    scenario,
    engineState: {
      ...createInitialConversationEngineState(scenario),
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      endReason: 'too_many_failures',
    },
    endReason: 'too_many_failures',
  });

  assert.equal(result.categoryScores.taskCompletion, 10);
  assert.equal(result.categoryScores.clarity, 12);
  assert.equal(result.totalScore, 67);
});

test('server evaluation weakness feedback includes missing slot label', () => {
  const scenario = getPharmacyFixtureScenario();
  const result = normalizeEvaluation(createHighEvaluation(), {
    scenario,
    engineState: {
      ...createInitialConversationEngineState(scenario),
      filledSlotKeys: ['symptom'],
      endReason: 'max_turns',
    },
    endReason: 'max_turns',
  });

  assert.equal(
    result.weaknessesKo.includes('아직 완료하지 못한 목표: medicine or dosage question'),
    true,
  );
});

test('respond bootstrap restores only filled slots and user turn count when engineState is missing', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'Do you have any medicine?',
    messages: [
      { role: 'assistant', content: 'Hello. How can I help you today?' },
      { role: 'user', content: "I'm feeling stomachache." },
    ],
    failureCount: 2,
    engineState: null,
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys: ['medicineQuestion'],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.endReason, 'goal_completed');
  assert.equal(response.engineState.offTopicCount, 0);
  assert.equal(response.engineState.noProgressCount, 0);
  assert.equal(response.engineState.repeatedPromptCount, 0);
  assert.equal(response.engineState.userTurnCount, 2);
  assert.deepEqual(response.engineState.filledSlotKeys, ['symptom', 'medicineQuestion']);
});

test('respond normalization does not complete from low confidence LLM slot fills', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'I have a stomachache. Do you have any medicine?',
    messages: [],
    failureCount: 0,
    engineState: createInitialConversationEngineState(scenario),
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'progress',
        filledSlotKeys: ['symptom', 'medicineQuestion'],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.4,
      },
    },
  });

  assert.equal(response.shouldEndSession, false);
  assert.equal(response.endReason, null);
  assert.deepEqual(response.engineState.filledSlotKeys, []);
});

test('respond normalization keeps completed engine state completed', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: 'I like soccer.',
    messages: [],
    failureCount: 0,
    engineState: {
      ...createInitialConversationEngineState(scenario),
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      pendingSlotKey: null,
      status: 'completed',
      endReason: 'goal_completed',
    },
    interpreterOutput: {
      interpretation: {
        isUnderstandable: true,
        isOnTopic: true,
        turnType: 'no_progress',
        filledSlotKeys: [],
        correctedSentence: null,
        detectedIssueTags: [],
        shortReasonKo: null,
        confidence: 0.9,
      },
    },
  });

  assert.equal(response.shouldEndSession, true);
  assert.equal(response.endReason, 'goal_completed');
  assert.equal(response.engineState.status, 'completed');
});

test('respond normalization uses fallback interpretation when interpreter output is missing', () => {
  const scenario = getPharmacyFixtureScenario();
  const response = createConversationResponseFromInterpretation({
    scenario,
    userMessage: "I'm feeling stomachache.",
    messages: [],
    failureCount: 0,
    engineState: createInitialConversationEngineState(scenario),
    interpreterOutput: null,
  });

  assert.equal(response.shouldEndSession, false);
  assert.equal(response.endReason, null);
  assert.deepEqual(response.engineState.filledSlotKeys, ['symptom']);
  assert.equal(response.engineState.pendingSlotKey, 'medicineQuestion');
});

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    payload: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
      this.payload = body ? JSON.parse(body) : null;
    },
  };
}

function getPharmacyFixtureScenario() {
  return JSON.parse(readFileSync(conversationEngineFixtureUrl, 'utf8')).scenario;
}

function createHighEvaluation() {
  return {
    totalScore: 100,
    categoryScores: {
      taskCompletion: 30,
      clarity: 25,
      grammar: 20,
      vocabulary: 15,
      naturalness: 10,
    },
    summaryKo: '전반적으로 높은 점수입니다.',
    strengthsKo: ['상황에 맞는 표현을 사용했습니다.'],
    weaknessesKo: ['목표를 끝까지 확인해 보세요.'],
    correctedExamples: [],
    weaknessTags: ['task_completion'],
    recommendedScenarioIds: ['a2-pharmacy-symptom-001', 'a2-restaurant-request-001'],
  };
}
