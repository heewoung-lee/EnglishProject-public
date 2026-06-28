import type {
  ActorResponse,
  ConversationEngineEndReason,
  ConversationEngineState,
  ConversationMessage,
  ConversationSlot,
  ConversationTurnType,
  Scenario,
  TurnInterpretation,
  UserMessageAnalysis,
} from '../types/conversation';
import { getRequiredSlots, slotMatches } from './conversationSlotMatcher';

type ReduceConversationTurnInput = {
  scenario: Scenario;
  state: ConversationEngineState;
  interpretation: TurnInterpretation;
};

type RunConversationEngineTurnInput = {
  scenario: Scenario;
  // Accepted for API symmetry with actor callers; engine state is the source of truth.
  previousMessages: ConversationMessage[];
  state: ConversationEngineState;
  userMessage: string;
  interpretation?: TurnInterpretation;
};

type AssistantAction = {
  key: string;
  content: string;
};

const terminalMessages: Record<Exclude<ConversationEngineEndReason, null>, string> = {
  goal_completed: '',
  max_turns: "Let's stop here and review your conversation.",
  too_many_failures: "Let's stop here and review your English together.",
  no_progress: "Let's stop here and review this situation together.",
};

const helpRequestPattern = /\b(?:i\s+need\s+help|can\s+you\s+help\s+me|please\s+help\s+me|help\s+me)\b/i;
const englishWordPattern = /\p{Script=Latin}/u;
const koreanPattern = /\p{Script=Hangul}/u;
const wordPattern = /[\p{L}\p{N}]/u;
const bareNameRejectWords = new Set([
  'am',
  'booking',
  'can',
  'card',
  'check',
  'check-out',
  'checkout',
  'could',
  'credit',
  'email',
  'have',
  'hello',
  'help',
  'hi',
  'hotel',
  'id',
  'is',
  'it',
  'late',
  'later',
  'like',
  'may',
  'minute',
  'moment',
  'my',
  'name',
  'need',
  'no',
  'one',
  'passport',
  'phone',
  'please',
  'reservation',
  'room',
  'second',
  'sorry',
  'thank',
  'thanks',
  'that',
  'this',
  'under',
  'wait',
  'want',
  'would',
  'yes',
  'you',
  'your',
]);
const scenarioRelationStopWords = new Set([
  'about',
  'after',
  'again',
  'anything',
  'before',
  'complete',
  'could',
  'describe',
  'have',
  'hello',
  'help',
  'many',
  'need',
  'often',
  'please',
  'question',
  'should',
  'take',
  'tell',
  'that',
  'there',
  'this',
  'today',
  'what',
  'when',
  'where',
  'with',
  'would',
  'your',
]);

