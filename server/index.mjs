import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { onRequest } from 'firebase-functions/v2/https';
import {
  bootstrapConversationEngineState,
  interpretUserTurnWithFallback,
  normalizeConversationEngineState,
  normalizeInterpreterOutput,
  runConversationEngineTurn,
} from './conversationEngine.mjs';
import { checkAndConsumeAiQuota } from './usageQuota.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotEnv(join(__dirname, '.secret.local'));
loadDotEnv(join(__dirname, '.env.local'));
loadDotEnv(join(__dirname, '.env'));

const PORT = Number(process.env.PORT ?? 3001);
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const WRITING_CORRECT_SCORE_THRESHOLD = 75;
const WRITING_FRIEND_INTRODUCTION_MIN_SCORE = 80;
const WRITING_HIGH_CONFIDENCE_CORRECT_SCORE = 90;
const WRITING_FULL_SCORE = 100;
const WRITING_MIN_ENGLISH_TOKEN_COUNT = 2;
const WRITING_MIN_KOREAN_TRANSLATION_KEYWORD_HITS = 2;
const WRITING_READING_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const WRITING_LOW_QUALITY_REPLACEMENT_TOKENS = new Set([
  'abc',
  'anything',
  'asdf',
  'chair',
  'desk',
  'door',
  'object',
  'qwerty',
  'something',
  'stuff',
  'table',
  'test',
  'thing',
  'wall',
  'word',
]);
const WRITING_WORK_DOCUMENT_TOKENS = new Set([
  'document',
  'file',
  'paper',
  'report',
]);
const WRITING_SEND_REQUEST_TOKENS = new Set([
  'forward',
  'send',
  'share',
]);
const WRITING_REFUND_REQUEST_VERB_TOKENS = new Set([
  'get',
  'have',
  'receive',
  'request',
]);
const WRITING_POSITIVE_MOOD_TOKENS = new Set([
  'excited',
  'fine',
  'good',
  'great',
  'happy',
  'ok',
  'okay',
  'well',
]);
const WRITING_FEELING_VERB_TOKENS = new Set(['feel', 'feeling']);
const WRITING_ENGLISH_CONTRACTION_EXPANSIONS = {
  "aren't": 'are not',
  "can't": 'can not',
  "couldn't": 'could not',
  "didn't": 'did not',
  "doesn't": 'does not',
  "don't": 'do not',
  "hadn't": 'had not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "i'm": 'i am',
  "isn't": 'is not',
  "shouldn't": 'should not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "won't": 'will not',
  "wouldn't": 'would not',
};
const WRITING_NEGATIVE_PREFERENCE_STRUCTURE_TOKENS = new Set([
  'a',
  'an',
  'did',
  'do',
  'does',
  'i',
  'like',
  'not',
  'the',
]);
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

const skillTags = [
  'polite_requests',
  'articles',
  'prepositions',
  'verb_tense',
  'question_comprehension',
  'vocabulary_range',
  'clarification',
  'numbers_dates',
  'natural_phrasing',
  'task_completion',
];

