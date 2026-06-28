import { getApiBaseUrl } from '../config/api';
import type { SkillTag } from '../types/conversation';
import type {
  LearningQuestion,
  WritingEvaluationResult,
  WritingLearningQuestion,
  WritingRubricScores,
} from '../types/learning';
import { getAiRequestHeaders } from './apiClientIdentity';

const CORRECT_SCORE_THRESHOLD = 75;
const FRIEND_INTRODUCTION_MIN_SCORE = 80;
const HIGH_CONFIDENCE_CORRECT_SCORE = 90;
const FULL_WRITING_SCORE = 100;
const WRITING_RUBRIC_MAX: WritingRubricScores = {
  taskCompletion: 35,
  meaning: 30,
  grammar: 20,
  naturalness: 15,
};
const MIN_ENGLISH_TOKEN_COUNT = 2;
const MIN_KOREAN_TRANSLATION_KEYWORD_HITS = 2;
const MIN_FULL_KOREAN_TRANSLATION_LENGTH_RATIO = 0.6;
const MIN_KOREAN_TRANSLATION_KEYWORD_RATIO = 0.75;
const MIN_LOCAL_CONTENT_TOKEN_HITS = 2;
const MIN_LOCAL_CONTENT_OVERLAP_RATIO = 0.6;
const MIN_CORE_COMPLETE_CONTENT_OVERLAP_RATIO = 0.8;
const MIN_CORE_COMPLETE_LENGTH_RATIO = 0.9;
const MIN_REPLACEABLE_CONTENT_TOKENS = 1;
const REPLACEABLE_STRUCTURE_RATIO = 0.8;
const MIN_REPLACEMENT_LENGTH_RATIO = 0.6;
const STOP_WORDS = new Set([
  'a',
  'an',
  'am',
  'are',
  'at',
  'be',
  'because',
  'but',
  'can',
  'could',
  'do',
  'for',
  'from',
  'have',
  'i',
  "i'm",
  'if',
  'in',
  'is',
  'it',
  'like',
  'me',
  'my',
  'name',
  'of',
  'on',
  'the',
  'this',
  'to',
  'with',
  'you',
  'your',
]);
const ARTICLE_TOKENS = new Set(['a', 'an', 'the']);
const STRUCTURAL_TOKENS = new Set([
  'because',
  'but',
  'can',
  'could',
  'going',
  'help',
  'if',
  'last',
  'like',
  'name',
  'point',
  'think',
  'understand',
  'weekend',
]);
const REQUIRED_CONTEXT_TOKENS = new Set([
  'classes',
  'flexible',
  'homework',
  'online',
  'productivity',
  'weekend',
  'work',
]);
const LOW_QUALITY_REPLACEMENT_TOKENS = new Set([
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
const FOOD_TOKENS = new Set([
  'apple',
  'banana',
  'beef',
  'bread',
  'burger',
  'cake',
  'carrot',
  'cheese',
  'chicken',
  'chocolate',
  'coffee',
  'cookie',
  'cream',
  'egg',
  'fish',
  'food',
  'fruit',
  'grape',
  'hamburger',
  'ice',
  'kimchi',
  'mango',
  'milk',
  'noodle',
  'orange',
  'pasta',
  'pizza',
  'pork',
  'potato',
  'rice',
  'salad',
  'sandwich',
  'soup',
  'strawberry',
  'sushi',
  'tea',
  'tomato',
  'water',
]);
const ENGLISH_CONTRACTION_EXPANSIONS: Record<string, string> = {
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
const NEGATIVE_PREFERENCE_STRUCTURE_TOKENS = new Set([
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
const PLAN_ACTIVITY_TOKENS = new Set([
  'buy',
  'clean',
  'cook',
  'eat',
  'exercise',
  'go',
  'hike',
  'learn',
  'meet',
  'movie',
  'play',
  'practice',
  'read',
  'rest',
  'run',
  'shop',
  'soccer',
  'study',
  'swim',
  'travel',
  'trip',
  'visit',
  'walk',
  'watch',
  'work',
]);
const OPINION_CONTRAST_TOKENS = new Set([
  'agree',
  'believe',
  'concern',
  'different',
  'disagree',
  'feel',
  'idea',
  'issue',
  'opinion',
  'perspective',
  'think',
  'view',
]);
const PAST_TRIP_ACTION_TOKENS = new Set([
  'ate',
  'bought',
  'climbed',
  'enjoyed',
  'explored',
  'had',
  'met',
  'rode',
  'saw',
  'spent',
  'stayed',
  'swam',
  'took',
  'traveled',
  'travelled',
  'tried',
  'visited',
  'walked',
  'went',
]);
const ONLINE_CLASS_REASON_TOKENS = new Set([
  'comfortable',
  'convenient',
  'easy',
  'efficient',
  'helpful',
  'home',
  'learn',
  'review',
  'safe',
  'save',
  'study',
  'time',
  'useful',
]);
const FLEXIBLE_WORK_ACTOR_TOKENS = new Set([
  'colleague',
  'colleagues',
  'employee',
  'employees',
  'member',
  'members',
  'people',
  'person',
  'team',
  'teams',
  'worker',
  'workers',
]);
const FLEXIBLE_WORK_CONDITION_TOKENS = new Set([
  'clearly',
  'collaborate',
  'communicate',
  'coordinate',
  'plan',
  'share',
  'together',
  'work',
]);
const POSITIVE_MOOD_TOKENS = new Set([
  'excited',
  'fine',
  'good',
  'great',
  'happy',
  'ok',
  'okay',
  'well',
]);
const FEELING_VERB_TOKENS = new Set(['feel', 'feeling']);
const WORK_DOCUMENT_TOKENS = new Set([
  'document',
  'file',
  'paper',
  'report',
]);
const SEND_REQUEST_TOKENS = new Set([
  'forward',
  'send',
  'share',
]);
const REFUND_REQUEST_VERB_TOKENS = new Set([
  'get',
  'have',
  'receive',
  'request',
]);

type WritingEvaluationInput = {
  question: LearningQuestion;
  answer: string;
};

type WritingEvaluationApiResponse = Partial<WritingEvaluationResult>;

type ReplacementContext =
  | 'flexibleWork'
  | 'food'
  | 'name'
  | 'onlineClassOpinion'
  | 'opinionContrast'
  | 'pastTrip'
  | 'plan'
  | 'general';

type IncorrectFeedbackOverride = {
  correctedAnswer?: string;
  feedbackKo: string;
  weakAreaKo?: string;
};

export async function evaluateWritingAnswer(
  input: WritingEvaluationInput,
): Promise<WritingEvaluationResult> {
  const question = assertWritingQuestion(input.question);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/writing/evaluate`, {
      method: 'POST',
      headers: await getAiRequestHeaders(),
      body: JSON.stringify({
        question: {
          id: question.id,
          level: question.level,
          area: question.area,
          promptKo: question.promptKo,
        questionText: question.questionText,
        sampleAnswer: question.sampleAnswer,
        evaluationFocusKo: question.evaluationFocusKo,
        expectedKeywords: question.expectedKeywords ?? [],
        answerLanguage: question.answerLanguage ?? 'en',
        expectedKeywordsKo: question.expectedKeywordsKo ?? [],
        readingDifficulty: question.readingDifficulty ?? null,
        timeLimitSeconds: question.timeLimitSeconds ?? null,
      },
      answer: input.answer,
      }),
    });

    if (!response.ok) {
      throw new Error(`Writing evaluation API failed with ${response.status}`);
    }

    return normalizeWritingEvaluation(await response.json(), question, input.answer);
  } catch (error) {
    console.warn('Using local writing evaluation fallback:', error);
    return evaluateWritingAnswerLocally(input);
  }
}

export function evaluateWritingAnswerLocally({
  question,
  answer,
}: WritingEvaluationInput): WritingEvaluationResult {
  const writingQuestion = assertWritingQuestion(question);
  const trimmedAnswer = answer.trim();

  if (!trimmedAnswer) {
    return createIncorrectResult({
      question: writingQuestion,
      score: 0,
      feedbackKo: '답안을 입력해야 채점할 수 있습니다.',
    });
  }

  if (writingQuestion.answerLanguage === 'ko') {
    return evaluateKoreanTranslationAnswerLocally({
      answer: trimmedAnswer,
      question: writingQuestion,
    });
  }

  const answerTokens = getEnglishTokens(trimmedAnswer);

  if (answerTokens.length === 0) {
    return createIncorrectResult({
      question: writingQuestion,
      score: 0,
      feedbackKo: '영어 문장으로 답안을 작성해 주세요.',
    });
  }

  if (answerTokens.length < MIN_ENGLISH_TOKEN_COUNT) {
    return createIncorrectResult({
      question: writingQuestion,
      score: 20,
      feedbackKo: '문장이 너무 짧습니다. 구체적인 내용을 더 넣어 보세요.',
    });
  }

  const sampleTokens = getEnglishTokens(writingQuestion.sampleAnswer);
  const answerTokenSet = new Set(answerTokens);
  const keywordTokens = getEvaluationKeywordTokens(writingQuestion);
  const keywordHitCount = keywordTokens.filter((token) => answerTokenSet.has(token)).length;
  const keywordRatio = keywordTokens.length > 0 ? keywordHitCount / keywordTokens.length : 1;
  const sampleContentTokens = getContentTokens(sampleTokens);
  const answerContentTokens = getContentTokens(answerTokens);
  const answerContentTokenSet = new Set(answerContentTokens);
  const contentHitCount = sampleContentTokens.filter((token) => answerContentTokenSet.has(token)).length;
  const contentOverlapRatio = sampleContentTokens.length > 0
    ? contentHitCount / sampleContentTokens.length
    : 1;
  const lengthCompleteness = sampleTokens.length > 0
    ? Math.min(answerTokens.length / sampleTokens.length, 1)
    : 1;
  const hasReplaceableContent = hasCompleteStructureWithReplacement({
    answerContentTokens,
    answerTokens,
    keywordTokens,
    question: writingQuestion,
    sampleTokens,
  });
  const exactMatchBonus = normalizeText(trimmedAnswer) === normalizeText(writingQuestion.sampleAnswer) ? 10 : 0;
  const replacementBonus = hasReplaceableContent ? 35 : 0;
  const coreCompleteBonus = hasCoreCompleteAnswer({
    contentHitCount,
    contentOverlapRatio,
    keywordRatio,
    lengthCompleteness,
    sampleContentTokens,
  }) ? 10 : 0;
  const effectiveKeywordRatio = hasReplaceableContent
    ? Math.max(keywordRatio, REPLACEABLE_STRUCTURE_RATIO)
    : keywordRatio;
  const score = clampScore(Math.round(
    effectiveKeywordRatio * 30 +
    contentOverlapRatio * 25 +
    lengthCompleteness * 15 +
    replacementBonus +
    coreCompleteBonus +
    exactMatchBonus,
  ));
  const hasEnoughContent = sampleContentTokens.length === 0
    ? answerContentTokens.length > 0
    : (
        contentHitCount >= Math.min(MIN_LOCAL_CONTENT_TOKEN_HITS, sampleContentTokens.length) &&
        contentOverlapRatio >= MIN_LOCAL_CONTENT_OVERLAP_RATIO
      ) || hasReplaceableContent;
  const isCorrect = score >= CORRECT_SCORE_THRESHOLD && hasEnoughContent;

  if (isClearFriendIntroductionAnswer(trimmedAnswer, writingQuestion)) {
    return createFriendIntroductionAcceptedResult({
      answer: trimmedAnswer,
      evaluationSource: 'localFallback',
      score,
    });
  }

  if (isClearEquivalentWritingAnswer(trimmedAnswer, writingQuestion)) {
    return completeWritingEvaluation({
      score: Math.max(score, HIGH_CONFIDENCE_CORRECT_SCORE),
      isCorrect: true,
      correctedAnswer: trimmedAnswer,
      feedbackKo: '\uC758\uBBF8\uC640 \uACFC\uC81C \uC694\uAD6C\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uCDA9\uC871\uD588\uC2B5\uB2C8\uB2E4.',
      weakAreaKo: '',
      evaluationSource: 'localFallback',
    }, writingQuestion);
  }

  if (!isCorrect) {
    const targetedFeedback = getTargetedIncorrectFeedback({
      answerContentTokens,
      answerTokens,
      question: writingQuestion,
    });

    return createIncorrectResult({
      question: writingQuestion,
      score,
      correctedAnswer: targetedFeedback?.correctedAnswer,
      feedbackKo: targetedFeedback?.feedbackKo ?? (hasEnoughContent
        ? `핵심 표현을 더 정확하게 써 보세요. 평가 기준: ${writingQuestion.evaluationFocusKo}`
        : '구체적인 내용을 더 넣어 완전한 영어 문장으로 써 보세요.'),
      weakAreaKo: targetedFeedback?.weakAreaKo,
    });
  }

  return completeWritingEvaluation({
    score: FULL_WRITING_SCORE,
    isCorrect: true,
    correctedAnswer: trimmedAnswer,
    feedbackKo: '핵심 표현과 문장 구조를 잘 사용했습니다.',
    weakAreaKo: '',
    evaluationSource: 'localFallback',
  }, writingQuestion);
}

function normalizeWritingEvaluation(
  response: WritingEvaluationApiResponse,
  question: WritingLearningQuestion,
  answer: string,
): WritingEvaluationResult {
  const score = clampScore(Number(response.score));
  const modelIsCorrect = typeof response.isCorrect === 'boolean' ? response.isCorrect : score >= CORRECT_SCORE_THRESHOLD;
  const trimmedAnswer = answer.trim();
  const correctedAnswer = getNonEmptyString(response.correctedAnswer, trimmedAnswer || question.sampleAnswer);
  const answerCanBeCorrect = isPotentiallyValidAnswerForQuestion(trimmedAnswer, question);
  const answerMatchesCorrection = isAnswerEquivalentToCorrection({
    answer: trimmedAnswer,
    correction: correctedAnswer,
    question,
  });
  const normalizedIsCorrect = score >= CORRECT_SCORE_THRESHOLD &&
    answerCanBeCorrect &&
    (modelIsCorrect || answerMatchesCorrection || score >= HIGH_CONFIDENCE_CORRECT_SCORE);

  if (isClearFriendIntroductionAnswer(trimmedAnswer, question)) {
    return createFriendIntroductionAcceptedResult({
      answer: trimmedAnswer,
      evaluationSource: 'ai',
      score,
    });
  }

  if (shouldNormalizeToCleanFullScore({
    answerCanBeCorrect,
    modelIsCorrect,
    question,
    score,
  })) {
    return createCleanFullScoreResult({
      answer: trimmedAnswer,
      evaluationSource: 'ai',
    });
  }

  return completeWritingEvaluation({
    score,
    isCorrect: normalizedIsCorrect,
    correctedAnswer,
    feedbackKo: getNonEmptyString(response.feedbackKo, '답안을 확인했습니다.'),
    weakAreaKo: normalizedIsCorrect && !modelIsCorrect
      ? ''
      : typeof response.weakAreaKo === 'string' ? response.weakAreaKo : '',
    evaluationSource: 'ai',
    rubric: normalizeWritingRubric(response.rubric, score),
    scoreReasonsKo: normalizedIsCorrect && !modelIsCorrect
      ? undefined
      : normalizeScoreReasons(response.scoreReasonsKo),
    skillTags: normalizedIsCorrect && !modelIsCorrect
      ? undefined
      : normalizeSkillTags(response.skillTags),
  }, question);
}

function isAnswerEquivalentToCorrection({
  answer,
  correction,
  question,
}: {
  answer: string;
  correction: string;
  question: WritingLearningQuestion;
}): boolean {
  if (!answer.trim() || !correction.trim()) {
    return false;
  }

  if (question.answerLanguage === 'ko') {
    return normalizeKoreanAnswerForComparison(answer) === normalizeKoreanAnswerForComparison(correction);
  }

  return normalizeText(answer) === normalizeText(correction);
}

function createCleanFullScoreResult({
  answer,
  evaluationSource,
}: {
  answer: string;
  evaluationSource: WritingEvaluationResult['evaluationSource'];
}): WritingEvaluationResult {
  return completeWritingEvaluation({
    score: FULL_WRITING_SCORE,
    isCorrect: true,
    correctedAnswer: answer,
    feedbackKo: '핵심 표현과 문장 구조를 자연스럽게 잘 사용했습니다.',
    weakAreaKo: '',
    evaluationSource,
  }, null);
}

function createFriendIntroductionAcceptedResult({
  answer,
  evaluationSource,
  score,
}: {
  answer: string;
  evaluationSource: WritingEvaluationResult['evaluationSource'];
  score: number;
}): WritingEvaluationResult {
  return completeWritingEvaluation({
    score: Math.max(clampScore(score), FRIEND_INTRODUCTION_MIN_SCORE),
    isCorrect: true,
    correctedAnswer: answer,
    feedbackKo: '친구를 소개하는 영어 문장 구조는 맞습니다. 다만 사람을 부정적으로 평가하는 표현은 실제 대화에서 조심해 보세요.',
    weakAreaKo: '표현의 어감',
    evaluationSource,
  }, null);
}

function shouldNormalizeToCleanFullScore({
  answerCanBeCorrect,
  modelIsCorrect,
  question,
  score,
}: {
  answerCanBeCorrect: boolean;
  modelIsCorrect: boolean;
  question: WritingLearningQuestion;
  score: number;
}): boolean {
  return question.answerLanguage !== 'ko' &&
    modelIsCorrect &&
    answerCanBeCorrect &&
    score >= HIGH_CONFIDENCE_CORRECT_SCORE;
}

function evaluateKoreanTranslationAnswerLocally({
  answer,
  question,
}: {
  answer: string;
  question: WritingLearningQuestion;
}): WritingEvaluationResult {
  if (!hasHangul(answer)) {
    return createIncorrectResult({
      question,
      score: 0,
      feedbackKo: '영어 지문을 한글로 번역해서 입력해 주세요.',
      weakAreaKo: '한글 번역 입력',
    });
  }

  const keywords = getKoreanTranslationKeywords(question);
  const keywordHitCount = getKoreanTranslationKeywordHitCount(answer, question);
  const keywordRatio = keywords.length > 0 ? keywordHitCount / keywords.length : 1;
  const answerTokenCount = getKoreanContentTokens(answer).length;
  const sampleTokenCount = Math.max(getKoreanContentTokens(question.sampleAnswer).length, 1);
  const lengthRatio = Math.min(answerTokenCount / sampleTokenCount, 1);
  const baseScore = clampScore(Math.round(keywordRatio * 75 + lengthRatio * 25));
  const score = isCompleteLocalKoreanTranslation({ keywordRatio, lengthRatio })
    ? FULL_WRITING_SCORE
    : baseScore;
  const enoughKeywords = keywordHitCount >= Math.min(
    MIN_KOREAN_TRANSLATION_KEYWORD_HITS,
    keywords.length,
  );
  const isCorrect = score >= CORRECT_SCORE_THRESHOLD && enoughKeywords;

  if (!isCorrect) {
    return createIncorrectResult({
      question,
      score,
      feedbackKo: `핵심 의미를 더 정확히 옮겨 보세요. 확인할 표현: ${getKoreanTranslationFeedbackFocus(question)}`,
      weakAreaKo: question.evaluationFocusKo,
    });
  }

  return completeWritingEvaluation({
    score,
    isCorrect: true,
    correctedAnswer: answer,
    feedbackKo: '핵심 의미를 자연스럽게 한글로 옮겼습니다.',
    weakAreaKo: '',
    evaluationSource: 'localFallback',
  }, question);
}

function getTargetedIncorrectFeedback({
  answerContentTokens,
  answerTokens,
  question,
}: {
  answerContentTokens: string[];
  answerTokens: string[];
  question: WritingLearningQuestion;
}): IncorrectFeedbackOverride | null {
  const articleFeedback = getArticleUsageFeedback({
    answerTokens,
    question,
  });

  if (articleFeedback) {
    return articleFeedback;
  }

  if (getReplacementContext(question) !== 'food') {
    return null;
  }

  const answerTokenSet = new Set(answerTokens);

  if (!answerTokenSet.has('i') || !answerTokenSet.has('like')) {
    return null;
  }

  const likelyFoodCorrection = getLikelyFoodCorrection(answerContentTokens);

  if (!likelyFoodCorrection) {
    return null;
  }

  const correctedAnswer = hasTokenSequence(answerTokens, ['it', 'is'])
    ? `I like ${likelyFoodCorrection} because it is very delicious.`
    : `I like ${likelyFoodCorrection}.`;

  return {
    correctedAnswer,
    feedbackKo: `${likelyFoodCorrection} 철자를 확인하고, 설명을 덧붙일 때는 because로 연결해 한 문장으로 써 보세요.`,
    weakAreaKo: '음식 단어 철자와 문장 연결',
  };
}

function getArticleUsageFeedback({
  answerTokens,
  question,
}: {
  answerTokens: string[];
  question: WritingLearningQuestion;
}): IncorrectFeedbackOverride | null {
  if (!hasArticleUsageIssue({
    answerTokens,
    sampleTokens: getEnglishTokens(question.sampleAnswer),
  })) {
    return null;
  }

  return {
    correctedAnswer: question.sampleAnswer,
    feedbackKo: '명사 앞에 필요한 관사(a/an/the)를 넣어 문장을 완성해 보세요.',
    weakAreaKo: '관사 사용',
  };
}

function hasArticleUsageIssue({
  answerTokens,
  sampleTokens,
}: {
  answerTokens: string[];
  sampleTokens: string[];
}): boolean {
  return sampleTokens.some((sampleToken, index) => {
    if (!ARTICLE_TOKENS.has(sampleToken)) {
      return false;
    }

    const nounToken = sampleTokens[index + 1];

    if (!nounToken || ARTICLE_TOKENS.has(nounToken) || STOP_WORDS.has(nounToken)) {
      return false;
    }

    return answerTokens.some((answerToken, answerIndex) => {
      if (answerToken !== nounToken) {
        return false;
      }

      const previousAnswerToken = answerTokens[answerIndex - 1];

      if (!ARTICLE_TOKENS.has(previousAnswerToken)) {
        return true;
      }

      return (sampleToken === 'a' && previousAnswerToken === 'an') ||
        (sampleToken === 'an' && previousAnswerToken === 'a');
    });
  });
}

function createIncorrectResult({
  question,
  score,
  correctedAnswer,
  feedbackKo,
  weakAreaKo,
}: {
  question: WritingLearningQuestion;
  score: number;
  correctedAnswer?: string;
  feedbackKo: string;
  weakAreaKo?: string;
}): WritingEvaluationResult {
  return completeWritingEvaluation({
    score: clampScore(score),
    isCorrect: false,
    correctedAnswer: correctedAnswer ?? question.sampleAnswer,
    feedbackKo,
    weakAreaKo: weakAreaKo ?? question.evaluationFocusKo,
    evaluationSource: 'localFallback',
  }, question);
}

function completeWritingEvaluation(
  result: WritingEvaluationResult,
  question: WritingLearningQuestion | null,
): WritingEvaluationResult {
  const rubric = normalizeWritingRubric(result.rubric, result.score);
  const scoreReasonsKo = result.scoreReasonsKo?.length
    ? result.scoreReasonsKo
    : createScoreReasons(result);
  const skillTags = result.skillTags?.length
    ? result.skillTags
    : inferWritingSkillTags(result, question);

  return {
    ...result,
    rubric,
    scoreReasonsKo,
    skillTags,
  };
}

function normalizeWritingRubric(
  value: unknown,
  score: number,
): WritingRubricScores {
  if (isWritingRubricScores(value)) {
    return {
      taskCompletion: clampRubricScore(value.taskCompletion, WRITING_RUBRIC_MAX.taskCompletion),
      meaning: clampRubricScore(value.meaning, WRITING_RUBRIC_MAX.meaning),
      grammar: clampRubricScore(value.grammar, WRITING_RUBRIC_MAX.grammar),
      naturalness: clampRubricScore(value.naturalness, WRITING_RUBRIC_MAX.naturalness),
    };
  }

  return createRubricFromScore(score);
}

function isWritingRubricScores(value: unknown): value is WritingRubricScores {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Partial<WritingRubricScores>).taskCompletion === 'number' &&
    typeof (value as Partial<WritingRubricScores>).meaning === 'number' &&
    typeof (value as Partial<WritingRubricScores>).grammar === 'number' &&
    typeof (value as Partial<WritingRubricScores>).naturalness === 'number'
  );
}

function createRubricFromScore(score: number): WritingRubricScores {
  const clampedScore = clampScore(score);
  const taskCompletion = Math.min(
    WRITING_RUBRIC_MAX.taskCompletion,
    Math.round(clampedScore * 0.35),
  );
  const meaning = Math.min(WRITING_RUBRIC_MAX.meaning, Math.round(clampedScore * 0.3));
  const grammar = Math.min(WRITING_RUBRIC_MAX.grammar, Math.round(clampedScore * 0.2));
  const naturalness = Math.min(
    WRITING_RUBRIC_MAX.naturalness,
    Math.max(0, clampedScore - taskCompletion - meaning - grammar),
  );

  return {
    taskCompletion,
    meaning,
    grammar,
    naturalness,
  };
}

function clampRubricScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(maxScore, Math.max(0, Math.round(score)));
}

function normalizeScoreReasons(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const reasons = value.filter((item): item is string => (
    typeof item === 'string' && item.trim().length > 0
  ));

  return reasons.length > 0 ? reasons : undefined;
}

function normalizeSkillTags(value: unknown): SkillTag[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value.filter(isSkillTag);

  return tags.length > 0 ? [...new Set(tags)] : undefined;
}

function isSkillTag(value: unknown): value is SkillTag {
  return [
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
  ].includes(value as SkillTag);
}

function createScoreReasons(result: WritingEvaluationResult): string[] {
  if (result.isCorrect) {
    const reasons = ['과제 요구를 충족했습니다.', '핵심 의미가 전달되었습니다.'];

    if (result.score < FULL_WRITING_SCORE) {
      reasons.push('문장부호, 대문자, 자연스러움은 조금 더 다듬을 수 있습니다.');
    }

    return reasons;
  }

  const weakArea = result.weakAreaKo?.trim();

  return [
    '과제 요구를 완전히 충족하지 못했습니다.',
    weakArea ? `${weakArea} 부분을 보완해 보세요.` : '핵심 의미와 문장 구조를 보완해 보세요.',
  ];
}

function inferWritingSkillTags(
  result: WritingEvaluationResult,
  question: WritingLearningQuestion | null,
): SkillTag[] {
  if (result.isCorrect) {
    return [];
  }

  const searchableText = [
    question?.promptKo,
    question?.questionText,
    question?.evaluationFocusKo,
    question?.weakPointLabel,
    result.feedbackKo,
    result.weakAreaKo,
  ].filter(Boolean).join(' ').toLowerCase();
  const tags = new Set<SkillTag>();

  if (/article|관사/.test(searchableText)) {
    tags.add('articles');
  }

  if (/preposition|전치사|위치/.test(searchableText)) {
    tags.add('prepositions');
  }

  if (/tense|시제|과거|현재|미래|완료|동사/.test(searchableText)) {
    tags.add('verb_tense');
  }

  if (/question|의문|질문|묻/.test(searchableText)) {
    tags.add('question_comprehension');
  }

  if (/vocabulary|어휘|단어|철자|음식|food|sushi|apple|keyword/.test(searchableText)) {
    tags.add('vocabulary_range');
  }

  if (/could|please|정중|공손|요청/.test(searchableText)) {
    tags.add('polite_requests');
  }

  if (/natural|자연|표현|어감|흐름/.test(searchableText)) {
    tags.add('natural_phrasing');
  }

  if (tags.size === 0 && searchableText.trim().length > 0) {
    tags.add('task_completion');
  }

  return [...tags];
}

function assertWritingQuestion(question: LearningQuestion): WritingLearningQuestion {
  if (question.kind !== 'writing') {
    throw new Error('Writing evaluation requires a writing question.');
  }

  return question;
}

function getEvaluationKeywordTokens(question: WritingLearningQuestion): string[] {
  const explicitKeywordTokens = (question.expectedKeywords ?? []).flatMap(getEnglishTokens);
  const fallbackTokens = getContentTokens(getEnglishTokens(question.sampleAnswer));
  const tokens = explicitKeywordTokens.length > 0 ? explicitKeywordTokens : fallbackTokens;

  return [...new Set(tokens)];
}

function hasCompleteStructureWithReplacement({
  answerContentTokens,
  answerTokens,
  keywordTokens,
  question,
  sampleTokens,
}: {
  answerContentTokens: string[];
  answerTokens: string[];
  keywordTokens: string[];
  question: WritingLearningQuestion;
  sampleTokens: string[];
}): boolean {
  const structureTokens = getReplacementStructureTokens({
    keywordTokens,
    sampleTokens,
  });

  if (structureTokens.length === 0) {
    return false;
  }

  const answerTokenSet = new Set(answerTokens);
  const structureHitCount = structureTokens.filter((token) => answerTokenSet.has(token)).length;
  const structureRatio = structureHitCount / structureTokens.length;

  if (structureRatio < REPLACEABLE_STRUCTURE_RATIO) {
    return false;
  }

  const structureTokenSet = new Set(structureTokens);
  const replacementTokens = answerContentTokens.filter((token) => !structureTokenSet.has(token));
  const hasComparableLength = sampleTokens.length === 0 ||
    answerTokens.length >= Math.ceil(sampleTokens.length * MIN_REPLACEMENT_LENGTH_RATIO);

  return hasComparableLength && hasPlausibleReplacementContent({
    answerTokens,
    question,
    replacementTokens,
  });
}

function getReplacementStructureTokens({
  keywordTokens,
  sampleTokens,
}: {
  keywordTokens: string[];
  sampleTokens: string[];
}): string[] {
  const sampleSpecificContentTokenSet = new Set(
    getContentTokens(sampleTokens).filter((token) => !isStructuralToken(token)),
  );
  const structureTokens = keywordTokens.filter((token) => {
    if (isStructuralToken(token)) {
      return true;
    }

    return !sampleSpecificContentTokenSet.has(token);
  });

  return [...new Set(structureTokens)];
}

function hasPlausibleReplacementContent({
  answerTokens,
  question,
  replacementTokens,
}: {
  answerTokens: string[];
  question: WritingLearningQuestion;
  replacementTokens: string[];
}): boolean {
  const meaningfulReplacementTokens = [...new Set(replacementTokens.filter(isMeaningfulReplacementToken))];

  if (meaningfulReplacementTokens.length < MIN_REPLACEABLE_CONTENT_TOKENS) {
    return false;
  }

  const context = getReplacementContext(question);

  if (context === 'food') {
    return meaningfulReplacementTokens.some(isFoodToken);
  }

  if (context === 'name') {
    return meaningfulReplacementTokens.some(isLikelyNameToken);
  }

  if (context === 'plan') {
    return meaningfulReplacementTokens.some((token) => PLAN_ACTIVITY_TOKENS.has(toSingularToken(token)));
  }

  if (context === 'opinionContrast') {
    return meaningfulReplacementTokens.some((token) => OPINION_CONTRAST_TOKENS.has(toSingularToken(token)));
  }

  if (context === 'pastTrip') {
    const pastTripActionCount = meaningfulReplacementTokens.filter((token) => (
      PAST_TRIP_ACTION_TOKENS.has(toSingularToken(token))
    )).length;

    return pastTripActionCount >= 2;
  }

  if (context === 'onlineClassOpinion') {
    const reasonTokens = getMeaningfulTokensAfterMarker(answerTokens, 'because');

    return reasonTokens.some((token) => ONLINE_CLASS_REASON_TOKENS.has(toSingularToken(token)));
  }

  if (context === 'flexibleWork') {
    const conditionTokens = getMeaningfulTokensAfterMarker(answerTokens, 'if');

    return conditionTokens.some((token) => FLEXIBLE_WORK_ACTOR_TOKENS.has(toSingularToken(token))) &&
      conditionTokens.some((token) => FLEXIBLE_WORK_CONDITION_TOKENS.has(toSingularToken(token)));
  }

  return false;
}

function getReplacementContext(question: WritingLearningQuestion): ReplacementContext {
  const metadata = `${question.promptKo} ${question.evaluationFocusKo} ${question.sampleAnswer}`.toLowerCase();
  const keywordTokens = getEvaluationKeywordTokens(question);
  const keywordTokenSet = new Set(keywordTokens);

  if (metadata.includes('음식') || metadata.includes('food')) {
    return 'food';
  }

  if (keywordTokenSet.has('name') || metadata.includes('name')) {
    return 'name';
  }

  if (keywordTokenSet.has('understand') && keywordTokenSet.has('point') && keywordTokenSet.has('but')) {
    return 'opinionContrast';
  }

  if (
    keywordTokenSet.has('last') &&
    (keywordTokenSet.has('visited') || keywordTokenSet.has('enjoyed'))
  ) {
    return 'pastTrip';
  }

  if (
    keywordTokenSet.has('think') &&
    keywordTokenSet.has('because') &&
    keywordTokenSet.has('online') &&
    keywordTokenSet.has('classes')
  ) {
    return 'onlineClassOpinion';
  }

  if (
    keywordTokenSet.has('flexible') &&
    keywordTokenSet.has('productivity') &&
    keywordTokenSet.has('if')
  ) {
    return 'flexibleWork';
  }

  if (
    metadata.includes('계획') ||
    metadata.includes('plan') ||
    keywordTokenSet.has('going') ||
    keywordTokenSet.has('weekend')
  ) {
    return 'plan';
  }

  return 'general';
}

function hasCoreCompleteAnswer({
  contentHitCount,
  contentOverlapRatio,
  keywordRatio,
  lengthCompleteness,
  sampleContentTokens,
}: {
  contentHitCount: number;
  contentOverlapRatio: number;
  keywordRatio: number;
  lengthCompleteness: number;
  sampleContentTokens: string[];
}): boolean {
  const requiredContentHitCount = Math.min(MIN_LOCAL_CONTENT_TOKEN_HITS, sampleContentTokens.length);

  return keywordRatio === 1 &&
    lengthCompleteness >= MIN_CORE_COMPLETE_LENGTH_RATIO &&
    contentOverlapRatio >= MIN_CORE_COMPLETE_CONTENT_OVERLAP_RATIO &&
    contentHitCount >= requiredContentHitCount;
}

function isPotentiallyValidAnswerForQuestion(
  answer: string,
  question: WritingLearningQuestion,
): boolean {
  if (question.answerLanguage === 'ko') {
    return hasEnoughKoreanTranslationKeywordCoverage(answer, question);
  }

  return getEnglishTokens(answer).length >= MIN_ENGLISH_TOKEN_COUNT;
}

function isClearFriendIntroductionAnswer(
  answer: string,
  question: WritingLearningQuestion,
): boolean {
  if (!isFriendIntroductionQuestion(question)) {
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

function isClearEquivalentWritingAnswer(
  answer: string,
  question: WritingLearningQuestion,
): boolean {
  const tokens = getEnglishTokens(answer);

  if (tokens.length < MIN_ENGLISH_TOKEN_COUNT) {
    return false;
  }

  return isClearWeekendPlanQuestion(tokens, question) ||
    isClearDocumentByTomorrowRequest(tokens, question) ||
    isClearRefundRequest(tokens, question) ||
    isClearMoodTodayAnswer(tokens, question) ||
    isClearNegativePreferenceAnswer(tokens, question);
}

function isClearNegativePreferenceAnswer(
  tokens: string[],
  question: WritingLearningQuestion,
): boolean {
  if (!isNegativePreferenceQuestion(question)) {
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

function isClearMoodTodayAnswer(
  tokens: string[],
  question: WritingLearningQuestion,
): boolean {
  if (!isMoodTodayQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const hasFirstPersonSubject = tokens.includes('i');
  const hasTodayContext = tokenSet.has('today');
  const hasPositiveMood = [...POSITIVE_MOOD_TOKENS].some((token) => tokenSet.has(token));
  const usesBeMoodPattern = hasTokenSequence(tokens, ['i', 'am']) && hasPositiveMood;
  const usesFeelMoodPattern = hasFirstPersonSubject &&
    tokens.some((token) => FEELING_VERB_TOKENS.has(toSingularToken(token))) &&
    hasPositiveMood;

  return hasFirstPersonSubject &&
    hasTodayContext &&
    (usesBeMoodPattern || usesFeelMoodPattern);
}

function isClearWeekendPlanQuestion(
  tokens: string[],
  question: WritingLearningQuestion,
): boolean {
  if (!isWeekendPlanQuestion(question)) {
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

function isClearDocumentByTomorrowRequest(
  tokens: string[],
  question: WritingLearningQuestion,
): boolean {
  if (!isDocumentByTomorrowRequestQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const isPoliteRequest = hasTokenSequence(tokens, ['could', 'you']) ||
    hasTokenSequence(tokens, ['would', 'you']) ||
    tokens.includes('please');
  const hasSendAction = [...SEND_REQUEST_TOKENS].some((token) => tokenSet.has(token));
  const hasWorkObject = [...WORK_DOCUMENT_TOKENS].some((token) => tokenSet.has(token));

  return isPoliteRequest &&
    hasSendAction &&
    hasWorkObject &&
    tokenSet.has('tomorrow');
}

function isWeekendPlanQuestion(question: WritingLearningQuestion): boolean {
  const metadata = `${question.id} ${question.promptKo} ${question.sampleAnswer} ${question.evaluationFocusKo}`.toLowerCase();
  const keywordTokenSet = new Set(getEvaluationKeywordTokens(question));

  return metadata.includes('weekend') &&
    (metadata.includes('plan') || keywordTokenSet.has('weekend') || keywordTokenSet.has('planning'));
}

function isDocumentByTomorrowRequestQuestion(question: WritingLearningQuestion): boolean {
  const metadata = `${question.id} ${question.promptKo} ${question.sampleAnswer} ${question.evaluationFocusKo}`.toLowerCase();
  const keywordTokenSet = new Set(getEvaluationKeywordTokens(question));

  return metadata.includes('tomorrow') &&
    (metadata.includes('report') || metadata.includes('document') || keywordTokenSet.has('report')) &&
    (metadata.includes('send') || keywordTokenSet.has('could') || keywordTokenSet.has('tomorrow'));
}

function isMoodTodayQuestion(question: WritingLearningQuestion): boolean {
  const metadata = `${question.id} ${question.promptKo} ${question.sampleAnswer} ${question.evaluationFocusKo}`.toLowerCase();
  const keywordTokenSet = new Set(getEvaluationKeywordTokens(question));

  if (question.id === 'a1-writing-feeling-001') {
    return true;
  }

  return metadata.includes('happy today') &&
    keywordTokenSet.has('i') &&
    keywordTokenSet.has('am') &&
    keywordTokenSet.has('today');
}

function isClearRefundRequest(
  tokens: string[],
  question: WritingLearningQuestion,
): boolean {
  if (!isRefundRequestQuestion(question)) {
    return false;
  }

  const tokenSet = new Set(tokens.map(toSingularToken));
  const isPoliteQuestion = (
    (tokens.includes('could') || tokens.includes('can') || tokens.includes('may')) &&
    tokens.includes('i')
  );
  const hasRefundRequestVerb = [...REFUND_REQUEST_VERB_TOKENS].some((token) => tokenSet.has(token));

  return isPoliteQuestion &&
    tokenSet.has('refund') &&
    hasRefundRequestVerb;
}

function isRefundRequestQuestion(question: WritingLearningQuestion): boolean {
  const metadata = `${question.id} ${question.promptKo} ${question.sampleAnswer} ${question.evaluationFocusKo} ${question.weakPointLabel}`.toLowerCase();
  const keywordTokenSet = new Set(getEvaluationKeywordTokens(question));

  return metadata.includes('refund') || keywordTokenSet.has('refund');
}

function isNegativePreferenceQuestion(question: WritingLearningQuestion): boolean {
  const sampleTokens = getEnglishTokens(question.sampleAnswer);
  const keywordTokenSet = new Set(getEvaluationKeywordTokens(question));

  return hasTokenSequence(sampleTokens, ['i', 'do', 'not', 'like']) ||
    (keywordTokenSet.has('not') && keywordTokenSet.has('like'));
}

function getNegativePreferenceTargetTokens(question: WritingLearningQuestion): string[] {
  const targetTokens = [
    ...getEvaluationKeywordTokens(question),
    ...getEnglishTokens(question.sampleAnswer),
  ]
    .map(toSingularToken)
    .filter((token) => token.length > 2 && !NEGATIVE_PREFERENCE_STRUCTURE_TOKENS.has(token));

  return [...new Set(targetTokens)];
}

function isFriendIntroductionQuestion(question: WritingLearningQuestion): boolean {
  const metadata = `${question.id} ${question.promptKo} ${question.sampleAnswer} ${question.evaluationFocusKo}`.toLowerCase();

  if (question.id === 'a1-writing-introduce-friend-002') {
    return true;
  }

  return metadata.includes('friend') &&
    metadata.includes('\uCE5C\uAD6C') &&
    metadata.includes('\uC18C\uAC1C');
}

function isPlausibleFriendDescriptionToken(token: string): boolean {
  return isMeaningfulReplacementToken(token) &&
    !LOW_QUALITY_REPLACEMENT_TOKENS.has(toSingularToken(token));
}

function getContentTokens(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getMeaningfulTokensAfterMarker(tokens: string[], marker: string): string[] {
  const markerIndex = tokens.indexOf(marker);

  if (markerIndex === -1) {
    return [];
  }

  return getContentTokens(tokens.slice(markerIndex + 1)).filter(isMeaningfulReplacementToken);
}

function isStructuralToken(token: string): boolean {
  return STOP_WORDS.has(token) || STRUCTURAL_TOKENS.has(token) || REQUIRED_CONTEXT_TOKENS.has(token);
}

function isMeaningfulReplacementToken(token: string): boolean {
  return /^[a-z][a-z']*$/.test(token) && !LOW_QUALITY_REPLACEMENT_TOKENS.has(toSingularToken(token));
}

function isFoodToken(token: string): boolean {
  return FOOD_TOKENS.has(toSingularToken(token));
}

function getLikelyFoodCorrection(tokens: string[]): string | null {
  let closestFood: string | null = null;
  let closestDistance = Number.MAX_SAFE_INTEGER;

  for (const token of tokens.filter(isMeaningfulReplacementToken).map(toSingularToken)) {
    if (FOOD_TOKENS.has(token) || token.length < 4) {
      continue;
    }

    for (const foodToken of FOOD_TOKENS) {
      const distance = getEditDistance(token, foodToken);
      const allowedDistance = token.length <= 5 ? 1 : 2;

      if (distance <= allowedDistance && distance < closestDistance) {
        closestFood = foodToken;
        closestDistance = distance;
      }
    }
  }

  return closestFood;
}

function hasTokenSequence(tokens: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }

  return tokens.some((_, index) => (
    sequence.every((token, sequenceIndex) => tokens[index + sequenceIndex] === token)
  ));
}

function getEditDistance(left: string, right: string): number {
  const distances = Array.from({ length: left.length + 1 }, (_, leftIndex) => (
    Array.from({ length: right.length + 1 }, (_, rightIndex) => (
      leftIndex === 0 ? rightIndex : rightIndex === 0 ? leftIndex : 0
    ))
  ));

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex - 1] + substitutionCost,
      );
    }
  }

  return distances[left.length][right.length];
}

function isLikelyNameToken(token: string): boolean {
  return /^[a-z][a-z']*$/.test(token) && token.length >= 2;
}

function toSingularToken(token: string): string {
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

function getEnglishTokens(value: string): string[] {
  return normalizeText(value).match(/[a-z0-9']+/g) ?? [];
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(
      /\b(aren't|can't|couldn't|didn't|doesn't|don't|hadn't|hasn't|haven't|i'm|isn't|shouldn't|wasn't|weren't|won't|wouldn't)\b/g,
      (contraction) => ENGLISH_CONTRACTION_EXPANSIONS[contraction] ?? contraction,
    )
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}

function getKoreanContentTokens(value: string): string[] {
  return value
    .replace(/[^\uAC00-\uD7A3\s0-9]/g, ' ')
    .split(/\s+/)
    .map(normalizeKoreanToken)
    .filter((token) => token.length > 0);
}

function normalizeKoreanToken(value: string): string {
  return stripKoreanSearchSuffixes(value.trim());
}

function hasKoreanKeywordConcept(answer: string, keyword: string): boolean {
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

  return getKoreanContentTokens(keyword).some((token) => {
    const normalizedToken = normalizeKoreanForSearch(token);

    return normalizedToken.length > 1 && normalizedAnswer.includes(normalizedToken);
  });
}

function normalizeKoreanForSearch(value: string): string {
  return value
    .replace(/[^\uAC00-\uD7A30-9\s]/g, ' ')
    .split(/\s+/)
    .map(normalizeKoreanSearchToken)
    .filter(Boolean)
    .join('');
}

function normalizeKoreanAnswerForComparison(value: string): string {
  return `${normalizeKoreanForSearch(value)}${normalizeText(value).replace(/\s+/g, '')}`;
}

function getKoreanTranslationFeedbackFocus(question: WritingLearningQuestion): string {
  const englishFocusTerms = extractEnglishFocusTerms(question.evaluationFocusKo);

  if (englishFocusTerms.length > 0) {
    return englishFocusTerms.join(', ');
  }

  const focus = question.evaluationFocusKo?.trim();

  if (focus) {
    return focus;
  }

  return question.questionText?.trim() || '핵심 의미';
}

function extractEnglishFocusTerms(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const matches = value.match(/[A-Za-z][A-Za-z' ]*[A-Za-z]/g) ?? [];
  const seen = new Set<string>();

  return matches.reduce<string[]>((terms, match) => {
    const term = match.trim().replace(/\s+/g, ' ');
    const key = term.toLowerCase();

    if (!term || seen.has(key)) {
      return terms;
    }

    seen.add(key);
    terms.push(term);
    return terms;
  }, []);
}

function normalizeKoreanSearchToken(value: string): string {
  const token = value.trim();
  const strippedToken = stripKoreanSearchSuffixes(token);

  return KOREAN_SEARCH_TOKEN_ALIASES[token] ??
    KOREAN_SEARCH_TOKEN_ALIASES[strippedToken] ??
    strippedToken;
}

function stripKoreanSearchSuffixes(value: string): string {
  const suffixes = [
    '입니다',
    '되었습니다',
    '했습니다',
    '었습니다',
    '았습니다',
    '합니다',
    '이에요',
    '예요',
    '습니다',
    '했다',
    '한다',
    '고자',
    '려고',
    '기',
    '이야',
    '이다',
    '은',
    '는',
    '이',
    '가',
    '을',
    '를',
    '에서',
    '에게',
    '한테',
    '에',
    '의',
    '도',
    '만',
    '야',
  ];

  for (const suffix of suffixes) {
    if (value.length > suffix.length && value.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }

  return value;
}

const KOREAN_SEARCH_TOKEN_ALIASES: Record<string, string> = {
  가격만큼: '가격만큼',
  가치가: '가치',
  가치있었다: '가치',
  가치있었습니다: '가치',
  공연은: '공연',
  비쌈에도: '비쌌',
  비쌌지만: '비쌌',
  비쌌지: '비쌌',
  티켓: '표',
  티켓은: '표',
  티켓이: '표',
  후보자: '지원자',
  후보자는: '지원자',
  지원자는: '지원자',
  설명했다: '설명',
  설명했습니다: '설명',
  실패했는지: '실패',
  실패했는지에: '실패',
  실패했습니다: '실패',
  우린: '우리',
  우리는: '우리',
  우리가: '우리',
  우리도: '우리',
  우릴: '우리',
  우리를: '우리',
  난: '나',
  나는: '나',
  내가: '나',
  날: '나',
  나를: '나',
  넌: '너',
  너는: '너',
  네가: '너',
  널: '너',
  너를: '너',
  전: '저',
  저는: '저',
  제가: '저',
  절: '저',
  저를: '저',
  배달: '배송',
  배달일정: '배송일정',
  바쁜시간: '바쁜시간대',
  바쁜시간에: '바쁜시간대',
  바쁜시간동안: '바쁜시간대',
  시간에: '시간대',
  시간동안: '시간대',
  변경: '바꾸',
  변경했: '바꾸',
  바꾸었: '바꾸',
  줄이고자: '줄이',
  줄이려고: '줄이',
  줄이기: '줄이',
};

function isCompleteLocalKoreanTranslation({
  keywordRatio,
  lengthRatio,
}: {
  keywordRatio: number;
  lengthRatio: number;
}): boolean {
  return keywordRatio === 1 && lengthRatio >= MIN_FULL_KOREAN_TRANSLATION_LENGTH_RATIO;
}

function getKoreanTranslationKeywords(question: WritingLearningQuestion): string[] {
  return dedupeKoreanTranslationKeywords([
    ...(question.expectedKeywordsKo ?? []),
    ...getKoreanContentTokens(question.sampleAnswer).filter(isUsefulKoreanTranslationConcept),
  ]);
}

function getKoreanTranslationKeywordHitCount(
  answer: string,
  question: WritingLearningQuestion,
): number {
  return getKoreanTranslationKeywords(question).filter((keyword) =>
    hasKoreanKeywordConcept(answer, keyword),
  ).length;
}

function hasEnoughKoreanTranslationKeywordCoverage(
  answer: string,
  question: WritingLearningQuestion,
): boolean {
  if (!hasHangul(answer)) {
    return false;
  }

  const keywords = getKoreanTranslationKeywords(question);

  if (keywords.length === 0) {
    return false;
  }

  const keywordHitCount = getKoreanTranslationKeywordHitCount(answer, question);
  const minHitCount = Math.min(MIN_KOREAN_TRANSLATION_KEYWORD_HITS, keywords.length);
  const keywordRatio = keywordHitCount / keywords.length;

  return keywordHitCount >= minHitCount &&
    keywordRatio >= MIN_KOREAN_TRANSLATION_KEYWORD_RATIO;
}

function dedupeKoreanTranslationKeywords(keywords: string[]): string[] {
  const seenNormalizedKeywords = new Set<string>();

  return keywords.reduce<string[]>((dedupedKeywords, keyword) => {
    const normalizedKeyword = normalizeKoreanForSearch(keyword);

    if (!normalizedKeyword || seenNormalizedKeywords.has(normalizedKeyword)) {
      return dedupedKeywords;
    }

    seenNormalizedKeywords.add(normalizedKeyword);
    dedupedKeywords.push(keyword);
    return dedupedKeywords;
  }, []);
}

function isUsefulKoreanTranslationConcept(token: string): boolean {
  const normalizedToken = normalizeKoreanForSearch(token);

  return normalizedToken.length > 1 && !LOW_SIGNAL_KOREAN_TRANSLATION_TOKENS.has(normalizedToken);
}

const LOW_SIGNAL_KOREAN_TRANSLATION_TOKENS = new Set([
  '그',
  '그것',
  '나',
  '내',
  '저',
  '제',
  '이',
  '위해',
  '동안',
]);

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
