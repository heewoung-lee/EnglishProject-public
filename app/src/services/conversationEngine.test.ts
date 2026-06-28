// @ts-expect-error This filesystem test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type {
  ConversationEngineState,
  ConversationEngineEndReason,
  Scenario,
  TurnInterpretation,
} from '../types/conversation';
import {
  createInitialConversationEngineState,
  runConversationEngineTurn,
} from './conversationEngine';
import { isValidConversationScenario } from './conversationScenarioValidation';
import { scenarios } from '../data/scenarios';

type EngineFixtureTurn = {
  userMessage: string;
  expectedEndReason: ConversationEngineEndReason;
  expectedPendingSlotKey: string | null;
};

type EngineFixtureCase = {
  name: string;
  turns: EngineFixtureTurn[];
};

type EngineFixture = {
  scenario: Scenario;
  cases: EngineFixtureCase[];
};

function readEngineFixture(): EngineFixture {
  const fixtureUrl = new URL('../../../test-fixtures/conversation-engine-v2.json', import.meta.url);

  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as EngineFixture;
}

function createProgressInterpretation(filledSlotKeys: string[]): TurnInterpretation {
  return {
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys,
    correctedSentence: null,
    detectedIssueTags: [],
    shortReasonKo: null,
    confidence: 1,
  };
}

describe('conversation engine v2 fixture', () => {
  it('loads a valid shared pharmacy fixture', () => {
    const fixture = readEngineFixture();
    const slotKeys = fixture.scenario.requiredSlots.map((slot) => slot.key);

    expect(isValidConversationScenario(fixture.scenario)).toBe(true);
    expect(fixture.scenario.id).toBe('a2-pharmacy-symptom-001');
    expect(fixture.scenario.titleKo).toBe('약국에서 약 요청하기');
    expect(fixture.cases).toHaveLength(3);
    expect(slotKeys).toEqual(['symptom', 'medicineQuestion']);

    for (const fixtureCase of fixture.cases) {
      expect(fixtureCase.name.trim().length).toBeGreaterThan(0);
      expect(fixtureCase.turns.length).toBeGreaterThan(0);

      for (const turn of fixtureCase.turns) {
        expect(turn.userMessage.trim().length).toBeGreaterThan(0);
        expect([null, 'goal_completed', 'max_turns', 'too_many_failures', 'no_progress']).toContain(
          turn.expectedEndReason,
        );
        expect(turn.expectedPendingSlotKey === null || slotKeys.includes(turn.expectedPendingSlotKey)).toBe(true);
      }
    }
  });
});