const roleplaySlotConfigs = {
  cafe: {
    completionMessage: "Got it. I'll have that ready at the pickup counter.",
    slots: [
      {
        key: 'drink',
        label: 'drink',
        pattern: /\b(coffee|americano|latte|tea|cappuccino|mocha|espresso|juice|water)\b/i,
        questionPattern: /\b(what can i get|what would you like|what drink)\b/i,
        question: 'Sure. What would you like to drink?',
      },
      {
        key: 'size',
        label: 'size',
        pattern: /\b(small|medium|large|tall|grande|venti)\b/i,
        questionPattern: /\b(what size|which size|size would)\b/i,
        question: 'Sure. What size would you like?',
      },
      {
        key: 'temperature',
        label: 'hot or iced choice',
        pattern: /\b(hot|iced|ice)\b/i,
        questionPattern: /\b(hot or iced|hot or ice|would you like it hot)\b/i,
        question: 'Would you like it hot or iced?',
      },
      {
        key: 'diningOption',
        label: 'for here or to go',
        pattern: /\b(to go|takeout|take out|for here|dine in)\b/i,
        questionPattern: /\b(for here|to go|takeout|take out)\b/i,
        question: 'Is that for here or to go?',
      },
    ],
  },
  airport: {
    completionMessage: 'Great. Here is your boarding pass. Boarding starts at gate 12.',
    slots: [
      {
        key: 'passport',
        label: 'passport',
        pattern: /\b(passport|here it is|here you go)\b/i,
        questionPattern: /\b(passport)\b/i,
        question: 'May I see your passport, please?',
      },
      {
        key: 'destination',
        label: 'destination',
        pattern: /\b(destination|seoul|tokyo|new york|london|paris|los angeles|busan|jeju|to [a-z]+)\b/i,
        questionPattern: /\b(destination|where are you flying|where to)\b/i,
        question: 'Where are you flying today?',
      },
      {
        key: 'bags',
        label: 'checked bags',
        pattern: /\b(bag|bags|luggage|suitcase|checked|carry-on|carry on|no bags|one bag|two bags)\b/i,
        questionPattern: /\b(bag|bags|luggage)\b/i,
        question: 'Do you have any bags to check?',
      },
      {
        key: 'seat',
        label: 'seat preference',
        pattern: /\b(window|aisle|middle seat)\b/i,
        questionPattern: /\b(window|aisle|seat preference)\b/i,
        question: 'Would you prefer a window seat or an aisle seat?',
      },
    ],
  },
  hotel: {
    completionMessage: "Perfect. You're all set. Your reservation is confirmed.",
    slots: [
      {
        key: 'dates',
        label: 'stay dates',
        pattern: /\b(date|dates|tonight|tomorrow|night|nights|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
        questionPattern: /\b(date|dates|when|how many nights)\b/i,
        question: 'What dates would you like to stay?',
      },
      {
        key: 'room',
        label: 'room type',
        pattern: /\b(room|single|double|twin|queen|king|suite)\b/i,
        questionPattern: /\b(room type|what type of room|single or double)\b/i,
        question: 'What type of room would you like?',
      },
      {
        key: 'guests',
        label: 'guest count',
        pattern: /\b(guest|guests|people|person|one|two|three|four|1|2|3|4)\b/i,
        questionPattern: /\b(how many guests|how many people)\b/i,
        question: 'How many guests will be staying?',
      },
      {
        key: 'name',
        label: 'guest name',
        pattern: /\b(my name is|i am|i'm|this is)\b/i,
        questionPattern: /\b(name|may i have your name)\b/i,
        question: 'May I have your name for the reservation?',
      },
    ],
  },
  hotelCheckin: {
    completionMessage: "Perfect. You're checked in. Here is your room key.",
    slots: [
      {
        key: 'reservation',
        label: 'reservation',
        pattern: /\b(reservation|booking|booked|check in|check-in|i have a room|i have a reservation)\b/i,
        questionPattern: /\b(reservation|booking|check in|check-in|how can i help)\b/i,
        question: 'Do you have a reservation?',
      },
      {
        key: 'name',
        label: 'guest name',
        pattern: /\b(my name is|i am|i'm|this is|under [a-z]+|name is)\b/i,
        questionPattern: /\b(name|may i have your name|under what name)\b/i,
        question: 'May I have your name, please?',
      },
      {
        key: 'id',
        label: 'id or passport',
        pattern: /\b(id|passport|here it is|here you go|driver's license|license)\b/i,
        questionPattern: /\b(id|passport|identification)\b/i,
        question: 'May I see your ID or passport?',
      },
    ],
  },
  directions: {
    completionMessage: 'Sure. Go straight for two blocks, then turn left. It will be on your right.',
    slots: [
      {
        key: 'destination',
        label: 'destination',
        pattern: /\b(station|subway|bus stop|airport|hotel|cafe|restaurant|museum|bank|pharmacy|hospital|restroom|bathroom|toilet|store|market|library|park|street|exit|gate|where is|how do i get to|looking for|go to|get to)\b/i,
        questionPattern: /\b(where would you like to go|where are you trying to go|destination|looking for)\b/i,
        question: 'Where would you like to go?',
      },
      {
        key: 'currentLocation',
        label: 'current location',
        pattern: /\b(i am at|i'm at|i am near|i'm near|near|around here|from here|at the|in front of|next to|beside)\b/i,
        questionPattern: /\b(where are you now|where are you starting from|are you near|from here)\b/i,
        question: 'Where are you now?',
      },
      {
        key: 'travelMode',
        label: 'travel mode',
        pattern: /\b(walk|walking|on foot|bus|subway|train|taxi|car|drive|driving|by bus|by subway|by train|by taxi)\b/i,
        questionPattern: /\b(are you walking|walking or|taking a bus|how will you get there)\b/i,
        question: 'Are you walking or taking transportation?',
      },
    ],
  },
  plans: {
    completionMessage: "No problem. Let's change it to that time.",
    slots: [
      {
        key: 'originalPlan',
        label: 'original plan',
        pattern: /\b(plan|plans|meet|meeting|appointment|reservation|dinner|lunch|coffee|movie|class|call|today|tonight|tomorrow)\b/i,
        questionPattern: /\b(which plan|what plan|what are we changing|our plan)\b/i,
        question: 'Which plan do you need to change?',
      },
      {
        key: 'newTime',
        label: 'new time',
        pattern: /\b(later|earlier|tomorrow|tonight|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|at \d{1,2}|[0-9]{1,2}(:[0-9]{2})?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
        questionPattern: /\b(what time|when|new time|what day|works for you)\b/i,
        question: 'What new time works for you?',
      },
      {
        key: 'reason',
        label: 'reason for changing plans',
        pattern: /\b(because|sorry|i can't|i cannot|can not|busy|late|work|school|sick|family|something came up|something happened|traffic|appointment|accident|emergency|urgent|problem|doctor)\b/i,
        questionPattern: /\b(why|what happened|is everything okay|reason)\b/i,
        question: 'Why do you need to change it?',
      },
    ],
  },
  restaurant: {
    completionMessage: "Of course. I'll bring that right away.",
    slots: [
      {
        key: 'requestItem',
        label: 'restaurant request',
        pattern: /\b(water|menu|bill|check|fork|knife|spoon|napkin|tissue|plate|glass|straw|salt|pepper|sauce|refill|table|seat|recommendation|vegetarian|allergy|not spicy|less spicy|no onion|without|another|extra)\b/i,
        questionPattern: /\b(what do you need|what can i bring|anything else|request)\b/i,
        question: 'What would you like me to bring?',
      },
      {
        key: 'politeRequest',
        label: 'polite request',
        pattern: /\b(please|could i|could we|can i|can we|may i|would you|would it be possible|excuse me)\b/i,
        questionPattern: /\b(could you ask politely|please|how can you ask)\b/i,
        question: 'Could you ask politely?',
      },
    ],
  },
};

export async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null);
    return;
  }

  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        model: OPENAI_MODEL,
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/conversation/respond') {
      if (!(await enforceAiQuota(request, response, 'conversation.respond'))) {
        return;
      }

      const body = await readJsonBody(request);
      const actorOutput = await createActorResponse(body);
      sendJson(response, 200, actorOutput);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/conversation/evaluate') {
      if (!(await enforceAiQuota(request, response, 'conversation.evaluate'))) {
        return;
      }

      const body = await readJsonBody(request);
      const evaluation = await createEvaluation(body);
      sendJson(response, 200, evaluation);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/writing/evaluate') {
      if (!(await enforceAiQuota(request, response, 'writing.evaluate'))) {
        return;
      }

      const body = await readJsonBody(request);
      const evaluation = await createWritingEvaluation(body);
      sendJson(response, 200, evaluation);
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const status = message.includes('OPENAI_API_KEY') ? 500 : 400;
    sendJson(response, status, { error: message });
  }
}

async function enforceAiQuota(request, response, operation) {
  const quota = await checkAndConsumeAiQuota(request, operation);

  if (quota.allowed) {
    return true;
  }

  sendJson(response, quota.status, quota.payload);
  return false;
}

export function createAiServer() {
  return createServer(handleRequest);
}

export const api = onRequest(
  {
    region: 'us-central1',
    secrets: ['OPENAI_API_KEY'],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  handleRequest,
);

if (process.argv[1] === __filename) {
  createAiServer().listen(PORT, () => {
    console.log(`EnglishProject AI server listening on http://localhost:${PORT}`);
  });
}

async function createActorResponse(body) {
  assertScenario(body.scenario);
  assertString(body.userMessage, 'userMessage');

  const scenario = body.scenario;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const failureCount = Number(body.failureCount ?? 0);
  const transcript = compactTranscript(messages);
  const conversationState = buildConversationState(scenario, [...messages, { role: 'user', content: body.userMessage }]);

  const interpreterOutput = await callOpenAIJson({
    name: 'conversation_interpreter_response',
    systemPrompt: buildInterpreterPrompt(),
    userPayload: {
      scenario,
      userMessage: body.userMessage,
      transcript,
      conversationState,
      state: {
        failureCount,
        engineState: body.engineState ?? null,
        maxUserTurns: scenario.maxUserTurns,
      },
    },
    schema: interpreterResponseSchema(),
    maxOutputTokens: 700,
  });

  return createConversationResponseFromInterpretation({
    scenario,
    userMessage: body.userMessage,
    messages,
    failureCount,
    engineState: body.engineState,
    interpreterOutput,
  });
}

export function createConversationResponseFromInterpretation({
  scenario,
  userMessage,
  messages,
  failureCount,
  engineState,
  interpreterOutput,
}) {
  const normalizedState = engineState && typeof engineState === 'object'
    ? normalizeConversationEngineState(engineState, scenario)
    : bootstrapConversationEngineState(scenario, messages, Number(failureCount ?? 0));
  const interpretation = interpreterOutput?.interpretation
    ?? interpretUserTurnWithFallback(scenario, userMessage);

  return toActorApiResponse(runConversationEngineTurn({
    scenario,
    previousMessages: messages,
    state: normalizedState,
    userMessage,
    interpretation: normalizeInterpreterOutput(interpretation, scenario),
  }));
}

function toActorApiResponse(engineResult) {
  const userAnalysis = engineResult?.userAnalysis ?? {};

  return {
    message: String(engineResult?.message?.content ?? ''),
    isUserUnderstandable: Boolean(userAnalysis.isUnderstandable),
    isUserRelevant: Boolean(userAnalysis.isRelevant),
    shouldEndSession: Boolean(engineResult?.shouldEndSession),
    endReason: engineResult?.endReason ?? null,
    detectedIssueTags: Array.isArray(userAnalysis.detectedIssues) ? userAnalysis.detectedIssues : [],
    correctedSentence: typeof userAnalysis.correctedSentence === 'string' ? userAnalysis.correctedSentence : null,
    shortReasonKo: typeof userAnalysis.shortReasonKo === 'string' ? userAnalysis.shortReasonKo : null,
    engineState: engineResult?.engineState ?? null,
  };
}

async function createEvaluation(body) {
  assertScenario(body.scenario);

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const communicationFailureCount = Number(body.communicationFailureCount ?? 0);

  const evaluation = await callOpenAIJson({
    name: 'conversation_evaluation',
    systemPrompt: buildEvaluatorPrompt(),
    userPayload: {
      scenario: body.scenario,
      messages,
      communicationFailureCount,
    },
    schema: evaluationSchema(),
    maxOutputTokens: 1800,
  });

  return normalizeEvaluation(evaluation, {
    scenario: body.scenario,
    engineState: body.engineState ?? null,
    endReason: body.endReason ?? body.engineState?.endReason ?? null,
  });
}

async function createWritingEvaluation(body) {
  const question = assertWritingQuestion(body.question);

  if (typeof body.answer !== 'string') {
    throw new Error('answer is required.');
  }

  const evaluation = await callOpenAIJson({
    name: 'writing_evaluation',
    systemPrompt: buildWritingEvaluatorPrompt(),
    userPayload: {
      question,
      answer: body.answer,
    },
    schema: writingEvaluationSchema(),
    maxOutputTokens: 1000,
  });

  return normalizeWritingEvaluation(evaluation, question, body.answer);
}

async function callOpenAIJson({ name, systemPrompt, userPayload, schema, maxOutputTokens }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Create server/.env from server/.env.example.');
  }

  const apiResponse = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(userPayload, null, 2) }],
        },
      ],
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name,
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await apiResponse.json().catch(() => null);

  if (!apiResponse.ok) {
    const message = data?.error?.message ?? `OpenAI API request failed with ${apiResponse.status}`;
    throw new Error(message);
  }

  const outputText = extractOutputText(data);

  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error('OpenAI response was not valid JSON.');
  }
}