const slotExampleRules: Array<{ pattern: RegExp; example: string }> = [
  { pattern: /cafe.*\bdrink\b/, example: "I'd like a coffee." },
  { pattern: /cafe.*\bsize\b/, example: 'A medium, please.' },
  { pattern: /\bdiningoption\b|for here or to go/, example: 'To go, please.' },
  { pattern: /\bpassport\b/, example: 'Here is my passport.' },
  { pattern: /\bid\b/, example: 'Here is my ID.' },
  { pattern: /\bname\b|\bcaller\b/, example: 'My name is Mina Park.' },
  { pattern: /\bcontactinfo\b|\bidentitycontact\b|\bphone number\b/, example: 'My phone number is 555-1234.' },
  { pattern: /\breservationtime\b/, example: 'At seven, please.' },
  { pattern: /\bpartySize\b|party size|how many people/, example: 'A table for two, please.' },
  { pattern: /\breservation\b|\bbooking\b/, example: 'I have a reservation.' },
  { pattern: /airport.*\bdestination\b|flying today/, example: "I'm flying to Seoul." },
  { pattern: /taxi.*\bdestination\b/, example: 'Please take me to the station.' },
  { pattern: /bus.*\bdestination\b/, example: 'One ticket to Seoul, please.' },
  { pattern: /directions.*\bdestination\b/, example: 'Where is the subway station?' },
  { pattern: /\bsymptom\b/, example: 'I have a headache.' },
  { pattern: /\bmedicinequestion\b|dosage/, example: 'Do you have any medicine for a headache?' },
  { pattern: /convenience.*\bitem\b|item to buy/, example: "I'd like to buy water." },
  { pattern: /\bpayment\b/, example: "I'll pay by card." },
  { pattern: /\bticketcount\b|ticket count/, example: 'One ticket, please.' },
  { pattern: /direction confirmation/, example: 'Thank you, I understand.' },
  { pattern: /\bcallback\b|call back/, example: 'Please call me back.' },
  { pattern: /\bconfusion\b|not understanding/, example: "I don't understand this part." },
  { pattern: /\bhelprequest\b|help request/, example: 'Can you explain again?' },
  { pattern: /\bbag\b|\bluggage\b/, example: 'I have one bag.' },
  { pattern: /\bseat\b/, example: 'Could I have a window seat?' },
  { pattern: /\bplanchange\b|plan change/, example: 'Can we meet later?' },
  { pattern: /change-plans.*\breason\b|work-schedule.*\breason\b/, example: 'I have an appointment.' },
  { pattern: /\bnewtime\b|new time/, example: 'How about 5 p.m.?' },
  { pattern: /restaurant-request.*requestitem|restaurant request/, example: 'Could I have some water?' },
  { pattern: /\bpoliterequest\b|polite request/, example: 'Could I have it, please?' },
  { pattern: /shopping-return.*problem|too small/, example: 'It is too small.' },
  { pattern: /\bexchangerequest\b|exchange request/, example: 'Could I exchange this?' },
  { pattern: /\broute\b|route preference/, example: 'Could you take the faster route?' },
  { pattern: /\bswitchrequest\b|shift switch/, example: 'Could we switch shifts?' },
  { pattern: /\bprogress\b|current progress/, example: "I'm almost finished with the report." },
  { pattern: /\bissue\b|delay reason/, example: 'The main issue is waiting for feedback.' },
  { pattern: /\btimeline\b|revised deadline/, example: 'I expect to finish it by Friday.' },
  { pattern: /\bappointmentrequest\b|make an appointment/, example: "I'd like to make an appointment." },
  { pattern: /\bappointmenttime\b|appointment time/, example: 'Is there anything available on Monday morning?' },
  { pattern: /\bproblemtype\b|maintenance problem/, example: 'There is a problem with the faucet.' },
  { pattern: /\blocation\b|problem location/, example: 'It is in the bathroom.' },
  { pattern: /\burgency\b/, example: 'It has been happening since yesterday.' },
  { pattern: /\bvisittime\b|visit time/, example: 'Tomorrow morning works for me.' },
  { pattern: /\borderinfo\b|order information/, example: "I'm calling about order number 1234." },
  { pattern: /\bitemproblem\b/, example: 'The item arrived damaged.' },
  { pattern: /\brefundrequest\b|refund/, example: "I'd like to request a refund." },
  { pattern: /\bevidenceortiming\b|evidence or timing/, example: 'I received it yesterday and have photos.' },
  { pattern: /\bopinion\b|clear opinion/, example: 'In my opinion, online classes are useful.' },
  { pattern: /class-discussion.*\breason\b|reason or example/, example: 'I think so because it saves time.' },
  { pattern: /\bresponsetoother\b|another opinion/, example: 'I see your point, but I disagree.' },
  { pattern: /\bbookinginfo\b|flight information/, example: 'My flight number is AB123.' },
  { pattern: /\bdelayimpact\b|delay impact/, example: 'I might miss my connection.' },
  { pattern: /\brequestedoption\b|requested option/, example: 'What are my options?' },
  { pattern: /next action confirmation/, example: 'That works for me.' },
  { pattern: /\bissuetype\b|account issue/, example: 'I noticed an unusual charge.' },
  { pattern: /\btransactiondetail\b|transaction detail/, example: 'The transaction was on Monday.' },
  { pattern: /\brequestedaction\b|bank action/, example: 'Could you check my account?' },
  { pattern: /\bpoliteresponse\b|interview response/, example: 'Thank you for the opportunity.' },
  { pattern: /\bavailability\b|interview availability/, example: "I'm available on Monday morning." },
  { pattern: /\bformatconfirmation\b|format or location/, example: 'Could you confirm if it is online?' },
  { pattern: /\bpreparationquestion\b|what to prepare/, example: 'Could you let me know what I should prepare?' },
  { pattern: /\backnowledgerequest\b|added scope/, example: 'I understand you want extra features.' },
  { pattern: /project-scope.*\bimpact\b/, example: 'That would affect the timeline.' },
  { pattern: /\bpriorityquestion\b|priority clarification/, example: 'Could we prioritize the must-have items first?' },
  { pattern: /\bcompromise\b/, example: 'One option is to move this to a later phase.' },
  { pattern: /\bempathy\b/, example: 'I understand why that was frustrating.' },
  { pattern: /\bapology\b|responsibility/, example: 'I apologize for the inconvenience.' },
  { pattern: /\bdetails\b|detail confirmation/, example: 'Could you share the case number?' },
  { pattern: /\bresolution\b|follow-up/, example: 'I will follow up by tomorrow.' },
  { pattern: /\bachievement\b/, example: 'One achievement I am proud of is improving retention.' },
  { pattern: /\bevidence\b|supporting evidence/, example: 'Customer satisfaction increased by 10 percent.' },
  { pattern: /\bimprovementarea\b|area for improvement/, example: 'I would like to improve stakeholder communication.' },
  { pattern: /\bfuturegoal\b|future goal/, example: 'My goal for next quarter is to lead a project.' },
  { pattern: /\brentconcern\b|rent increase/, example: 'A 15 percent increase is difficult for me.' },
  { pattern: /\bcounteroffer\b/, example: 'Would you be open to a smaller increase?' },
  { pattern: /\brepairissue\b|condition issue/, example: 'The heater still needs repair.' },
  { pattern: /\bwrittenagreement\b|in writing/, example: 'Could we put that in writing?' },
  { pattern: /\btopicresponse\b|conference topic/, example: 'I enjoyed your point about AI adoption.' },
  { pattern: /\bselfintroduction\b|professional introduction/, example: 'My work focuses on product analytics.' },
  { pattern: /\bfollowupquestion\b|follow-up question/, example: 'What do you think about the market trend?' },
  { pattern: /\bstayintouch\b|stay in touch/, example: 'Would you be open to staying in touch?' },
  { pattern: /\bsecondopinionrequest\b|second opinion/, example: 'I would like a second opinion.' },
  { pattern: /\bmedicalbackground\b|previous diagnosis/, example: 'I have had headaches for two weeks.' },
  { pattern: /\briskquestion\b|risks and benefits/, example: 'What are the risks and benefits?' },
  { pattern: /\bnextsteps\b|next step question/, example: 'Should I get additional tests?' },
  { pattern: /vendor.*\bimpact\b|business impact/, example: 'The delay is affecting our launch plan.' },
  { pattern: /\bblockerquestion\b|blocker clarification/, example: 'What is blocking the delivery?' },
  { pattern: /\bdeadlinerequest\b|deadline request/, example: 'Can you commit to a revised deadline?' },
  { pattern: /\bworkaround\b|escalation/, example: 'We need a temporary workaround.' },
  { pattern: /\bneutralacknowledgement\b|neutral acknowledgement/, example: 'Let me make sure I understand both perspectives.' },
  { pattern: /\bfactfinding\b|fact-finding/, example: 'Can you give me a specific example?' },
  { pattern: /\broleclarification\b|role clarification/, example: "Let's clarify each person's responsibilities." },
  { pattern: /\bfollowupprocess\b|going forward/, example: "Let's agree on responsibilities going forward." },
];

