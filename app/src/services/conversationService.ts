import { getApiBaseUrl } from '../config/api';
import type {
  ActorApiResponse,
  ActorResponse,
  ConversationEngineState,
  ConversationSlot,
  ConversationMessage,
  EndReason,
  Scenario,
  SkillTag,
  UserMessageAnalysis,
} from '../types/conversation';
import {
  createInitialConversationEngineState,
  runConversationEngineTurn,
} from './conversationEngine';
import { getAiRequestHeaders } from './apiClientIdentity';
import { getRequiredSlots, slotMatches } from './conversationSlotMatcher';

type ActorInput = {
  scenario: Scenario;
  userMessage: string;
  previousMessages: ConversationMessage[];
  failureCount: number;
  engineState: ConversationEngineState;
};

type MockActorInput = ActorInput | Omit<ActorInput, 'engineState'>;

type ConversationTurnMessagesInput = {
  previousMessages: ConversationMessage[];
  userMessage: ConversationMessage;
  actorResponse: ActorResponse;
};

type SlotProgress = {
  knownSlots: ConversationSlot[];
  missingSlots: ConversationSlot[];
  usesSlotContract: boolean;
  canComplete: boolean;
  nextPrompt: string | null;
};

const koreanPattern = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const onlyNoisePattern = /^[\s!?.,'"`~@#$%^&*()_+\-=:[\]{};<>/\\|]+$/;

export function createInitialMessages(scenario: Scenario): ConversationMessage[] {
  return [
    {
      id: createId('assistant'),
      role: 'assistant',
      content: scenario.openingMessage,
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function getActorResponse(input: ActorInput): Promise<ActorResponse> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/conversation/respond`, {
      method: 'POST',
      headers: await getAiRequestHeaders(),
      body: JSON.stringify({
        scenario: input.scenario,
        userMessage: input.userMessage,
        messages: input.previousMessages,
        failureCount: input.failureCount,
        engineState: input.engineState,
      }),
    });

    if (!response.ok) {
      throw new Error(`Conversation API failed with ${response.status}`);
    }

    const data = (await response.json()) as ActorApiResponse;

    return normalizeActorApiResponse(data, input);
  } catch (error) {
    console.warn('Using mock conversation fallback:', error);
    return getMockActorResponse(input);
  }
}

export function getMockActorResponse(input: MockActorInput): ActorResponse {
  const { scenario, userMessage, previousMessages } = input;
  const currentEngineState =
    'engineState' in input
      ? input.engineState
      : createEngineStateFromPreviousMessages(scenario, previousMessages);

  return runConversationEngineTurn({
    scenario,
    previousMessages,
    state: currentEngineState,
    userMessage,
  });
}

function createEngineStateFromPreviousMessages(
  scenario: Scenario,
  previousMessages: ConversationMessage[],
): ConversationEngineState {
  return previousMessages
    .filter((message) => message.role === 'user')
    .reduce(
      (state, message) =>
        runConversationEngineTurn({
          scenario,
          previousMessages: [],
          state,
          userMessage: message.content,
        }).engineState,
      createInitialConversationEngineState(scenario),
    );
}

export function createUserMessage(content: string): ConversationMessage {
  return {
    id: createId('user'),
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

export function buildConversationTurnMessages({
  previousMessages,
  userMessage,
  actorResponse,
}: ConversationTurnMessagesInput): ConversationMessage[] {
  if (actorResponse.shouldEndSession) {
    return [...previousMessages, userMessage];
  }

  return [...previousMessages, userMessage, actorResponse.message];
}

export function normalizeActorApiResponse(
  data: ActorApiResponse,
  input: ActorInput,
): ActorResponse {
  let engineState: ConversationEngineState;
  let shouldEndSession = data.shouldEndSession;
  let endReason = data.endReason;

  if (data.engineState) {
    engineState = data.engineState;
  } else {
    engineState = runConversationEngineTurn({
      scenario: input.scenario,
      previousMessages: input.previousMessages,
      state: input.engineState,
      userMessage: input.userMessage,
    }).engineState;
    shouldEndSession = engineState.status !== 'active';
    endReason = engineState.endReason;
  }

  return {
    message: {
      id: createId('assistant'),
      role: 'assistant',
      content: data.message,
      createdAt: new Date().toISOString(),
    },
    userAnalysis: {
      isRelevant: data.isUserRelevant,
      isUnderstandable: data.isUserUnderstandable,
      detectedIssues: data.detectedIssueTags,
      correctedSentence: normalizeCorrectedSentence(data.correctedSentence),
      shortReasonKo: data.shortReasonKo ?? undefined,
    },
    communicationFailed: !data.isUserUnderstandable,
    shouldEndSession,
    endReason,
    engineState,
  };
}

function analyzeUserMessage(userMessage: string, scenario: Scenario): UserMessageAnalysis {
  const normalized = userMessage.trim();
  const detectedIssues: SkillTag[] = [];

  if (normalized.length < 4 || koreanPattern.test(normalized) || onlyNoisePattern.test(normalized)) {
    detectedIssues.push('clarification');
  }

  if (!/\b(a|an|the|my|your|this|that)\b/i.test(normalized) && normalized.split(/\s+/).length >= 3) {
    detectedIssues.push('articles');
  }

  if (
    isPoliteRequestExpected(normalized, scenario) &&
    !/\b(please|could|would|may|can|i'd|i would)\b/i.test(normalized)
  ) {
    detectedIssues.push('polite_requests');
  }

  if (!hasScenarioVocabulary(normalized, scenario)) {
    detectedIssues.push('vocabulary_range');
  }

  const isUnderstandable = !detectedIssues.includes('clarification');

  return {
    isRelevant: isRelevantToScenario(normalized, scenario),
    isUnderstandable,
    detectedIssues: [...new Set(detectedIssues)],
    correctedSentence: createCorrectedSentence(normalized, scenario),
    shortReasonKo: isUnderstandable ? undefined : '영어 문장으로 의미가 전달되도록 다시 말해 보세요.',
  };
}

function hasScenarioVocabulary(message: string, scenario: Scenario) {
  const lowerMessage = message.toLowerCase();
  const requiredSlots = getRequiredSlots(scenario);

  if (requiredSlots.length > 0) {
    return requiredSlots.some((slot) => slotMatches(slot, lowerMessage, scenario));
  }

  if (scenario.id.includes('cafe')) {
    return /\b(coffee|tea|latte|americano|drink|size|small|medium|large|to go|takeout|milk|sugar)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('hotel')) {
    return /\b(room|hotel|reservation|name|night|check|stay|guest)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('directions')) {
    return /\b(where|station|subway|left|right|straight|near|far|walk|turn)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('airport')) {
    return /\b(passport|bag|luggage|flight|seat|window|aisle|check)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('plans')) {
    return /\b(meet|later|time|today|tomorrow|busy|change|how about|sorry)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('restaurant')) {
    return /\b(menu|water|bill|check|order|bring|table|food)\b/.test(lowerMessage);
  }

  return true;
}

function isRelevantToScenario(message: string, scenario: Scenario) {
  return hasScenarioVocabulary(message, scenario);
}

function createCorrectedSentence(message: string, scenario: Scenario) {
  if (message.length < 4 || koreanPattern.test(message)) {
    return undefined;
  }

  if (isAlreadyNatural(message, scenario)) {
    return undefined;
  }

  if (getRequiredSlots(scenario).length > 0) {
    return undefined;
  }

  return scenario.targetExpressions.find(isConcreteTargetExpression) ?? undefined;
}

function normalizeCorrectedSentence(sentence: string | null) {
  if (!sentence || sentence.includes('...')) {
    return undefined;
  }

  return sentence;
}

function isAlreadyNatural(message: string, scenario: Scenario) {
  const lowerMessage = message.toLowerCase();
  const isPolite = /\b(please|could|would|may|can)\b|i'd|i would/.test(lowerMessage);

  return (!isPoliteRequestExpected(lowerMessage, scenario) || isPolite) &&
    hasScenarioVocabulary(lowerMessage, scenario);
}

function isPoliteRequestExpected(message: string, scenario: Scenario) {
  if (!scenario.targetSkills.includes('polite_requests')) {
    return false;
  }

  return /\b(i want|i need|can i get|can i have|could i get|could i have|bring|get me|order|bill|check|help|would like|like to)\b/i.test(message);
}

function isConcreteTargetExpression(expression: string) {
  return /[a-z]/i.test(expression) && !expression.includes('...');
}

function createReply({
  scenario,
  analysis,
  shouldEndSession,
  nextFailureCount,
  nextUserTurn,
  userMessage,
  slotProgress,
  endReason,
}: {
  scenario: Scenario;
  analysis: UserMessageAnalysis;
  shouldEndSession: boolean;
  nextFailureCount: number;
  nextUserTurn: number;
  userMessage: string;
  slotProgress: SlotProgress;
  endReason: EndReason;
}) {
  if (!analysis.isUnderstandable) {
    if (nextFailureCount >= 3) {
      return "Let's stop here and review your English together.";
    }

    return koreanPattern.test(userMessage)
      ? scenario.repairPolicy.koreanOnly
      : scenario.repairPolicy.unclear;
  }

  if (!analysis.isRelevant) {
    return scenario.repairPolicy.offTopic;
  }

  if (shouldEndSession) {
    return endReason === 'goal_completed'
      ? scenario.completionMessage
      : "Let's stop here and review your English together.";
  }

  return slotProgress.nextPrompt ?? getScenarioReplies(scenario)[(nextUserTurn - 1) % getScenarioReplies(scenario).length];
}

function getScenarioReplies(scenario: Scenario) {
  const slotPrompts = getRequiredSlots(scenario).map((slot) => slot.prompt).filter(Boolean);

  if (slotPrompts.length > 0) {
    return slotPrompts;
  }

  if (scenario.id.includes('cafe')) {
    return [
      'Sure. What size would you like?',
      'Would you like it hot or iced?',
      'Is that for here or to go?',
      'Anything else for you today?',
    ];
  }

  if (scenario.id.includes('hotel')) {
    return [
      'May I have your name, please?',
      'How many nights will you stay?',
      'Do you have your ID with you?',
      "You're all set. Here is your room key.",
    ];
  }

  if (scenario.id.includes('directions')) {
    return [
      'The subway station is two blocks away.',
      'Go straight and turn left at the bank.',
      'It takes about five minutes on foot.',
      'You are welcome. Have a good day.',
    ];
  }

  if (scenario.id.includes('airport')) {
    return [
      'Thank you. Do you have any bags to check?',
      'Where is your final destination today?',
      'Would you prefer a window seat or an aisle seat?',
      'Here is your boarding pass. Please go to gate 12.',
    ];
  }

  if (scenario.id.includes('plans')) {
    return [
      'Sure. What time works better for you?',
      'That sounds fine. Where should we meet?',
      'No problem. Thanks for letting me know.',
    ];
  }

  if (scenario.id.includes('restaurant')) {
    return [
      'Of course. Would you like anything else?',
      'Sure, I will bring it right away.',
      'No problem. Here is the bill.',
    ];
  }

  return ['Sure. Could you tell me a little more?'];
}

function looksComplete(message: string, scenario: Scenario) {
  const lowerMessage = message.toLowerCase();
  const slotProgress = buildSlotProgress(scenario, [message]);

  if (slotProgress.canComplete) {
    return true;
  }

  if (scenario.id.includes('cafe')) {
    return /\b(to go|takeout|for here|that's all|that is all)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('hotel')) {
    return /\b(check in|reservation|room key|that's all|that is all)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('directions')) {
    return /\b(thank you|thanks|got it|i understand)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('airport')) {
    return /\b(boarding pass|gate|checked bag|no bags|one bag|window seat|aisle seat)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('plans')) {
    return /\b(see you|sounds good|that works|thank you|thanks)\b/.test(lowerMessage);
  }

  if (scenario.id.includes('restaurant')) {
    return /\b(bill|check please|that's all|that is all|thank you|thanks)\b/.test(lowerMessage);
  }

  return false;
}

function getEndReason(
  nextFailureCount: number,
  nextUserTurn: number,
  userMessage: string,
  scenario: Scenario,
  slotProgress: SlotProgress,
) {
  if (nextFailureCount >= 3) {
    return 'too_many_failures';
  }

  if (slotProgress.canComplete || !slotProgress.usesSlotContract && looksComplete(userMessage, scenario)) {
    return 'goal_completed';
  }

  if (nextUserTurn >= scenario.maxUserTurns) {
    return 'max_turns';
  }

  return null;
}

function buildSlotProgress(scenario: Scenario, userMessages: string[]): SlotProgress {
  const requiredSlots = getRequiredSlots(scenario);
  const transcript = userMessages.join(' ').toLowerCase();
  const knownSlots = requiredSlots.filter((slot) => slotMatches(slot, transcript, scenario));
  const missingSlots = requiredSlots.filter((slot) => !slotMatches(slot, transcript, scenario));
  const nextSlot = missingSlots[0] ?? null;

  return {
    knownSlots,
    missingSlots,
    usesSlotContract: requiredSlots.length > 0,
    canComplete: requiredSlots.length > 0 && missingSlots.length === 0,
    nextPrompt: nextSlot?.prompt ?? null,
  };
}

function createId(prefix: ConversationMessage['role']) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