function buildInterpreterPrompt() {
  return [
    'You interpret one learner message in an English roleplay app.',
    'Do not write the assistant roleplay reply.',
    'Classify latest userMessage as progress/no_progress/off_topic/unclear.',
    'Only include filledSlotKeys that exist in conversationState.requiredSlots.',
    'Use confidence 0.0 to 1.0.',
    'Return only JSON that matches the provided schema.',
  ].join('\n');
}

export function normalizeActorOutput(actorOutput, conversationState, messages, scenario, state = {}) {
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? '';
  const message = String(actorOutput.message ?? '');
  const shouldReplace = !message.trim() ||
    isRepeatedMessage(message, latestAssistant) ||
    asksKnownSlot(message, conversationState, scenario);
  const detectedIssueTags = Array.isArray(actorOutput.detectedIssueTags) ? actorOutput.detectedIssueTags : [];
  const isUserUnderstandable = Boolean(actorOutput.isUserUnderstandable);
  const userTurnCount = Number(state.userTurnCount ?? 0);
  const failureCount = Number(state.failureCount ?? 0);
  const maxUserTurns = Number(state.maxUserTurns ?? scenario.maxUserTurns ?? 0);
  const reachedMaxTurns = maxUserTurns > 0 && userTurnCount >= maxUserTurns;
  const reachedFailureLimit = failureCount >= 3 || !isUserUnderstandable && failureCount + 1 >= 3;
  const completedBySlots = Boolean(conversationState.canComplete);
  const hasMissingRequiredSlots = Array.isArray(conversationState.missingDetails) &&
    conversationState.missingDetails.length > 0;
  const acceptsModelRequestedEnd = !hasMissingRequiredSlots;
  const modelRequestedPrematureEnd = hasMissingRequiredSlots && Boolean(actorOutput.shouldEndSession);
  const normalizedShouldEndSession = reachedMaxTurns ||
    reachedFailureLimit ||
    completedBySlots ||
    acceptsModelRequestedEnd && Boolean(actorOutput.shouldEndSession);

  const normalizedOutput = {
    message,
    isUserUnderstandable,
    isUserRelevant: Boolean(actorOutput.isUserRelevant),
    shouldEndSession: normalizedShouldEndSession,
    endReason: reachedMaxTurns
      ? 'max_turns'
      : reachedFailureLimit
        ? 'too_many_failures'
        : completedBySlots
          ? 'goal_completed'
          : acceptsModelRequestedEnd
            ? actorOutput.endReason ?? null
            : null,
    detectedIssueTags,
    correctedSentence: normalizeCorrectedSentence(actorOutput.correctedSentence),
    shortReasonKo: isUserUnderstandable && detectedIssueTags.length === 0 ? null : actorOutput.shortReasonKo ?? null,
  };

  if (!shouldReplace && !completedBySlots && !modelRequestedPrematureEnd) {
    return normalizedOutput;
  }

  return {
    ...normalizedOutput,
    message: getFallbackActorMessage(conversationState),
    shouldEndSession: conversationState.canComplete || normalizedOutput.shouldEndSession,
    endReason: conversationState.canComplete ? 'goal_completed' : normalizedOutput.endReason,
  };
}

export function buildConversationState(scenario, messages) {
  const config = getRoleplaySlotConfig(scenario);
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join(' ')
    .toLowerCase();
  const knownSlots = config.slots.filter((slot) => slot.pattern.test(userText));
  const missingSlots = config.slots.filter((slot) => !slot.pattern.test(userText));
  const nextSlot = missingSlots[0] ?? null;

  return {
    scenarioType: config.type,
    knownDetails: knownSlots.map((slot) => slot.label),
    missingDetails: missingSlots.map((slot) => slot.label),
    requiredSlots: config.slots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      question: slot.question,
    })),
    repairPolicy: normalizeRepairPolicy(scenario.repairPolicy),
    successCriteria: normalizeStringArray(scenario.successCriteria),
    nextQuestion: nextSlot?.question ?? null,
    completionMessage: config.completionMessage,
    canComplete: missingSlots.length === 0,
  };
}