export function createInitialConversationEngineState(scenario: Scenario): ConversationEngineState {
  const firstPendingSlotKey = getRequiredSlots(scenario)[0]?.key ?? null;
  const status = firstPendingSlotKey === null ? 'completed' : 'active';

  return {
    filledSlotKeys: [],
    skippedSlotKeys: [],
    pendingSlotKey: firstPendingSlotKey,
    lastPromptKey: null,
    lastAssistantActionKey: null,
    lastTurnType: null,
    repeatedPromptCount: 0,
    noProgressCount: 0,
    offTopicCount: 0,
    unclearCount: 0,
    userTurnCount: 0,
    status,
    endReason: status === 'completed' ? 'goal_completed' : null,
  };
}

export function getConversationEngineFailureCount(state: ConversationEngineState): number {
  return state.offTopicCount + state.unclearCount;
}

export function interpretUserTurnWithFallback(scenario: Scenario, userMessage: string): TurnInterpretation {
  const text = userMessage.trim();
  const matchedSlotKeys = getRequiredSlots(scenario)
    .filter((slot) => slotMatches(slot, text, scenario))
    .map((slot) => slot.key);

  if (!text || isNoise(text) || isKoreanOnly(text)) {
    return createInterpretation({
      isUnderstandable: false,
      isOnTopic: false,
      turnType: 'unclear',
      filledSlotKeys: [],
      confidence: 0.65,
      detectedIssueTags: ['clarification'],
      shortReasonKo: isKoreanOnly(text) ? '영어로 다시 말해 주세요.' : '의미를 이해하기 어려워요.',
    });
  }

  if (matchedSlotKeys.length > 0) {
    return createInterpretation({
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'progress',
      filledSlotKeys: matchedSlotKeys,
      confidence: 0.9,
    });
  }

  if (isScenarioRelatedEnglish(scenario, text)) {
    return createInterpretation({
      isUnderstandable: true,
      isOnTopic: true,
      turnType: 'no_progress',
      filledSlotKeys: [],
      confidence: 0.75,
      detectedIssueTags: ['task_completion'],
      shortReasonKo: '필요한 정보를 아직 말하지 않았어요.',
    });
  }

  return createInterpretation({
    isUnderstandable: true,
    isOnTopic: false,
    turnType: 'off_topic',
    filledSlotKeys: [],
    confidence: 0.75,
    detectedIssueTags: ['task_completion'],
    shortReasonKo: '상황과 다른 답변이에요.',
  });
}