describe('conversationEngine app reducer', () => {
  it('matches shared fixture cases', () => {
    const fixture = readEngineFixture();

    for (const fixtureCase of fixture.cases) {
      let state = createInitialConversationEngineState(fixture.scenario);

      for (const turn of fixtureCase.turns) {
        const result = runConversationEngineTurn({
          scenario: fixture.scenario,
          previousMessages: [],
          state,
          userMessage: turn.userMessage,
        });

        state = result.engineState!;

        expect(result.engineState?.endReason, fixtureCase.name).toBe(turn.expectedEndReason);
        expect(result.engineState?.pendingSlotKey, fixtureCase.name).toBe(turn.expectedPendingSlotKey);
      }
    }
  });

  it('skips understandable no-progress answers instead of repeating examples', () => {
    const fixture = readEngineFixture();
    const initialState = createInitialConversationEngineState(fixture.scenario);
    const medicinePrompt = fixture.scenario.requiredSlots[1].prompt;

    const first = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: initialState,
      userMessage: 'I need help.',
    });
    const second = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: first.engineState!,
      userMessage: 'Can you help me?',
    });

    expect(first.message.content).toBe(medicinePrompt);
    expect(first.engineState?.pendingSlotKey).toBe('medicineQuestion');
    expect(first.engineState?.skippedSlotKeys).toEqual(['symptom']);
    expect(first.engineState?.repeatedPromptCount).toBe(0);
    expect(second.endReason).toBe('no_progress');
    expect(second.message.content).toBe("Let's stop here and review this situation together.");
  });

  it('ends after repeated unclear turns instead of stopping immediately', () => {
    const fixture = readEngineFixture();

    const first = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: createInitialConversationEngineState(fixture.scenario),
      userMessage: '???',
    });
    const second = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: first.engineState!,
      userMessage: '!!!',
    });
    const third = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: second.engineState!,
      userMessage: '...',
    });

    expect(first.shouldEndSession).toBe(false);
    expect(first.endReason).toBeNull();
    expect(second.shouldEndSession).toBe(false);
    expect(second.endReason).toBeNull();
    expect(third.shouldEndSession).toBe(true);
    expect(third.endReason).toBe('too_many_failures');
    expect(third.message.content).toBe("Let's stop here and review your English together.");
  });

  it('counts mixed unclear and off-topic failures toward the same terminal threshold', () => {
    const fixture = readEngineFixture();
    const initialState = createInitialConversationEngineState(fixture.scenario);
    const unclear = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: initialState,
      userMessage: '???',
    });
    const offTopic = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: unclear.engineState!,
      userMessage: 'I want to buy a computer.',
    });
    const terminal = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: offTopic.engineState!,
      userMessage: 'random computer again',
    });

    expect(unclear.shouldEndSession).toBe(false);
    expect(offTopic.shouldEndSession).toBe(false);
    expect(terminal.shouldEndSession).toBe(true);
    expect(terminal.endReason).toBe('too_many_failures');
    expect(terminal.message.content).not.toContain('One simple answer');
    expect(terminal.message.content).not.toContain('Try saying');
  });

  it('moves past an understandable passport handoff mistake instead of looping', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'a2-airport-checkin-001');

    expect(scenario).toBeTruthy();

    const state: ConversationEngineState = {
      ...createInitialConversationEngineState(scenario!),
      repeatedPromptCount: 1,
      noProgressCount: 1,
    };
    const result = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state,
      userMessage: 'of course, here is this',
    });

    expect(result.shouldEndSession).toBe(false);
    expect(result.engineState?.pendingSlotKey).toBe('destination');
    expect(result.engineState?.skippedSlotKeys).toEqual(['passport']);
    expect(result.message.content).toBe('Where are you flying today?');
    expect(result.message.content).not.toContain('One simple answer');
  });

  it('accepts accident as a reason in the change-plans scenario', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'a2-change-plans-001');

    expect(scenario).toBeTruthy();

    const first = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: createInitialConversationEngineState(scenario!),
      userMessage: "I'm sorry, Could we change our meeting time at 4?",
    });
    const second = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: first.engineState!,
      userMessage: 'I have an accident suddenly. so we have to change our meeting time.',
    });

    expect(first.engineState?.filledSlotKeys).toEqual(['planChange', 'newTime']);
    expect(first.engineState?.pendingSlotKey).toBe('reason');
    expect(second.endReason).toBe('goal_completed');
    expect(second.engineState?.filledSlotKeys).toContain('reason');
    expect(second.message.content).toBe(scenario!.completionMessage);
  });

  it('resets no-progress and repetition counters when progress is made', () => {
    const fixture = readEngineFixture();
    const initialState = createInitialConversationEngineState(fixture.scenario);

    const first = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: initialState,
      userMessage: 'I need help.',
    });
    const second = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: first.engineState!,
      userMessage: "I'm feeling stomachache.",
    });

    expect(second.engineState?.filledSlotKeys).toContain('symptom');
    expect(second.engineState?.noProgressCount).toBe(0);
    expect(second.engineState?.repeatedPromptCount).toBe(0);
  });

  it('accepts a bare guest name after the hotel name prompt', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'a1-hotel-checkin-001');

    expect(scenario).toBeTruthy();

    const reservationTurn = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: createInitialConversationEngineState(scenario!),
      userMessage: 'I have a reservation. Could you check it?',
    });
    const nameTurn = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: reservationTurn.engineState!,
      userMessage: 'lee hee woung',
    });

    expect(reservationTurn.engineState?.pendingSlotKey).toBe('name');
    expect(nameTurn.communicationFailed).toBe(false);
    expect(nameTurn.userAnalysis.isUnderstandable).toBe(true);
    expect(nameTurn.engineState?.filledSlotKeys).toContain('name');
    expect(nameTurn.engineState?.pendingSlotKey).toBe('id');
    expect(nameTurn.message.content).toBe('May I see your ID or passport?');
  });

  it('accepts short document handoff answers after the hotel ID prompt', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'a1-hotel-checkin-001');

    expect(scenario).toBeTruthy();

    const reservationTurn = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: createInitialConversationEngineState(scenario!),
      userMessage: 'I have a reservation. Could you check it?',
    });
    const nameTurn = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: reservationTurn.engineState!,
      userMessage: 'my name is hee woung',
    });

    for (const userMessage of ['yes, here is', 'of course']) {
      const result = runConversationEngineTurn({
        scenario: scenario!,
        previousMessages: [],
        state: nameTurn.engineState!,
        userMessage,
      });

      expect(result.communicationFailed, userMessage).toBe(false);
      expect(result.userAnalysis.isRelevant, userMessage).toBe(true);
      expect(result.engineState?.filledSlotKeys, userMessage).toContain('id');
      expect(result.endReason, userMessage).toBe('goal_completed');
      expect(result.message.content, userMessage).toBe(scenario!.completionMessage);
    }
  });

  it('does not treat common non-name phrases as a bare guest name', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'a1-hotel-checkin-001');

    expect(scenario).toBeTruthy();

    const reservationTurn = runConversationEngineTurn({
      scenario: scenario!,
      previousMessages: [],
      state: createInitialConversationEngineState(scenario!),
      userMessage: 'I have a reservation. Could you check it?',
    });

    for (const userMessage of ['one moment', 'credit card', 'late checkout']) {
      const result = runConversationEngineTurn({
        scenario: scenario!,
        previousMessages: [],
        state: reservationTurn.engineState!,
        userMessage,
      });

      expect(result.engineState?.filledSlotKeys, userMessage).not.toContain('name');
      expect(result.engineState?.pendingSlotKey, userMessage).toBe('name');
      expect(result.message.content, userMessage).not.toBe('May I see your ID or passport?');
    }
  });

  it('accepts a bare name for a non-hotel name slot', () => {
    const scenario: Scenario = {
      id: 'a1-library-card-001',
      level: 'A1',
      area: 'conversation',
      titleKo: '도서관 카드 만들기',
      titleEn: 'Getting a Library Card',
      situationKo: '도서관에서 카드를 만듭니다.',
      descriptionKo: '필요한 카드와 이름을 말합니다.',
      aiRole: 'Librarian',
      userRole: 'Visitor',
      userGoalKo: '도서관 카드가 필요하다고 말하고 이름을 알려 주세요.',
      difficulty: 'beginner',
      maxUserTurns: 5,
      targetExpressions: ['I need a library card.', 'My name is ...'],
      targetSkills: ['task_completion'],
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
    const nameTurn = runConversationEngineTurn({
      scenario,
      previousMessages: [],
      state: cardTurn.engineState!,
      userMessage: 'mina park',
    });

    expect(cardTurn.engineState?.pendingSlotKey).toBe('name');
    expect(nameTurn.engineState?.filledSlotKeys).toContain('name');
    expect(nameTurn.endReason).toBe('goal_completed');
  });

  it('counts progress interpretation with no filled slots as no-progress', () => {
    const fixture = readEngineFixture();
    const state = createInitialConversationEngineState(fixture.scenario);

    const result = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'I feel bad.',
      interpretation: createProgressInterpretation([]),
    });

    expect(result.engineState?.filledSlotKeys).toEqual([]);
    expect(result.engineState?.skippedSlotKeys).toEqual(['symptom']);
    expect(result.engineState?.pendingSlotKey).toBe('medicineQuestion');
    expect(result.engineState?.noProgressCount).toBe(1);
    expect(result.engineState?.repeatedPromptCount).toBe(0);
  });

  it('counts progress interpretation with unknown filled slots as no-progress', () => {
    const fixture = readEngineFixture();
    const state = createInitialConversationEngineState(fixture.scenario);

    const result = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'I gave another answer.',
      interpretation: createProgressInterpretation(['unknownSlot']),
    });

    expect(result.engineState?.filledSlotKeys).toEqual([]);
    expect(result.engineState?.skippedSlotKeys).toEqual(['symptom']);
    expect(result.engineState?.pendingSlotKey).toBe('medicineQuestion');
    expect(result.engineState?.noProgressCount).toBe(1);
    expect(result.engineState?.repeatedPromptCount).toBe(0);
  });

  it('repairs off-topic turns before ending after repeated failures', () => {
    const fixture = readEngineFixture();

    const first = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: createInitialConversationEngineState(fixture.scenario),
      userMessage: 'I like soccer.',
    });
    const second = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: first.engineState!,
      userMessage: 'I still like soccer.',
    });
    const third = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state: second.engineState!,
      userMessage: 'soccer again',
    });

    expect(first.shouldEndSession).toBe(false);
    expect(first.engineState?.offTopicCount).toBe(1);
    expect(first.endReason).toBeNull();
    expect(second.shouldEndSession).toBe(false);
    expect(second.engineState?.offTopicCount).toBe(2);
    expect(second.endReason).toBeNull();
    expect(third.shouldEndSession).toBe(true);
    expect(third.engineState?.offTopicCount).toBe(3);
    expect(third.endReason).toBe('too_many_failures');
  });

  it('ends with no_progress when the last missing slot is skipped before turn limit', () => {
    const fixture = readEngineFixture();
    const scenario: Scenario = {
      ...fixture.scenario,
      maxUserTurns: 2,
    };
    let state = createInitialConversationEngineState(scenario);

    for (const userMessage of ["I'm feeling stomachache.", 'I need help.']) {
      state = runConversationEngineTurn({
        scenario,
        previousMessages: [],
        state,
        userMessage,
      }).engineState!;
    }

    expect(state.endReason).toBe('no_progress');
  });

  it('keeps an already completed state completed', () => {
    const fixture = readEngineFixture();
    const state: ConversationEngineState = {
      ...createInitialConversationEngineState(fixture.scenario),
      filledSlotKeys: ['symptom', 'medicineQuestion'],
      pendingSlotKey: null,
      status: 'completed',
      endReason: 'goal_completed',
    };

    const result = runConversationEngineTurn({
      scenario: fixture.scenario,
      previousMessages: [],
      state,
      userMessage: 'What?',
    });

    expect(result.shouldEndSession).toBe(true);
    expect(result.endReason).toBe('goal_completed');
    expect(result.engineState?.status).toBe('completed');
  });
});