function getRoleplaySlotConfig(scenario) {
  if (hasScenarioSlots(scenario)) {
    return buildScenarioRoleplaySlotConfig(scenario);
  }

  const scenarioId = scenario.id.toLowerCase();

  if (scenarioId.includes('cafe')) return { type: 'cafe', ...roleplaySlotConfigs.cafe };
  if (scenarioId.includes('airport')) return { type: 'airport', ...roleplaySlotConfigs.airport };
  if (scenarioId.includes('hotel-checkin') || scenarioId.includes('checkin')) {
    return { type: 'hotelCheckin', ...roleplaySlotConfigs.hotelCheckin };
  }
  if (scenarioId.includes('hotel')) return { type: 'hotel', ...roleplaySlotConfigs.hotel };
  if (scenarioId.includes('directions')) return { type: 'directions', ...roleplaySlotConfigs.directions };
  if (scenarioId.includes('plans')) return { type: 'plans', ...roleplaySlotConfigs.plans };
  if (scenarioId.includes('restaurant')) return { type: 'restaurant', ...roleplaySlotConfigs.restaurant };

  return buildGenericRoleplaySlotConfig(scenario);
}

function hasScenarioSlots(scenario) {
  return Array.isArray(scenario.requiredSlots) && scenario.requiredSlots.some((slot) => {
    return slot && typeof slot === 'object' && Array.isArray(slot.matchKeywords) && slot.matchKeywords.length > 0;
  });
}

function buildScenarioRoleplaySlotConfig(scenario) {
  const fallbackPattern = buildTargetExpressionPattern(scenario.targetExpressions)
    ?? /\b(please|can|could|would|i'd|i would|i need|i want|i have|i'm|my|yes|no)\b/i;
  const slots = scenario.requiredSlots
    .filter((slot) => slot && typeof slot === 'object' && slot.required !== false)
    .map((slot, index) => {
      const keywords = normalizeStringArray(slot.matchKeywords);
      const question = getEnglishScenarioText(slot.prompt)
        || buildTargetExpressionQuestion(scenario.targetExpressions)
        || 'What would you like to say?';

      return {
        key: getNonEmptyString(slot.key, `slot${index + 1}`),
        label: getNonEmptyString(slot.label, getNonEmptyString(slot.key, `slot ${index + 1}`)),
        pattern: buildSlotPattern(slot, scenario, keywords) ?? fallbackPattern,
        questionPattern: buildKeywordPattern([
          slot.label,
          slot.prompt,
          slot.key,
          ...keywords,
        ]) ?? fallbackPattern,
        question,
      };
    });

  return {
    type: getNonEmptyString(scenario.id, 'scenario'),
    completionMessage: getEnglishScenarioText(scenario.completionMessage)
      || 'Great. That works for this situation.',
    slots,
  };
}

function buildSlotPattern(slot, scenario, keywords) {
  const keywordPattern = buildKeywordPattern(keywords);
  const supplementalPattern = buildSupplementalSlotPattern(slot, scenario);

  if (!keywordPattern) {
    return supplementalPattern;
  }

  if (!supplementalPattern) {
    return keywordPattern;
  }

  return {
    test(text) {
      return keywordPattern.test(text) || supplementalPattern.test(text);
    },
  };
}

function buildSupplementalSlotPattern(slot, scenario) {
  const slotKey = getNonEmptyString(slot.key, '').toLowerCase();
  const slotLabel = getNonEmptyString(slot.label, '').toLowerCase();
  const scenarioId = getNonEmptyString(scenario.id, '').toLowerCase();
  const isRestaurantRequestSlot =
    scenarioId.includes('restaurant') &&
    (slotKey === 'requestitem' || slotLabel === 'restaurant request');

  if (!isRestaurantRequestSlot) {
    return null;
  }

  return {
    test(text) {
      return restaurantRequestPhrases.some((phrase) => {
        const phrasePattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'ig');

        return [...text.matchAll(phrasePattern)].some((match) => {
          const matchEnd = (match.index ?? 0) + match[0].length;
          const sameSentenceTail = text.slice(matchEnd).split(/[.!?]/)[0];

          return hasRestaurantRequestObject(sameSentenceTail);
        });
      });
    },
  };
}