export function reduceConversationTurn(input: ReduceConversationTurnInput): ConversationEngineState {
  const { scenario, state, interpretation } = input;

  if (state.status !== 'active' || state.endReason !== null) {
    return state;
  }

  const requiredSlots = getRequiredSlots(scenario);
  const requiredSlotKeys = new Set(requiredSlots.map((slot) => slot.key));
  const newlyFilledSlotKeys = interpretation.filledSlotKeys.filter((slotKey) => {
    return requiredSlotKeys.has(slotKey) && !state.filledSlotKeys.includes(slotKey);
  });
  const filledSlotKeys = uniqueSlotKeys([...state.filledSlotKeys, ...newlyFilledSlotKeys], requiredSlotKeys);
  const madeProgress = newlyFilledSlotKeys.length > 0;
  const turnType = madeProgress || interpretation.turnType !== 'progress'
    ? interpretation.turnType
    : 'no_progress';
  const pendingSlotBeforeTurn = getPendingSlot(scenario, state);
  const shouldSkipPendingSlot =
    !madeProgress &&
    turnType === 'no_progress' &&
    interpretation.isUnderstandable &&
    interpretation.isOnTopic &&
    pendingSlotBeforeTurn !== null;
  const skippedSlotKeys = uniqueSlotKeys(
    [
      ...(state.skippedSlotKeys ?? []),
      ...(shouldSkipPendingSlot ? [pendingSlotBeforeTurn.key] : []),
    ],
    requiredSlotKeys,
  ).filter((slotKey) => !filledSlotKeys.includes(slotKey));
  const noProgressCount = madeProgress
    ? 0
    : turnType === 'no_progress'
      ? state.noProgressCount + 1
      : state.noProgressCount;
  const repeatedPromptCount = madeProgress || shouldSkipPendingSlot
    ? 0
    : state.repeatedPromptCount + 1;
  const offTopicCount = turnType === 'off_topic' ? state.offTopicCount + 1 : state.offTopicCount;
  const unclearCount = turnType === 'unclear' ? state.unclearCount + 1 : state.unclearCount;
  const userTurnCount = state.userTurnCount + 1;
  const pendingSlotKey = requiredSlots.find((slot) => {
    return !filledSlotKeys.includes(slot.key) && !skippedSlotKeys.includes(slot.key);
  })?.key ?? null;
  const allSlotsFilled = requiredSlots.every((slot) => filledSlotKeys.includes(slot.key));
  const endReason = getEndReason({
    allSlotsFilled,
    slotsExhausted: pendingSlotKey === null && !allSlotsFilled,
    noProgressCount,
    offTopicCount,
    unclearCount,
    userTurnCount,
    maxUserTurns: scenario.maxUserTurns,
  });

  return {
    ...state,
    filledSlotKeys,
    skippedSlotKeys,
    pendingSlotKey,
    lastTurnType: turnType,
    repeatedPromptCount,
    noProgressCount,
    offTopicCount,
    unclearCount,
    userTurnCount,
    status: getStatus(endReason),
    endReason,
  };
}

