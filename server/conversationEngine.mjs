const terminalMessages = {
  goal_completed: '',
  max_turns: "Let's stop here and review your conversation.",
  too_many_failures: "Let's stop here and review your English together.",
  no_progress: "Let's stop here and review this situation together.",
};

const knownSkillTags = new Set([
  'polite_requests',
  'articles',
  'numbers_dates',
  'question_comprehension',
  'prepositions',
  'vocabulary_range',
  'verb_tense',
  'clarification',
  'natural_phrasing',
  'task_completion',
]);

const validTurnTypes = new Set(['progress', 'no_progress', 'off_topic', 'unclear']);
const validEndReasons = new Set(['goal_completed', 'max_turns', 'too_many_failures', 'no_progress']);
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

const slotExampleRules = [
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

const restaurantRequestPhrases = [
  "i'd like",
  'i would like',
  'i want',
  'i need',
  "i'll have",
  'i will have',
  'can i get',
  'could i get',
  'can i have',
  'could i have',
  'may i get',
  'may i have',
  'please bring',
  'could you bring',
  'would you bring',
  'bring me',
  'order',
];

const restaurantRequestFillerWords = new Set([
  'a',
  'an',
  'and',
  'any',
  'bring',
  'can',
  'could',
  'else',
  'get',
  'have',
  'i',
  "i'd",
  "i'll",
  'like',
  'may',
  'me',
  'more',
  'need',
  'order',
  'please',
  'some',
  'the',
  'want',
  'will',
  'would',
  'you',
]);

export function createInitialConversationEngineState(scenario) {
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

export function getConversationEngineFailureCount(state) {
  return toNonNegativeInteger(state?.offTopicCount) + toNonNegativeInteger(state?.unclearCount);
}

export function interpretUserTurnWithFallback(scenario, userMessage) {
  const text = String(userMessage ?? '').trim();
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
    shortReasonKo: '상황과 다른 대답이에요.',
  });
}