function hasRestaurantRequestObject(requestTail) {
  return (requestTail.match(/[a-z][a-z']*/gi) ?? []).some((word) => {
    return word.length >= 3 && !restaurantRequestFillerWords.has(word.toLowerCase());
  });
}

function buildGenericRoleplaySlotConfig(scenario) {
  const targetExpressionPattern = buildTargetExpressionPattern(scenario.targetExpressions);
  const question = getEnglishScenarioText(scenario.openingMessage)
    || buildTargetExpressionQuestion(scenario.targetExpressions)
    || 'What would you like to say?';
  const label = getNonEmptyString(scenario.userGoalKo, 'scenario goal');

  return {
    type: 'generic',
    completionMessage: 'Thanks. That works for this situation.',
    slots: [
      {
        key: 'scenarioGoal',
        label,
        pattern: targetExpressionPattern ?? /\b(please|can|could|would|i'd|i would|i need|i want|i have|i'm|my|yes|no)\b/i,
        questionPattern: /\b(what would you like|how can i help|what do you need|could you tell me|can you tell me|please tell me)\b/i,
        question,
      },
    ],
  };
}

function buildTargetExpressionPattern(targetExpressions) {
  const keywords = getTargetExpressionKeywords(targetExpressions);

  if (keywords.length === 0) {
    return null;
  }

  return buildKeywordPattern(keywords);
}

function buildTargetExpressionQuestion(targetExpressions) {
  const expression = Array.isArray(targetExpressions)
    ? targetExpressions.find((value) => getEnglishScenarioText(value))
    : '';

  return expression ? `Could you say that with "${expression}"?` : '';
}

function getTargetExpressionKeywords(targetExpressions) {
  if (!Array.isArray(targetExpressions)) {
    return [];
  }

  const ignoredWords = new Set(['and', 'are', 'for', 'get', 'have', 'like', 'please', 'that', 'the', 'this', 'with', 'would']);
  const keywords = targetExpressions.flatMap((expression) => {
    if (!getEnglishScenarioText(expression)) {
      return [];
    }

    return expression
      .toLowerCase()
      .match(/[a-z][a-z']+/g) ?? [];
  });

  return [...new Set(keywords.filter((keyword) => keyword.length > 2 && !ignoredWords.has(keyword)))];
}

function getEnglishScenarioText(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const trimmed = value.trim();

  return /[a-z]/i.test(trimmed) ? trimmed : '';
}

function normalizeRepairPolicy(repairPolicy) {
  const fallback = {
    unclear: 'Sorry, could you say that again in English?',
    offTopic: 'Let us come back to this situation. What do you need?',
    correction: 'No problem. Thanks for correcting that.',
    koreanOnly: 'Please try saying that in English.',
  };

  if (!repairPolicy || typeof repairPolicy !== 'object') {
    return fallback;
  }

  return {
    unclear: getNonEmptyString(repairPolicy.unclear, fallback.unclear),
    offTopic: getNonEmptyString(repairPolicy.offTopic, fallback.offTopic),
    correction: getNonEmptyString(repairPolicy.correction, fallback.correction),
    koreanOnly: getNonEmptyString(repairPolicy.koreanOnly, fallback.koreanOnly),
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
}

function buildKeywordPattern(keywords) {
  const sources = normalizeStringArray(keywords).map(keywordToRegexSource);

  if (sources.length === 0) {
    return null;
  }

  return new RegExp(`(?:${sources.join('|')})`, 'i');
}

function keywordToRegexSource(keyword) {
  const escapedKeyword = escapeRegExp(keyword.toLowerCase());

  return /^[a-z0-9']+$/i.test(keyword)
    ? `\\b${escapedKeyword}\\b`
    : escapedKeyword;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asksKnownSlot(message, conversationState, scenario) {
  const config = getRoleplaySlotConfig(scenario);
  const knownDetails = new Set(conversationState.knownDetails);

  return config.slots.some((slot) => knownDetails.has(slot.label) && slot.questionPattern.test(message));
}

function getFallbackActorMessage(conversationState) {
  return conversationState.canComplete
    ? conversationState.completionMessage
    : conversationState.nextQuestion;
}

function compactTranscript(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function isRepeatedMessage(message, previousAssistantMessage) {
  return normalizeSentence(message) === normalizeSentence(previousAssistantMessage);
}

function buildEvaluatorPrompt() {
  return [
    'You are an English learning evaluator for Korean learners.',
    'Evaluate only the user messages in the transcript.',
    'Give feedback in Korean.',
    'Be specific, practical, and not overly harsh.',
    'Do not give a high score only because the AI understood the user.',
    'Identify repeated weakness patterns.',
    'Provide corrected examples using natural English.',
    'Use the exact 100-point rubric below. Do not use a 1-5 scale.',
    'Task completion: 0-30. Give 24-30 when the scenario goal is mostly completed.',
    'Communication clarity: 0-25. Give 20-25 when the meaning is clear.',
    'Grammar accuracy: 0-20. Give 16-20 when there are no major grammar errors.',
    'Vocabulary appropriateness: 0-15. Give 12-15 when scenario vocabulary is appropriate.',
    'Naturalness and flow: 0-10. Give 8-10 when the wording is natural and polite.',
    'The total score must equal taskCompletion + clarity + grammar + vocabulary + naturalness.',
    'Return only JSON that matches the provided schema.',
  ].join('\n');
}

function buildWritingEvaluatorPrompt() {
  return [
    'You are an English learning evaluator for Korean learners.',
    'Evaluate one short answer. The question may ask for English writing or for an English-to-Korean translation.',
    'Use question.answerLanguage to decide the required answer language.',
    'If answerLanguage is "ko", evaluate whether the Korean answer preserves the English questionText meaning.',
    'If answerLanguage is missing or "en", evaluate learner-written English.',
    'Use the provided promptKo, questionText, sampleAnswer, evaluationFocusKo, expectedKeywords, and expectedKeywordsKo.',
    'Do not require the learner answer to be identical to the sample answer if it satisfies the prompt naturally.',
    'Score from 0 to 100.',
    'Set isCorrect true when the answer satisfies the prompt, uses the core meaning, and has no major grammar problem.',
    'For English writing, set isCorrect false for blank, irrelevant, Korean-only, or hard-to-understand answers.',
    'Do not mark a clear grammatical answer incorrect only because its tone is negative or socially impolite unless the prompt explicitly asks for polite or positive tone; mention tone in feedback instead.',
    'For Korean translation, set isCorrect false for blank, English-only, irrelevant, or meaning-changing answers.',
    'Return a corrected natural answer in the required answer language.',
    'Write feedbackKo and weakAreaKo in Korean.',
    'Return only JSON that matches the provided schema.',
  ].join('\n');
}

export function normalizeEvaluation(evaluation, { scenario, engineState, endReason }) {
  const categoryScores = evaluation.categoryScores ?? {};
  let normalizedCategoryScores = {
    taskCompletion: clampNumber(categoryScores.taskCompletion, 0, 30),
    clarity: clampNumber(categoryScores.clarity, 0, 25),
    grammar: clampNumber(categoryScores.grammar, 0, 20),
    vocabulary: clampNumber(categoryScores.vocabulary, 0, 15),
    naturalness: clampNumber(categoryScores.naturalness, 0, 10),
  };
  const missingRequiredSlots = getMissingRequiredSlots(scenario, engineState);

  normalizedCategoryScores = applyEngineEndReasonCaps({
    categoryScores: normalizedCategoryScores,
    endReason,
    missingRequiredSlotCount: missingRequiredSlots.length,
  });

  const totalScore = Object.values(normalizedCategoryScores).reduce((sum, score) => sum + score, 0);

  const correctedExamples = Array.isArray(evaluation.correctedExamples)
    ? evaluation.correctedExamples.filter((example) => normalizeSentence(example.original) !== normalizeSentence(example.corrected))
    : [];
  const recommendedScenarioIds = Array.isArray(evaluation.recommendedScenarioIds)
    ? evaluation.recommendedScenarioIds.filter((id) => id !== scenario.id)
    : [];
  const weaknessesKo = Array.isArray(evaluation.weaknessesKo) ? [...evaluation.weaknessesKo] : [];
  const firstMissingSlot = missingRequiredSlots[0];

  if (firstMissingSlot) {
    weaknessesKo.push(`아직 완료하지 못한 목표: ${firstMissingSlot.label}`);
  }

  return {
    ...evaluation,
    totalScore,
    categoryScores: normalizedCategoryScores,
    strengthsKo: Array.isArray(evaluation.strengthsKo) ? evaluation.strengthsKo : [],
    weaknessesKo,
    correctedExamples,
    weaknessTags: Array.isArray(evaluation.weaknessTags) ? evaluation.weaknessTags : [],
    recommendedScenarioIds,
  };
}

function applyEngineEndReasonCaps({ categoryScores, endReason, missingRequiredSlotCount }) {
  const cappedScores = { ...categoryScores };

  if (endReason === 'max_turns') {
    cappedScores.taskCompletion = Math.min(cappedScores.taskCompletion, 20);
  }

  if (endReason === 'no_progress') {
    cappedScores.taskCompletion = Math.min(cappedScores.taskCompletion, 14);
    cappedScores.clarity = Math.min(cappedScores.clarity, 18);
  }

  if (endReason === 'too_many_failures') {
    cappedScores.taskCompletion = Math.min(cappedScores.taskCompletion, 10);
    cappedScores.clarity = Math.min(cappedScores.clarity, 12);
  }

  cappedScores.taskCompletion = clampNumber(
    cappedScores.taskCompletion - missingRequiredSlotCount * 4,
    0,
    30,
  );
  cappedScores.clarity = clampNumber(cappedScores.clarity, 0, 25);

  return cappedScores;
}

function getMissingRequiredSlots(scenario, engineState) {
  if (!engineState || !scenario || !Array.isArray(scenario.requiredSlots)) {
    return [];
  }

  const filledSlotKeys = new Set(Array.isArray(engineState.filledSlotKeys)
    ? engineState.filledSlotKeys
    : []);

  return scenario.requiredSlots
    .filter((slot) => slot && typeof slot === 'object' && slot.required !== false)
    .filter((slot) => !filledSlotKeys.has(slot.key));
}

export function normalizeWritingEvaluation(evaluation, question, answer) {
  const score = clampNumber(evaluation.score, 0, 100);
  const modelIsCorrect = typeof evaluation.isCorrect === 'boolean'
    ? evaluation.isCorrect
    : score >= WRITING_CORRECT_SCORE_THRESHOLD;
  const answerCanBeCorrect = isPotentiallyValidWritingAnswer(answer, question);
  const trimmedAnswer = answer.trim();
  const correctedAnswer = getNonEmptyString(
    evaluation.correctedAnswer,
    trimmedAnswer || question.sampleAnswer,
  );

  if (isClearFriendIntroductionWritingAnswer(trimmedAnswer, question)) {
    return {
      score: Math.max(score, WRITING_FRIEND_INTRODUCTION_MIN_SCORE),
      isCorrect: true,
      correctedAnswer: trimmedAnswer,
      feedbackKo: '친구를 소개하는 영어 문장 구조는 맞습니다. 다만 사람을 부정적으로 평가하는 표현은 실제 대화에서 조심해 보세요.',
      weakAreaKo: '표현의 어감',
    };
  }

  if (isClearEquivalentWritingAnswer(trimmedAnswer, question)) {
    return {
      score: Math.max(score, WRITING_HIGH_CONFIDENCE_CORRECT_SCORE),
      isCorrect: true,
      correctedAnswer: trimmedAnswer,
      feedbackKo: '\uC758\uBBF8\uC640 \uACFC\uC81C \uC694\uAD6C\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uCDA9\uC871\uD588\uC2B5\uB2C8\uB2E4.',
      weakAreaKo: '',
    };
  }

  if (shouldNormalizeToCleanFullWritingScore({
    answerCanBeCorrect,
    modelIsCorrect,
    question,
    score,
  })) {
    return {
      score: WRITING_FULL_SCORE,
      isCorrect: true,
      correctedAnswer: trimmedAnswer,
      feedbackKo: '핵심 표현과 문장 구조를 자연스럽게 잘 사용했습니다.',
      weakAreaKo: '',
    };
  }

  return {
    score,
    isCorrect: modelIsCorrect && score >= WRITING_CORRECT_SCORE_THRESHOLD && answerCanBeCorrect,
    correctedAnswer,
    feedbackKo: getNonEmptyString(evaluation.feedbackKo, '답안을 평가했습니다.'),
    weakAreaKo: typeof evaluation.weakAreaKo === 'string' ? evaluation.weakAreaKo : '',
  };
}

function shouldNormalizeToCleanFullWritingScore({
  answerCanBeCorrect,
  modelIsCorrect,
  question,
  score,
}) {
  return question?.answerLanguage !== 'ko' &&
    modelIsCorrect &&
    answerCanBeCorrect &&
    score >= WRITING_HIGH_CONFIDENCE_CORRECT_SCORE;
}

function normalizeSentence(sentence) {
  return String(sentence ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeCorrectedSentence(sentence) {
  if (typeof sentence !== 'string' || sentence.includes('...')) {
    return null;
  }

  return sentence;
}

function isPotentiallyValidWritingAnswer(answer, question) {
  if (question?.answerLanguage === 'ko') {
    return hasEnoughKoreanTranslationKeywordCoverage(answer, question);
  }

  return getEnglishTokens(answer).length >= WRITING_MIN_ENGLISH_TOKEN_COUNT;
}

function isClearFriendIntroductionWritingAnswer(answer, question) {
  if (!isFriendIntroductionWritingQuestion(question)) {
    return false;
  }

  const tokens = getEnglishTokens(answer);

  if (tokens.length < 4 || !tokens.includes('friend')) {
    return false;
  }

  if (hasTokenSequence(tokens, ['my', 'friend', 'is'])) {
    const complementTokens = tokens.slice(tokens.indexOf('is') + 1);

    return complementTokens.some(isPlausibleFriendDescriptionToken);
  }

  if (tokens.length >= 5 && hasTokenSequence(tokens, ['this', 'is', 'my', 'friend'])) {
    const friendIndex = tokens.indexOf('friend');

    return tokens.slice(friendIndex + 1).some(isLikelyNameToken);
  }

  if (hasTokenSequence(tokens, ['is', 'my', 'friend'])) {
    const isIndex = tokens.indexOf('is');
    const subjectTokens = tokens.slice(0, isIndex);

    return subjectTokens.some(isLikelyNameToken) || subjectTokens.some((token) => token === 'he' || token === 'she');
  }

  return false;
}

function isFriendIntroductionWritingQuestion(question) {
  const metadata = `${question?.id ?? ''} ${question?.promptKo ?? ''} ${question?.sampleAnswer ?? ''} ${question?.evaluationFocusKo ?? ''}`.toLowerCase();

  if (question?.id === 'a1-writing-introduce-friend-002') {
    return true;
  }

  return metadata.includes('friend') &&
    metadata.includes('\uCE5C\uAD6C') &&
    metadata.includes('\uC18C\uAC1C');
}

function isClearEquivalentWritingAnswer(answer, question) {
  const tokens = getEnglishTokens(answer);

  if (tokens.length < WRITING_MIN_ENGLISH_TOKEN_COUNT) {
    return false;
  }

  return isClearWeekendPlanQuestion(tokens, question) ||
    isClearDocumentByTomorrowRequest(tokens, question) ||
    isClearRefundRequest(tokens, question) ||
    isClearMoodTodayAnswer(tokens, question) ||
    isClearNegativePreferenceAnswer(tokens, question);
}

function isClearNegativePreferenceAnswer(tokens, question) {
  if (!isNegativePreferenceWritingQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const targetTokens = getNegativePreferenceTargetTokens(question);

  return tokens.includes('i') &&
    tokens.includes('not') &&
    tokens.includes('like') &&
    targetTokens.length > 0 &&
    targetTokens.some((token) => tokenSet.has(token));
}

function isClearMoodTodayAnswer(tokens, question) {
  if (!isMoodTodayWritingQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const hasFirstPersonSubject = tokens.includes('i');
  const hasTodayContext = tokenSet.has('today');
  const hasPositiveMood = [...WRITING_POSITIVE_MOOD_TOKENS].some((token) => tokenSet.has(token));
  const usesBeMoodPattern = hasTokenSequence(tokens, ['i', 'am']) && hasPositiveMood;
  const usesFeelMoodPattern = hasFirstPersonSubject &&
    tokens.some((token) => WRITING_FEELING_VERB_TOKENS.has(toSingularToken(token))) &&
    hasPositiveMood;

  return hasFirstPersonSubject &&
    hasTodayContext &&
    (usesBeMoodPattern || usesFeelMoodPattern);
}

function isClearWeekendPlanQuestion(tokens, question) {
  if (!isWeekendPlanWritingQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const startsLikeQuestion = ['are', 'do', 'does', 'what', 'will', 'would'].includes(tokens[0] ?? '');
  const hasPlanConcept = tokenSet.has('plan') ||
    tokens.includes('planning') ||
    hasTokenSequence(tokens, ['what', 'will', 'you', 'do']) ||
    hasTokenSequence(tokens, ['what', 'are', 'you', 'doing']);

  return startsLikeQuestion &&
    tokenSet.has('weekend') &&
    hasPlanConcept &&
    tokens.includes('you');
}

function isClearDocumentByTomorrowRequest(tokens, question) {
  if (!isDocumentByTomorrowRequestWritingQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const isPoliteRequest = hasTokenSequence(tokens, ['could', 'you']) ||
    hasTokenSequence(tokens, ['would', 'you']) ||
    tokens.includes('please');
  const hasSendAction = [...WRITING_SEND_REQUEST_TOKENS].some((token) => tokenSet.has(token));
  const hasWorkObject = [...WRITING_WORK_DOCUMENT_TOKENS].some((token) => tokenSet.has(token));

  return isPoliteRequest &&
    hasSendAction &&
    hasWorkObject &&
    tokenSet.has('tomorrow');
}

function isWeekendPlanWritingQuestion(question) {
  const metadata = getWritingQuestionMetadata(question);
  const keywordTokenSet = new Set(getWritingEvaluationKeywordTokens(question));

  return metadata.includes('weekend') &&
    (metadata.includes('plan') || keywordTokenSet.has('weekend') || keywordTokenSet.has('planning'));
}

function isDocumentByTomorrowRequestWritingQuestion(question) {
  const metadata = getWritingQuestionMetadata(question);
  const keywordTokenSet = new Set(getWritingEvaluationKeywordTokens(question));

  return metadata.includes('tomorrow') &&
    (metadata.includes('report') || metadata.includes('document') || keywordTokenSet.has('report')) &&
    (metadata.includes('send') || keywordTokenSet.has('could') || keywordTokenSet.has('tomorrow'));
}

function isMoodTodayWritingQuestion(question) {
  const metadata = getWritingQuestionMetadata(question);
  const keywordTokenSet = new Set(getWritingEvaluationKeywordTokens(question));

  if (question?.id === 'a1-writing-feeling-001') {
    return true;
  }

  return metadata.includes('happy today') &&
    keywordTokenSet.has('i') &&
    keywordTokenSet.has('am') &&
    keywordTokenSet.has('today');
}

function isClearRefundRequest(tokens, question) {
  if (!isRefundRequestWritingQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const isPoliteQuestion = (
    (tokens.includes('could') || tokens.includes('can') || tokens.includes('may')) &&
    tokens.includes('i')
  );
  const hasRefundRequestVerb = [...WRITING_REFUND_REQUEST_VERB_TOKENS].some((token) => tokenSet.has(token));

  return isPoliteQuestion &&
    tokenSet.has('refund') &&
    hasRefundRequestVerb;
}

function isRefundRequestWritingQuestion(question) {
  const metadata = `${getWritingQuestionMetadata(question)} ${question?.weakPointLabel ?? ''}`.toLowerCase();
  const keywordTokenSet = new Set(getWritingEvaluationKeywordTokens(question));

  return metadata.includes('refund') || keywordTokenSet.has('refund');
}

function isNegativePreferenceWritingQuestion(question) {
  const sampleTokens = getEnglishTokens(question?.sampleAnswer);
  const keywordTokenSet = new Set(getWritingEvaluationKeywordTokens(question));

  return hasTokenSequence(sampleTokens, ['i', 'do', 'not', 'like']) ||
    (keywordTokenSet.has('not') && keywordTokenSet.has('like'));
}

function getNegativePreferenceTargetTokens(question) {
  const targetTokens = [
    ...getWritingEvaluationKeywordTokens(question),
    ...getEnglishTokens(question?.sampleAnswer),
  ]
    .map(toSingularToken)
    .filter((token) => token.length > 2 && !WRITING_NEGATIVE_PREFERENCE_STRUCTURE_TOKENS.has(token));

  return [...new Set(targetTokens)];
}

function getWritingQuestionMetadata(question) {
  return `${question?.id ?? ''} ${question?.promptKo ?? ''} ${question?.sampleAnswer ?? ''} ${question?.evaluationFocusKo ?? ''}`.toLowerCase();
}

function getWritingEvaluationKeywordTokens(question) {
  return [...new Set(normalizeStringArray(question?.expectedKeywords).flatMap(getEnglishTokens))];
}

function isPlausibleFriendDescriptionToken(token) {
  return /^[a-z][a-z']*$/.test(token) &&
    token.length > 2 &&
    !WRITING_LOW_QUALITY_REPLACEMENT_TOKENS.has(toSingularToken(token));
}

function isLikelyNameToken(token) {
  return /^[a-z][a-z']*$/.test(token) && token.length >= 2;
}

function hasTokenSequence(tokens, sequence) {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }

  return tokens.some((_, index) => (
    sequence.every((token, sequenceIndex) => tokens[index + sequenceIndex] === token)
  ));
}

function toSingularToken(token) {
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith('es') && token.length > 3) {
    return token.slice(0, -2);
  }

  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function hasEnoughKoreanTranslationKeywordCoverage(answer, question) {
  if (!hasHangul(answer)) {
    return false;
  }

  const keywords = getKoreanTranslationKeywords(question);

  if (keywords.length === 0) {
    return false;
  }

  return getKoreanTranslationKeywordHitCount(answer, question) >= Math.min(
    WRITING_MIN_KOREAN_TRANSLATION_KEYWORD_HITS,
    keywords.length,
  );
}

function getKoreanTranslationKeywords(question) {
  return [...new Set([
    ...normalizeStringArray(question.expectedKeywordsKo),
    ...getKoreanContentTokens(question.sampleAnswer).slice(0, 4),
  ])];
}

function getKoreanTranslationKeywordHitCount(answer, question) {
  return getKoreanTranslationKeywords(question).filter((keyword) =>
    hasKoreanKeywordConcept(answer, keyword),
  ).length;
}

function hasKoreanKeywordConcept(answer, keyword) {
  const normalizedAnswer = normalizeKoreanForSearch(answer);
  const normalizedKeyword = normalizeKoreanForSearch(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedAnswer.includes(normalizedKeyword)) {
    return true;
  }

  if (normalizedKeyword.includes('9시')) {
    return normalizedAnswer.includes('아홉') && normalizedAnswer.includes('시');
  }

  return getKoreanContentTokens(keyword).some((token) =>
    token.length > 1 && normalizedAnswer.includes(token),
  );
}

function getKoreanContentTokens(value) {
  return String(value ?? '')
    .replace(/[^\uAC00-\uD7A3\s0-9]/g, ' ')
    .split(/\s+/)
    .map(normalizeKoreanToken)
    .filter((token) => token.length > 0);
}

function normalizeKoreanToken(value) {
  return value
    .trim()
    .replace(/[은는이가을를와과에의도만으로부터까지입니다다요]+$/g, '');
}

function normalizeKoreanForSearch(value) {
  return String(value ?? '').replace(/[^\uAC00-\uD7A30-9]/g, '');
}

function hasHangul(value) {
  return /[가-힣]/.test(String(value ?? ''));
}

function getEnglishTokens(value) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(
      /\b(aren't|can't|couldn't|didn't|doesn't|don't|hadn't|hasn't|haven't|i'm|isn't|shouldn't|wasn't|weren't|won't|wouldn't)\b/g,
      (contraction) => WRITING_ENGLISH_CONTRACTION_EXPANSIONS[contraction] ?? contraction,
    )
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.match(/[a-z0-9']+/g) ?? [];
}

function clampNumber(value, min, max) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function interpreterResponseSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['interpretation'],
    properties: {
      interpretation: {
        type: 'object',
        additionalProperties: false,
        required: [
          'isUnderstandable',
          'isOnTopic',
          'turnType',
          'filledSlotKeys',
          'correctedSentence',
          'detectedIssueTags',
          'shortReasonKo',
          'confidence',
        ],
        properties: {
          isUnderstandable: { type: 'boolean' },
          isOnTopic: { type: 'boolean' },
          turnType: {
            type: 'string',
            enum: ['progress', 'no_progress', 'off_topic', 'unclear'],
          },
          filledSlotKeys: {
            type: 'array',
            items: { type: 'string' },
          },
          correctedSentence: { type: ['string', 'null'] },
          detectedIssueTags: {
            type: 'array',
            items: { type: 'string', enum: skillTags },
          },
          shortReasonKo: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  };
}

function evaluationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'totalScore',
      'categoryScores',
      'summaryKo',
      'strengthsKo',
      'weaknessesKo',
      'correctedExamples',
      'weaknessTags',
      'recommendedScenarioIds',
    ],
    properties: {
      totalScore: { type: 'number', minimum: 0, maximum: 100 },
      categoryScores: {
        type: 'object',
        additionalProperties: false,
        required: ['taskCompletion', 'clarity', 'grammar', 'vocabulary', 'naturalness'],
        properties: {
          taskCompletion: { type: 'number', minimum: 0, maximum: 30 },
          clarity: { type: 'number', minimum: 0, maximum: 25 },
          grammar: { type: 'number', minimum: 0, maximum: 20 },
          vocabulary: { type: 'number', minimum: 0, maximum: 15 },
          naturalness: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
      summaryKo: { type: 'string' },
      strengthsKo: { type: 'array', items: { type: 'string' } },
      weaknessesKo: { type: 'array', items: { type: 'string' } },
      correctedExamples: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['original', 'corrected', 'explanationKo', 'tags'],
          properties: {
            original: { type: 'string' },
            corrected: { type: 'string' },
            explanationKo: { type: 'string' },
            tags: { type: 'array', items: { type: 'string', enum: skillTags } },
          },
        },
      },
      weaknessTags: { type: 'array', items: { type: 'string', enum: skillTags } },
      recommendedScenarioIds: { type: 'array', items: { type: 'string' } },
    },
  };
}

function writingEvaluationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['score', 'isCorrect', 'correctedAnswer', 'feedbackKo', 'weakAreaKo'],
    properties: {
      score: { type: 'number', minimum: 0, maximum: 100 },
      isCorrect: { type: 'boolean' },
      correctedAnswer: { type: 'string' },
      feedbackKo: { type: 'string' },
      weakAreaKo: { type: 'string' },
    },
  };
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string') {
    return data.output_text;
  }

  for (const item of data?.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  throw new Error('OpenAI response did not include output text.');
}

function assertScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') {
    throw new Error('scenario is required.');
  }

  assertString(scenario.id, 'scenario.id');
  assertString(scenario.titleKo, 'scenario.titleKo');
  assertString(scenario.titleEn, 'scenario.titleEn');
  assertString(scenario.userGoalKo, 'scenario.userGoalKo');
}

function assertWritingQuestion(question) {
  if (!question || typeof question !== 'object') {
    throw new Error('question is required.');
  }

  assertString(question.id, 'question.id');
  assertString(question.level, 'question.level');
  assertString(question.area, 'question.area');
  assertString(question.promptKo, 'question.promptKo');
  assertString(question.sampleAnswer, 'question.sampleAnswer');
  assertString(question.evaluationFocusKo, 'question.evaluationFocusKo');

  if (
    question.answerLanguage !== undefined &&
    question.answerLanguage !== 'en' &&
    question.answerLanguage !== 'ko'
  ) {
    throw new Error('question.answerLanguage must be en or ko.');
  }

  const answerLanguage = question.answerLanguage ?? 'en';
  const expectedKeywords = Array.isArray(question.expectedKeywords)
    ? question.expectedKeywords.filter((keyword) => typeof keyword === 'string' && keyword.trim())
    : [];
  const expectedKeywordsKo = Array.isArray(question.expectedKeywordsKo)
    ? question.expectedKeywordsKo.filter((keyword) => typeof keyword === 'string' && keyword.trim())
    : [];
  const readingDifficulty = typeof question.readingDifficulty === 'string'
    ? question.readingDifficulty
    : null;
  const timeLimitSeconds = Number.isInteger(question.timeLimitSeconds)
    ? question.timeLimitSeconds
    : null;

  if (answerLanguage === 'ko') {
    if (question.area !== 'reading') {
      throw new Error('Korean translation questions must be reading questions.');
    }

    assertString(question.questionText, 'question.questionText');

    if (timeLimitSeconds === null || timeLimitSeconds < 30 || timeLimitSeconds > 90) {
      throw new Error('question.timeLimitSeconds must be an integer from 30 to 90.');
    }

    if (!WRITING_READING_DIFFICULTIES.has(readingDifficulty)) {
      throw new Error('question.readingDifficulty must be easy, medium, or hard.');
    }

    if (expectedKeywordsKo.length < 3 || !expectedKeywordsKo.every(hasHangul)) {
      throw new Error('question.expectedKeywordsKo must contain at least 3 Korean keywords.');
    }

    if (!hasHangul(question.sampleAnswer)) {
      throw new Error('question.sampleAnswer must contain Korean text for Korean translation questions.');
    }
  }

  return {
    id: question.id,
    level: question.level,
    area: question.area,
    promptKo: question.promptKo,
    questionText: typeof question.questionText === 'string' ? question.questionText : '',
    sampleAnswer: question.sampleAnswer,
    evaluationFocusKo: question.evaluationFocusKo,
    answerLanguage,
    expectedKeywords,
    expectedKeywordsKo,
    readingDifficulty,
    timeLimitSeconds,
  };
}

function assertString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
}

function getNonEmptyString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body);
  }

  if (Buffer.isBuffer(request.rawBody) && request.rawBody.length > 0) {
    return JSON.parse(request.rawBody.toString('utf8'));
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-English-Project-Client-Id,X-English-Project-Master-Test-Token',
    'Content-Type': 'application/json; charset=utf-8',
  });

  if (statusCode === 204) {
    response.end();
    return;
  }

  response.end(JSON.stringify(payload));
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