export function runConversationEngineTurn(input: RunConversationEngineTurnInput): ActorResponse {
  const interpretation = promotePendingNameInterpretation({
    scenario: input.scenario,
    state: input.state,
    userMessage: input.userMessage,
    interpretation: input.interpretation ?? interpretUserTurnWithFallback(input.scenario, input.userMessage),
  });
  const contextualInterpretation = promotePendingDocumentHandoffInterpretation({
    scenario: input.scenario,
    state: input.state,
    userMessage: input.userMessage,
    interpretation,
  });
  const reducedState = reduceConversationTurn({
    scenario: input.scenario,
    state: input.state,
    interpretation: contextualInterpretation,
  });
  const action = getAssistantAction({
    scenario: input.scenario,
    state: reducedState,
    previousState: input.state,
    userMessage: input.userMessage,
  });
  const engineState: ConversationEngineState = {
    ...reducedState,
    lastPromptKey: action.key.startsWith('slot:') ? reducedState.pendingSlotKey : reducedState.lastPromptKey,
    lastAssistantActionKey: action.key,
  };
  const userAnalysis = createUserAnalysis(contextualInterpretation);
  const message: ConversationMessage = {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: action.content,
    createdAt: new Date().toISOString(),
  };

  return {
    message,
    userAnalysis,
    communicationFailed: contextualInterpretation.turnType === 'off_topic' || contextualInterpretation.turnType === 'unclear',
    shouldEndSession: engineState.status !== 'active',
    endReason: engineState.endReason,
    engineState,
  };
}

function createInterpretation(
  interpretation: Partial<TurnInterpretation> &
    Pick<TurnInterpretation, 'isUnderstandable' | 'isOnTopic' | 'turnType' | 'filledSlotKeys' | 'confidence'>,
): TurnInterpretation {
  return {
    correctedSentence: null,
    detectedIssueTags: [],
    shortReasonKo: null,
    ...interpretation,
  };
}

function createUserAnalysis(interpretation: TurnInterpretation): UserMessageAnalysis {
  return {
    isRelevant: interpretation.isOnTopic,
    isUnderstandable: interpretation.isUnderstandable,
    detectedIssues: interpretation.detectedIssueTags,
    ...(interpretation.correctedSentence ? { correctedSentence: interpretation.correctedSentence } : {}),
    ...(interpretation.shortReasonKo ? { shortReasonKo: interpretation.shortReasonKo } : {}),
  };
}

function promotePendingNameInterpretation(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  userMessage: string;
  interpretation: TurnInterpretation;
}): TurnInterpretation {
  const pendingSlot = getPendingSlot(input.scenario, input.state);

  if (
    !pendingSlot ||
    !isNameSlot(pendingSlot) ||
    !looksLikeBareNameAnswer(input.userMessage)
  ) {
    return input.interpretation;
  }

  return createInterpretation({
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys: [...new Set([...input.interpretation.filledSlotKeys, pendingSlot.key])],
    confidence: Math.max(input.interpretation.confidence, 0.85),
  });
}

