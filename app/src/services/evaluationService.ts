import { scenarios } from '../data/scenarios';
import { getApiBaseUrl } from '../config/api';
import type {
  ConversationEngineEndReason,
  ConversationEngineState,
  ConversationMessage,
  ConversationResult,
  Scenario,
  SkillTag,
} from '../types/conversation';
import { getAiRequestHeaders } from './apiClientIdentity';
import { getRequiredSlots, slotMatches } from './conversationSlotMatcher';

type EvaluationInput = {
  scenario: Scenario;
  messages: ConversationMessage[];
  communicationFailureCount: number;
  engineState: ConversationEngineState | null;
  endReason: ConversationEngineEndReason;
};

export async function evaluateConversationWithAi(input: EvaluationInput): Promise<ConversationResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/conversation/evaluate`, {
      method: 'POST',
      headers: await getAiRequestHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Evaluation API failed with ${response.status}`);
    }

    return {
      ...((await response.json()) as ConversationResult),
      evaluationSource: 'ai',
    };
  } catch (error) {
    console.warn('Using mock evaluation fallback:', error);
    return evaluateConversation(input);
  }
}

export function evaluateConversation({
  scenario,
  messages,
  communicationFailureCount,
  engineState,
  endReason,
}: EvaluationInput): ConversationResult {
  const userMessages = messages.filter((message) => message.role === 'user');

  if (userMessages.length === 0) {
    return createEmptyConversationResult(scenario);
  }

  const issueTags = collectIssueTags(userMessages);
  const relevantCount = userMessages.filter((message) => message.analysis?.isRelevant).length;
  const understandableCount = userMessages.filter((message) => message.analysis?.isUnderstandable).length;
  const politeCount = userMessages.filter((message) => /\b(please|could|would|may|can|i'd|i would)\b/i.test(message.content)).length;

  let taskCompletion = clampScore(
    Math.round((relevantCount / Math.max(userMessages.length, 1)) * 24) +
      completionBonus(scenario, userMessages),
    30,
  );
  let clarity = clampScore(
    Math.round((understandableCount / Math.max(userMessages.length, 1)) * 25) -
      communicationFailureCount * 4,
    25,
  );
  const grammar = clampScore(
    20 - issueTags.filter((tag) => tag === 'articles' || tag === 'verb_tense' || tag === 'prepositions').length * 3,
    20,
  );
  const vocabulary = clampScore(
    10 + Math.min(5, uniqueEnglishWordCount(userMessages) / 5),
    15,
  );
  const naturalness = clampScore(5 + Math.min(5, politeCount * 2), 10);
  const missingRequiredSlots = getMissingRequiredSlots(scenario, engineState);
  ({ taskCompletion, clarity } = applyEngineEndReasonCaps({
    taskCompletion,
    clarity,
    endReason,
    missingRequiredSlotCount: missingRequiredSlots.length,
  }));
  const totalScore = taskCompletion + clarity + grammar + vocabulary + naturalness;
  const weaknessTags = issueTags.length > 0 ? issueTags : getFallbackWeaknessTags(totalScore, scenario);
  const weaknessesKo = createWeaknesses(weaknessTags);
  const firstMissingSlot = missingRequiredSlots[0];

  if (firstMissingSlot) {
    weaknessesKo.push(`아직 완료하지 못한 목표: ${firstMissingSlot.label}`);
  }

  return {
    totalScore,
    evaluationSource: 'localFallback',
    categoryScores: {
      taskCompletion,
      clarity,
      grammar,
      vocabulary,
      naturalness,
    },
    summaryKo: createSummary(totalScore, scenario),
    strengthsKo: createStrengths({ relevantCount, understandableCount, politeCount, userMessageCount: userMessages.length }),
    weaknessesKo,
    correctedExamples: createCorrectedExamples(userMessages),
    weaknessTags,
    recommendedScenarioIds: getRecommendedScenarioIds(scenario),
  };
}

function applyEngineEndReasonCaps({
  taskCompletion,
  clarity,
  endReason,
  missingRequiredSlotCount,
}: {
  taskCompletion: number;
  clarity: number;
  endReason: ConversationEngineEndReason;
  missingRequiredSlotCount: number;
}) {
  let cappedTaskCompletion = taskCompletion;
  let cappedClarity = clarity;

  if (endReason === 'max_turns') {
    cappedTaskCompletion = Math.min(cappedTaskCompletion, 20);
  }

  if (endReason === 'no_progress') {
    cappedTaskCompletion = Math.min(cappedTaskCompletion, 14);
    cappedClarity = Math.min(cappedClarity, 18);
  }

  if (endReason === 'too_many_failures') {
    cappedTaskCompletion = Math.min(cappedTaskCompletion, 10);
    cappedClarity = Math.min(cappedClarity, 12);
  }

  cappedTaskCompletion = clampScore(
    cappedTaskCompletion - missingRequiredSlotCount * 4,
    30,
  );

  return {
    taskCompletion: cappedTaskCompletion,
    clarity: clampScore(cappedClarity, 25),
  };
}

function getMissingRequiredSlots(scenario: Scenario, engineState: ConversationEngineState | null) {
  if (!engineState) {
    return [];
  }

  const filledSlotKeys = new Set(
    Array.isArray(engineState.filledSlotKeys)
      ? engineState.filledSlotKeys.filter((key): key is string => typeof key === 'string')
      : [],
  );

  return scenario.requiredSlots
    .filter((slot) => slot.required !== false)
    .filter((slot) => !filledSlotKeys.has(slot.key));
}

function createEmptyConversationResult(scenario: Scenario): ConversationResult {
  const weaknessTags = scenario.targetSkills.slice(0, 2);

  return {
    totalScore: 0,
    evaluationSource: 'localFallback',
    categoryScores: {
      taskCompletion: 0,
      clarity: 0,
      grammar: 0,
      vocabulary: 0,
      naturalness: 0,
    },
    summaryKo: `${scenario.titleKo} 대화가 아직 시작되지 않았습니다. 짧은 영어 문장으로 먼저 답해 보세요.`,
    strengthsKo: [],
    weaknessesKo: createWeaknesses(weaknessTags),
    correctedExamples: [],
    weaknessTags,
    recommendedScenarioIds: getRecommendedScenarioIds(scenario),
  };
}

function collectIssueTags(userMessages: ConversationMessage[]) {
  return [
    ...new Set(
      userMessages.flatMap((message) => message.analysis?.detectedIssues ?? []),
    ),
  ];
}

function uniqueEnglishWordCount(userMessages: ConversationMessage[]) {
  return new Set(
    userMessages.flatMap((message) =>
      message.content
        .toLowerCase()
        .split(/[^a-z']+/)
        .filter(Boolean),
    ),
  ).size;
}

function completionBonus(scenario: Scenario, userMessages: ConversationMessage[]) {
  const transcript = userMessages.map((message) => message.content.toLowerCase()).join(' ');
  const requiredSlots = getRequiredSlots(scenario);

  if (requiredSlots.length > 0) {
    const matchedSlotCount = requiredSlots.filter((slot) => {
      return slotMatches(slot, transcript, scenario);
    }).length;

    return Math.round((matchedSlotCount / requiredSlots.length) * 6);
  }

  if (scenario.id.includes('cafe') && /\b(coffee|tea|latte|americano|to go|for here)\b/.test(transcript)) {
    return 6;
  }

  if (scenario.id.includes('hotel') && /\b(name|reservation|check in|room|night)\b/.test(transcript)) {
    return 6;
  }

  if (scenario.id.includes('directions') && /\b(station|where|left|right|straight|thank)\b/.test(transcript)) {
    return 6;
  }

  if (scenario.id.includes('airport') && /\b(passport|bag|luggage|flight|seat)\b/.test(transcript)) {
    return 6;
  }

  if (scenario.id.includes('plans') && /\b(later|meet|time|how about|sorry)\b/.test(transcript)) {
    return 6;
  }

  if (scenario.id.includes('restaurant') && /\b(menu|water|bill|check|bring|order)\b/.test(transcript)) {
    return 6;
  }

  return 0;
}

function createSummary(score: number, scenario: Scenario) {
  if (score >= 80) {
    return `${scenario.titleKo} 상황에서 목표를 대부분 달성했습니다. 이제 표현을 더 자연스럽게 다듬으면 좋습니다.`;
  }

  if (score >= 60) {
    return `${scenario.titleKo} 상황에서 의미는 전달됐지만 문장 구조와 공손한 표현을 더 보완해야 합니다.`;
  }

  return `${scenario.titleKo} 상황에서 목표 전달이 아직 불안정합니다. 짧고 정확한 기본 문장부터 반복해 보세요.`;
}

function createStrengths({
  relevantCount,
  understandableCount,
  politeCount,
  userMessageCount,
}: {
  relevantCount: number;
  understandableCount: number;
  politeCount: number;
  userMessageCount: number;
}) {
  const strengths = [];

  if (relevantCount > 0) {
    strengths.push('상황과 관련된 핵심 단어를 사용했습니다.');
  }

  if (understandableCount >= Math.max(1, userMessageCount - 1)) {
    strengths.push('대부분의 답변에서 의미 전달이 가능했습니다.');
  }

  if (politeCount > 0) {
    strengths.push('please, could 같은 공손한 표현을 시도했습니다.');
  }

  return strengths.length > 0 ? strengths : ['대화를 끝까지 시도한 점이 좋습니다.'];
}

function createWeaknesses(tags: SkillTag[]) {
  const weaknessMap: Record<SkillTag, string> = {
    polite_requests: '요청할 때 please, could, would 같은 공손한 표현을 더 사용해 보세요.',
    articles: 'a, an, the 같은 관사가 빠지면 문장이 어색해질 수 있습니다.',
    prepositions: 'in, on, at, to 같은 전치사를 상황에 맞게 연습하세요.',
    verb_tense: '현재, 과거, 미래 시제를 더 정확히 구분해야 합니다.',
    question_comprehension: '상대의 질문 의도를 먼저 파악하는 연습이 필요합니다.',
    vocabulary_range: '상황별 핵심 어휘를 늘리면 대화가 쉬워집니다.',
    clarification: '못 알아들었을 때 다시 말하거나 확인하는 표현을 연습하세요.',
    numbers_dates: '날짜, 시간, 숫자를 영어로 정확히 말하는 연습이 필요합니다.',
    natural_phrasing: '한국어식 단어 나열보다 자연스러운 영어 문장 패턴을 익히세요.',
    task_completion: '대화 목표를 끝까지 완료하는 흐름을 연습하세요.',
  };

  return tags.slice(0, 3).map((tag) => weaknessMap[tag]);
}

function getFallbackWeaknessTags(score: number, scenario: Scenario): SkillTag[] {
  if (score >= 80) {
    return ['natural_phrasing'];
  }

  return scenario.targetSkills.slice(0, 2);
}

function createCorrectedExamples(userMessages: ConversationMessage[]) {
  return userMessages
    .filter((message) => message.analysis?.correctedSentence)
    .filter((message) => normalizeSentence(message.content) !== normalizeSentence(message.analysis?.correctedSentence ?? ''))
    .slice(0, 2)
    .map((message) => ({
      original: message.content,
      corrected: message.analysis?.correctedSentence ?? '',
      explanationKo: '의미를 더 분명하고 공손하게 전달하도록 바꾼 예시입니다.',
      tags: message.analysis?.detectedIssues ?? ['natural_phrasing'],
    }));
}

function getRecommendedScenarioIds(scenario: Scenario) {
  return scenarios
    .filter((candidate) => candidate.level === scenario.level && candidate.id !== scenario.id)
    .slice(0, 2)
    .map((candidate) => candidate.id);
}

function normalizeSentence(sentence: string) {
  return sentence.toLowerCase().replace(/\s+/g, ' ').trim();
}

function clampScore(score: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(score)));
}