export function reduceConversationTurn({ scenario, state, interpretation }) {
  if (state.status !== 'active' || state.endReason !== null) {
    return state;
  }

  const normalizedInterpretation = normalizeInterpreterOutput(interpretation, scenario);
  const requiredSlots = getRequiredSlots(scenario);
  const requiredSlotKeys = new Set(requiredSlots.map((slot) => slot.key));
  const newlyFilledSlotKeys = normalizedInterpretation.filledSlotKeys.filter((slotKey) => {
    return requiredSlotKeys.has(slotKey) && !state.filledSlotKeys.includes(slotKey);
  });
  const filledSlotKeys = uniqueSlotKeys([...state.filledSlotKeys, ...newlyFilledSlotKeys], requiredSlotKeys);
  const madeProgress = newlyFilledSlotKeys.length > 0;
  const turnType = madeProgress || normalizedInterpretation.turnType !== 'progress'
    ? normalizedInterpretation.turnType
    : 'no_progress';
  const pendingSlotBeforeTurn = getPendingSlot(scenario, state);
  const shouldSkipPendingSlot =
    !madeProgress &&
    turnType === 'no_progress' &&
    normalizedInterpretation.isUnderstandable &&
    normalizedInterpretation.isOnTopic &&
    pendingSlotBeforeTurn !== null;
  const skippedSlotKeys = uniqueSlotKeys(
    [
      ...(Array.isArray(state.skippedSlotKeys) ? state.skippedSlotKeys : []),
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
    maxUserTurns: scenario?.maxUserTurns,
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

export function runConversationEngineTurn({ scenario, previousMessages, state, userMessage, interpretation }) {
  void previousMessages;

  const startingState = normalizeStateForTurn(state, scenario);
  const baseInterpretation = normalizeInterpreterOutput(
    interpretation ?? interpretUserTurnWithFallback(scenario, userMessage),
    scenario,
  );
  const nameAwareInterpretation = promotePendingNameInterpretation({
    scenario,
    state: startingState,
    userMessage,
    interpretation: baseInterpretation,
  });
  const normalizedInterpretation = promotePendingDocumentHandoffInterpretation({
    scenario,
    state: startingState,
    userMessage,
    interpretation: nameAwareInterpretation,
  });
  const reducedState = reduceConversationTurn({
    scenario,
    state: startingState,
    interpretation: normalizedInterpretation,
  });
  const action = getAssistantAction({
    scenario,
    state: reducedState,
    previousState: startingState,
    userMessage,
  });
  const engineState = {
    ...reducedState,
    lastPromptKey: action.key.startsWith('slot:') ? reducedState.pendingSlotKey : reducedState.lastPromptKey,
    lastAssistantActionKey: action.key,
  };

  return {
    message: {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: action.content,
      createdAt: new Date().toISOString(),
    },
    userAnalysis: createUserAnalysis(normalizedInterpretation),
    communicationFailed: normalizedInterpretation.turnType === 'off_topic' || normalizedInterpretation.turnType === 'unclear',
    shouldEndSession: engineState.status !== 'active',
    endReason: engineState.endReason,
    engineState,
  };
}

function normalizeStateForTurn(state, scenario) {
  const normalizedState = normalizeConversationEngineState(state, scenario);

  if (!isPlainObject(state) || (state.status === 'active' && state.endReason === null)) {
    return normalizedState;
  }

  if (validEndReasons.has(state.endReason)) {
    return {
      ...normalizedState,
      status: getStatus(state.endReason),
      endReason: state.endReason,
    };
  }

  return normalizedState;
}

export function normalizeConversationEngineState(value, scenario) {
  const initialState = createInitialConversationEngineState(scenario);
  const source = isPlainObject(value) ? value : {};
  const requiredSlots = getRequiredSlots(scenario);
  const requiredSlotKeys = new Set(requiredSlots.map((slot) => slot.key));
  const filledSlotKeys = uniqueStrings(source.filledSlotKeys).filter((slotKey) => requiredSlotKeys.has(slotKey));
  const skippedSlotKeys = uniqueStrings(source.skippedSlotKeys)
    .filter((slotKey) => requiredSlotKeys.has(slotKey) && !filledSlotKeys.includes(slotKey));
  const pendingSlotKey = requiredSlots.find((slot) => {
    return !filledSlotKeys.includes(slot.key) && !skippedSlotKeys.includes(slot.key);
  })?.key ?? null;
  const allSlotsFilled = requiredSlots.every((slot) => filledSlotKeys.includes(slot.key));
  const noProgressCount = toNonNegativeInteger(source.noProgressCount);
  const offTopicCount = toNonNegativeInteger(source.offTopicCount);
  const unclearCount = toNonNegativeInteger(source.unclearCount);
  const userTurnCount = toNonNegativeInteger(source.userTurnCount);
  const endReason = getEndReason({
    allSlotsFilled,
    slotsExhausted: pendingSlotKey === null && !allSlotsFilled,
    noProgressCount,
    offTopicCount,
    unclearCount,
    userTurnCount,
    maxUserTurns: scenario?.maxUserTurns,
  });

  return {
    ...initialState,
    filledSlotKeys,
    skippedSlotKeys,
    pendingSlotKey,
    lastPromptKey: typeof source.lastPromptKey === 'string' ? source.lastPromptKey : null,
    lastAssistantActionKey: typeof source.lastAssistantActionKey === 'string' ? source.lastAssistantActionKey : null,
    lastTurnType: validTurnTypes.has(source.lastTurnType) ? source.lastTurnType : null,
    repeatedPromptCount: toNonNegativeInteger(source.repeatedPromptCount),
    noProgressCount,
    offTopicCount,
    unclearCount,
    userTurnCount,
    status: getStatus(endReason),
    endReason,
  };
}

export function bootstrapConversationEngineState(scenario, messages, legacyFailureCount = 0) {
  const state = createInitialConversationEngineState(scenario);
  const userMessages = Array.isArray(messages)
    ? messages.filter((message) => message?.role === 'user')
    : [];

  for (const message of userMessages) {
    const interpretation = interpretUserTurnWithFallback(scenario, message.content ?? '');
    for (const slotKey of interpretation.filledSlotKeys) {
      if (!state.filledSlotKeys.includes(slotKey)) {
        state.filledSlotKeys.push(slotKey);
      }
    }
  }

  const requiredSlots = getRequiredSlots(scenario);
  const pendingSlotKey = requiredSlots.find((slot) => !state.filledSlotKeys.includes(slot.key))?.key ?? null;
  const endReason = getEndReason({
    allSlotsFilled: pendingSlotKey === null,
    slotsExhausted: false,
    noProgressCount: 0,
    offTopicCount: 0,
    unclearCount: toNonNegativeInteger(legacyFailureCount),
    userTurnCount: userMessages.length,
    maxUserTurns: scenario?.maxUserTurns,
  });

  return {
    ...state,
    pendingSlotKey,
    unclearCount: toNonNegativeInteger(legacyFailureCount),
    userTurnCount: userMessages.length,
    status: getStatus(endReason),
    endReason,
  };
}

export function normalizeInterpreterOutput(value, scenario) {
  const source = isPlainObject(value) ? value : {};
  const requiredSlotKeys = new Set(getRequiredSlots(scenario).map((slot) => slot.key));
  const confidence = toConfidence(source.confidence);
  const originalTurnType = validTurnTypes.has(source.turnType) ? source.turnType : 'no_progress';
  let filledSlotKeys = uniqueStrings(source.filledSlotKeys).filter((slotKey) => requiredSlotKeys.has(slotKey));

  if (confidence < 0.6) {
    filledSlotKeys = [];
  }

  const isUnderstandable = typeof source.isUnderstandable === 'boolean'
    ? source.isUnderstandable
    : originalTurnType !== 'unclear';
  const isOnTopic = typeof source.isOnTopic === 'boolean'
    ? source.isOnTopic
    : originalTurnType !== 'off_topic' && isUnderstandable;
  let turnType = originalTurnType;

  if (!isUnderstandable) {
    turnType = 'unclear';
  } else if (!isOnTopic) {
    turnType = 'off_topic';
  } else if (originalTurnType === 'progress' && filledSlotKeys.length === 0) {
    turnType = 'no_progress';
  }

  if (turnType !== 'progress' || !isUnderstandable || !isOnTopic || confidence < 0.6) {
    filledSlotKeys = [];
  }

  return createInterpretation({
    isUnderstandable,
    isOnTopic,
    turnType,
    filledSlotKeys,
    confidence,
    correctedSentence: typeof source.correctedSentence === 'string' && source.correctedSentence.trim()
      ? source.correctedSentence
      : null,
    detectedIssueTags: uniqueStrings(source.detectedIssueTags).filter((tag) => knownSkillTags.has(tag)),
    shortReasonKo: typeof source.shortReasonKo === 'string' && source.shortReasonKo.trim()
      ? source.shortReasonKo
      : null,
  });
}

function getRequiredSlots(scenario) {
  return Array.isArray(scenario?.requiredSlots)
    ? scenario.requiredSlots.filter((slot) => slot && slot.required !== false && typeof slot.key === 'string')
    : [];
}

function slotMatches(slot, text, scenario) {
  const normalizedText = text.toLowerCase();
  const matchKeywords = Array.isArray(slot.matchKeywords) ? slot.matchKeywords : [];

  return matchKeywords.some((keyword) => keywordMatches(keyword, normalizedText)) ||
    restaurantRequestSlotMatches(slot, normalizedText, scenario) ||
    reasonSlotMatches(slot, normalizedText);
}

function restaurantRequestSlotMatches(slot, text, scenario) {
  if (
    !String(scenario?.id ?? '').includes('restaurant') ||
    (slot.key !== 'requestItem' &&
      String(slot.label ?? '').toLowerCase() !== 'restaurant request')
  ) {
    return false;
  }

  return restaurantRequestPhrases.some((phrase) => {
    const phrasePattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'ig');

    return [...text.matchAll(phrasePattern)].some((match) => {
      const matchEnd = (match.index ?? 0) + match[0].length;
      const sameSentenceTail = text.slice(matchEnd).split(/[.!?]/)[0];

      return hasRestaurantRequestObject(sameSentenceTail);
    });
  });
}

function hasRestaurantRequestObject(requestTail) {
  return (requestTail.match(/[a-z][a-z']*/gi) ?? []).some((word) => {
    return word.length >= 3 && !restaurantRequestFillerWords.has(word.toLowerCase());
  });
}

function reasonSlotMatches(slot, text) {
  const descriptor = `${slot?.key ?? ''} ${slot?.label ?? ''} ${slot?.prompt ?? ''}`.toLowerCase();

  if (!/\breason\b|why do you need/.test(descriptor)) {
    return false;
  }

  return /\b(because|accident|emergency|urgent|appointment|work|school|sick|traffic|busy|late|family|doctor|problem|something came up|something happened|came up)\b/.test(text);
}

function keywordMatches(keyword, text) {
  const normalizedKeyword = String(keyword ?? '').toLowerCase().trim();

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(' ')) {
    return text.includes(normalizedKeyword);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, 'i').test(text);
}

function createInterpretation(interpretation) {
  return {
    correctedSentence: null,
    detectedIssueTags: [],
    shortReasonKo: null,
    ...interpretation,
  };
}

function createUserAnalysis(interpretation) {
  return {
    isRelevant: interpretation.isOnTopic,
    isUnderstandable: interpretation.isUnderstandable,
    detectedIssues: interpretation.detectedIssueTags,
    ...(interpretation.correctedSentence ? { correctedSentence: interpretation.correctedSentence } : {}),
    ...(interpretation.shortReasonKo ? { shortReasonKo: interpretation.shortReasonKo } : {}),
  };
}

function promotePendingNameInterpretation({ scenario, state, userMessage, interpretation }) {
  const pendingSlot = getPendingSlot(scenario, state);

  if (
    !pendingSlot ||
    !isNameSlot(pendingSlot) ||
    !looksLikeBareNameAnswer(userMessage)
  ) {
    return interpretation;
  }

  return createInterpretation({
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys: [...new Set([...interpretation.filledSlotKeys, pendingSlot.key])],
    confidence: Math.max(interpretation.confidence, 0.85),
  });
}

function promotePendingDocumentHandoffInterpretation({ scenario, state, userMessage, interpretation }) {
  const pendingSlot = getPendingSlot(scenario, state);

  if (
    !pendingSlot ||
    !isDocumentHandoffSlot(pendingSlot) ||
    !looksLikeDocumentHandoffAnswer(userMessage)
  ) {
    return interpretation;
  }

  return createInterpretation({
    isUnderstandable: true,
    isOnTopic: true,
    turnType: 'progress',
    filledSlotKeys: [...new Set([...interpretation.filledSlotKeys, pendingSlot.key])],
    confidence: Math.max(interpretation.confidence, 0.85),
  });
}

function getEndReason({
  allSlotsFilled,
  slotsExhausted,
  noProgressCount,
  offTopicCount,
  unclearCount,
  userTurnCount,
  maxUserTurns,
}) {
  return allSlotsFilled
    ? 'goal_completed'
    : offTopicCount + unclearCount >= 3
      ? 'too_many_failures'
      : slotsExhausted || noProgressCount >= 3
        ? 'no_progress'
        : userTurnCount >= toPositiveInteger(maxUserTurns, Number.POSITIVE_INFINITY)
          ? 'max_turns'
          : null;
}

function getStatus(endReason) {
  if (endReason === 'goal_completed') {
    return 'completed';
  }

  if (endReason !== null) {
    return 'ended';
  }

  return 'active';
}

function getAssistantAction(input) {
  const selectedAction = selectAssistantAction(input);

  if (selectedAction.key !== input.previousState.lastAssistantActionKey) {
    return selectedAction;
  }

  if (selectedAction.key.startsWith('repair:')) {
    return selectedAction;
  }

  return selectNextHigherAction(input) ?? selectedAction;
}

function selectAssistantAction(input) {
  const { scenario, state, userMessage } = input;

  if (state.endReason === 'goal_completed') {
    return {
      key: 'end:goal_completed',
      content: scenario?.completionMessage ?? '',
    };
  }

  if (state.endReason !== null) {
    return {
      key: `end:${state.endReason}`,
      content: terminalMessages[state.endReason] ?? '',
    };
  }

  if (state.lastTurnType === 'unclear') {
    return {
      key: isKoreanOnly(String(userMessage ?? '')) ? 'repair:korean_only' : 'repair:unclear',
      content: isKoreanOnly(String(userMessage ?? ''))
        ? scenario?.repairPolicy?.koreanOnly ?? 'Please try saying that in English.'
        : scenario?.repairPolicy?.unclear ?? 'Sorry, could you say that again in English?',
    };
  }

  if (state.lastTurnType === 'off_topic') {
    return {
      key: 'repair:off_topic',
      content: scenario?.repairPolicy?.offTopic ?? "Let's come back to the situation.",
    };
  }

  return getSlotPromptAction(scenario, state, getActiveSlotPromptStage(input.previousState, state));
}

function selectNextHigherAction({ scenario, state }) {
  if (state.endReason !== null || state.pendingSlotKey === null) {
    return null;
  }

  return getSlotPromptAction(scenario, state, state.repeatedPromptCount + 1);
}

function getActiveSlotPromptStage(previousState, state) {
  if (state.repeatedPromptCount === 0) {
    return 0;
  }

  if (previousState.lastAssistantActionKey === null && previousState.repeatedPromptCount > 0) {
    return state.repeatedPromptCount;
  }

  return previousState.repeatedPromptCount;
}

function getSlotPromptAction(scenario, state, repeatedPromptCount) {
  const slot = getPendingSlot(scenario, state);

  if (!slot) {
    return {
      key: 'end:goal_completed',
      content: scenario?.completionMessage ?? '',
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

function getPendingSlot(scenario, state) {
  const pendingSlotKey = state.pendingSlotKey;

  if (pendingSlotKey === null) {
    return null;
  }

  return getRequiredSlots(scenario).find((slot) => slot.key === pendingSlotKey) ?? null;
}

function isNameSlot(slot) {
  return String(slot.key ?? '').toLowerCase() === 'name' ||
    /\bname\b/i.test(`${slot.label ?? ''} ${slot.prompt ?? ''}`);
}

function isDocumentHandoffSlot(slot) {
  return /\b(id|passport|license|document)\b/i.test(`${slot.key ?? ''} ${slot.label ?? ''} ${slot.prompt ?? ''}`);
}

function looksLikeDocumentHandoffAnswer(text) {
  const normalizedText = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z'\s]/g, ' ')
    .replace(/\s+/g, ' ');

  return /^(yes\s+)?here\s+(it\s+is|you\s+go|you\s+are|is)(\s+(this|my|the|passport|id|license))?$/.test(normalizedText) ||
    /^(yes|of course|sure|certainly)(\s+here\s+(it\s+is|you\s+go|you\s+are|is))?$/.test(normalizedText);
}

function looksLikeBareNameAnswer(text) {
  const trimmedText = String(text ?? '').trim();
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

function getSlotExample(scenario, slot) {
  const slotDescriptor = [
    scenario?.id,
    scenario?.titleEn,
    slot?.key,
    slot?.label,
    slot?.prompt,
  ].join(' ').toLowerCase();
  const rule = slotExampleRules.find((candidate) => candidate.pattern.test(slotDescriptor));

  if (rule) {
    return rule.example;
  }

  const targetExpression = Array.isArray(scenario?.targetExpressions)
    ? scenario.targetExpressions.find((expression) => /[a-z]/i.test(expression) && !expression.includes('...'))
    : null;

  return targetExpression ?? 'Could you tell me that again?';
}

function isScenarioRelatedEnglish(scenario, text) {
  if (!englishWordPattern.test(text)) {
    return false;
  }

  if (helpRequestPattern.test(text)) {
    return true;
  }

  const normalizedText = text.toLowerCase();
  const relatedTerms = [
    scenario?.titleEn,
    scenario?.aiRole,
    scenario?.userRole,
    ...(Array.isArray(scenario?.targetExpressions) ? scenario.targetExpressions : []),
    ...(Array.isArray(scenario?.successCriteria) ? scenario.successCriteria : []),
    ...getRequiredSlots(scenario).flatMap((slot) => [slot.label, slot.prompt]),
  ].filter((term) => typeof term === 'string');

  return relatedTerms.some((term) => {
    const words = term.toLowerCase().match(/[a-z][a-z']+/g) ?? [];

    return words.some((word) => (
      word.length >= 4 &&
      !scenarioRelationStopWords.has(word) &&
      normalizedText.includes(word)
    ));
  });
}

function isKoreanOnly(text) {
  return koreanPattern.test(text) && !englishWordPattern.test(text);
}

function isNoise(text) {
  return !wordPattern.test(text);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === 'string'))];
}

function uniqueSlotKeys(slotKeys, requiredSlotKeys) {
  return [...new Set(slotKeys)].filter((slotKey) => requiredSlotKeys.has(slotKey));
}

function toNonNegativeInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function toPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function toConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