function promotePendingDocumentHandoffInterpretation(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  userMessage: string;
  interpretation: TurnInterpretation;
}): TurnInterpretation {
  const pendingSlot = getPendingSlot(input.scenario, input.state);

  if (
    !pendingSlot ||
    !isDocumentHandoffSlot(pendingSlot) ||
    !looksLikeDocumentHandoffAnswer(input.userMessage)
  ) {
    return input.interpretation;
  }

  return createInterpretation({
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys: [...new Set([...input.interpretation.filledSlotKeys, pendingSlot.key])],
    confidence: Math.max(input.interpretation.confidence, 0.85),
  });
}

function getEndReason(input: {
  allSlotsFilled: boolean;
  slotsExhausted: boolean;
  noProgressCount: number;
  offTopicCount: number;
  unclearCount: number;
  userTurnCount: number;
  maxUserTurns: number;
}): ConversationEngineEndReason {
  if (input.allSlotsFilled) {
    return 'goal_completed';
  }

  if (input.slotsExhausted) {
    return 'no_progress';
  }

  if (input.offTopicCount + input.unclearCount >= 3) {
    return 'too_many_failures';
  }

  if (input.noProgressCount >= 3) {
    return 'no_progress';
  }

  if (input.userTurnCount >= input.maxUserTurns) {
    return 'max_turns';
  }

  return null;
}

function getStatus(endReason: ConversationEngineEndReason): ConversationEngineState['status'] {
  if (endReason === 'goal_completed') {
    return 'completed';
  }

  if (endReason !== null) {
    return 'ended';
  }

  return 'active';
}

function getAssistantAction(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  previousState: ConversationEngineState;
  userMessage: string;
}): AssistantAction {
  const selectedAction = selectAssistantAction(input);

  if (selectedAction.key !== input.previousState.lastAssistantActionKey) {
    return selectedAction;
  }

  if (selectedAction.key.startsWith('repair:')) {
    return selectedAction;
  }

  return selectNextHigherAction(input) ?? selectedAction;
}

function selectAssistantAction(input: {
  scenario: Scenario;
  state: ConversationEngineState;
  previousState: ConversationEngineState;
  userMessage: string;
}): AssistantAction {
  const { scenario, state, userMessage } = input;

  if (state.endReason === 'goal_completed') {
    return {
      key: 'end:goal_completed',
      content: scenario.completionMessage,
    };
  }

  if (state.endReason !== null) {
    return {
      key: `end:${state.endReason}`,
      content: terminalMessages[state.endReason],
    };
  }

  if (state.lastTurnType === 'unclear') {
    return {
      key: isKoreanOnly(userMessage) ? 'repair:korean_only' : 'repair:unclear',
      content: isKoreanOnly(userMessage) ? scenario.repairPolicy.koreanOnly : scenario.repairPolicy.unclear,
    };
  }

  if (state.lastTurnType === 'off_topic') {
    return {
      key: 'repair:off_topic',
      content: scenario.repairPolicy.offTopic,
    };
  }

  return getSlotPromptAction(scenario, state, getActiveSlotPromptStage(input.previousState, state));
}

function selectNextHigherAction(input: {
  scenario: Scenario;
  state: ConversationEngineState;
}): AssistantAction | null {
  if (input.state.endReason !== null || input.state.pendingSlotKey === null) {
    return null;
  }

  return getSlotPromptAction(input.scenario, input.state, input.state.repeatedPromptCount + 1);
}

function getActiveSlotPromptStage(
  previousState: ConversationEngineState,
  state: ConversationEngineState,
): number {
  if (state.repeatedPromptCount === 0) {
    return 0;
  }

  if (previousState.lastAssistantActionKey === null && previousState.repeatedPromptCount > 0) {
    return state.repeatedPromptCount;
  }

  return previousState.repeatedPromptCount;
}

function getSlotPromptAction(
  scenario: Scenario,
  state: ConversationEngineState,
  repeatedPromptCount: number,
): AssistantAction {
  const slot = getPendingSlot(scenario, state);

  if (!slot) {
    return {
      key: 'end:goal_completed',
      content: scenario.completionMessage,
    };
  }

  if (repeatedPromptCount <= 0) {
    return {
      key: `slot:${slot.key}:prompt`,
      content: slot.prompt,
    };
  }

  if (repeatedPromptCount === 1) {
    return {
      key: `slot:${slot.key}:hint`,
      content: `Try saying: "${getSlotExample(scenario, slot)}"`,
    };
  }

  return {
    key: `slot:${slot.key}:example`,
    content: `One simple answer is enough: "${getSlotExample(scenario, slot)}"`,
  };
}

function getPendingSlot(scenario: Scenario, state: ConversationEngineState): ConversationSlot | null {
  const pendingSlotKey = state.pendingSlotKey;

  if (pendingSlotKey === null) {
    return null;
  }

  return getRequiredSlots(scenario).find((slot) => slot.key === pendingSlotKey) ?? null;
}

function uniqueSlotKeys(slotKeys: string[], requiredSlotKeys: Set<string>) {
  return [...new Set(slotKeys)].filter((slotKey) => requiredSlotKeys.has(slotKey));
}

function isNameSlot(slot: ConversationSlot) {
  return slot.key.toLowerCase() === 'name' ||
    /\bname\b/i.test(`${slot.label} ${slot.prompt}`);
}

function isDocumentHandoffSlot(slot: ConversationSlot) {
  return /\b(id|passport|license|document)\b/i.test(`${slot.key} ${slot.label} ${slot.prompt}`);
}

function looksLikeDocumentHandoffAnswer(text: string) {
  const normalizedText = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .replace(/\s+/g, ' ');

  return /^(yes\s+)?here\s+(it\s+is|you\s+go|you\s+are|is)(\s+(this|my|the|passport|id|license))?$/.test(normalizedText) ||
    /^(yes|of course|sure|certainly)(\s+here\s+(it\s+is|you\s+go|you\s+are|is))?$/.test(normalizedText);
}

function looksLikeBareNameAnswer(text: string) {
  const trimmedText = text.trim();
  const words = trimmedText.match(/[a-z][a-z'-]*/gi) ?? [];
  const nonNameCharacters = trimmedText
    .replace(/[a-z][a-z'-]*/gi, '')
    .replace(/[\s.,'-]/g, '');

  return words.length >= 2 &&
    words.length <= 4 &&
    nonNameCharacters.length === 0 &&
    words.every((word) => {
      const normalizedWord = word.toLowerCase();

      return normalizedWord.length >= 2 && !bareNameRejectWords.has(normalizedWord);
    });
}

function getSlotExample(scenario: Scenario, slot: ConversationSlot): string {
  const slotDescriptor = [
    scenario.id,
    scenario.titleEn,
    slot.key,
    slot.label,
    slot.prompt,
  ].join(' ').toLowerCase();
  const rule = slotExampleRules.find((candidate) => candidate.pattern.test(slotDescriptor));

  if (rule) {
    return rule.example;
  }

  const targetExpression = scenario.targetExpressions.find((expression) => {
    return /[a-z]/i.test(expression) && !expression.includes('...');
  });

  return targetExpression ?? 'Could you tell me that again?';
}

function isScenarioRelatedEnglish(scenario: Scenario, text: string): boolean {
  if (!englishWordPattern.test(text)) {
    return false;
  }

  if (helpRequestPattern.test(text)) {
    return true;
  }

  const normalizedText = text.toLowerCase();
  const relatedTerms = [
    scenario.titleEn,
    scenario.aiRole,
    scenario.userRole,
    ...scenario.targetExpressions,
    ...scenario.successCriteria,
    ...getRequiredSlots(scenario).flatMap((slot) => [slot.label, slot.prompt]),
  ];

  return relatedTerms.some((term) => {
    const normalizedTerm = term.toLowerCase();
    const words = normalizedTerm.match(/[a-z][a-z']+/g) ?? [];

    return words.some((word) => {
      return word.length >= 4 &&
        !scenarioRelationStopWords.has(word) &&
        normalizedText.includes(word);
    });
  });
}

function isKoreanOnly(text: string): boolean {
  return koreanPattern.test(text) && !englishWordPattern.test(text);
}

function isNoise(text: string): boolean {
  return !wordPattern.test(text);
}
