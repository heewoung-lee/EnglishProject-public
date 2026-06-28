import {
  PRACTICE_QUESTION_COUNT,
  PROMOTION_EXAM_QUESTION_COUNT,
  QUESTION_AREA_LABELS,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  LearnerLevel,
  LearningQuestion,
  ProficiencyStat,
  QuestionArea,
  QuestionProficiencyStats,
  RecentResult,
  SkillProficiencyStats,
} from '../types/learning';
import type { SkillTag } from '../types/conversation';
import { getNextLevel } from './rateService';
import { getQuestionSkillTags } from './questionSkillTagService';

const WEAKNESS_PRACTICE_RATIO = 0.7;
const WEAKNESS_SCORE_THRESHOLD = 75;
const WEAKNESS_ACCURACY_THRESHOLD = 0.7;
const MAX_PRACTICE_CONVERSATION_QUESTIONS = 1;

type PracticeBalanceRequirement = {
  isSatisfied: (questions: LearningQuestion[]) => boolean;
  matches: (question: LearningQuestion) => boolean;
};

const PRACTICE_BALANCE_REQUIREMENTS: PracticeBalanceRequirement[] = [
  {
    isSatisfied: (questions) => questions.some((question) => question.kind === 'choice'),
    matches: (question) => question.kind === 'choice',
  },
  {
    isSatisfied: (questions) => questions.some((question) => question.area === 'reading'),
    matches: (question) => question.area === 'reading',
  },
];

type QuestionSelectionContext = {
  questionStats?: QuestionProficiencyStats;
  skillStats?: SkillProficiencyStats;
};

function takeQuestions(questions: LearningQuestion[], count: number): LearningQuestion[] {
  return questions.slice(0, count);
}

function createUniqueQuestionCollector() {
  const selectedQuestions: LearningQuestion[] = [];
  const selectedQuestionIds = new Set<string>();
  const selectedQuestionKeys = new Set<string>();

  return {
    add(question: LearningQuestion, count: number): boolean {
      if (selectedQuestions.length >= count) {
        return false;
      }

      const questionKey = getVisibleQuestionKey(question);

      if (selectedQuestionIds.has(question.id) || selectedQuestionKeys.has(questionKey)) {
        return false;
      }

      selectedQuestions.push(question);
      selectedQuestionIds.add(question.id);
      selectedQuestionKeys.add(questionKey);
      return true;
    },
    questions: selectedQuestions,
  };
}

function takePracticeQuestionsFromBuckets(
  buckets: LearningQuestion[][],
  count: number,
): LearningQuestion[] {
  const collector = createUniqueQuestionCollector();
  const queuedQuestions = buildUniqueQuestionQueue(buckets);

  for (const requirement of PRACTICE_BALANCE_REQUIREMENTS) {
    if (collector.questions.length >= count || requirement.isSatisfied(collector.questions)) {
      continue;
    }

    for (const question of queuedQuestions) {
      if (requirement.matches(question) && collector.add(question, count)) {
        break;
      }
    }
  }

  for (const question of queuedQuestions) {
    if (shouldDeferConversationQuestion(question, collector.questions)) {
      continue;
    }

    collector.add(question, count);
  }

  for (const question of queuedQuestions) {
    collector.add(question, count);
  }

  return collector.questions;
}

function shouldDeferConversationQuestion(
  question: LearningQuestion,
  selectedQuestions: LearningQuestion[],
): boolean {
  return question.area === 'conversation' &&
    selectedQuestions.filter((selectedQuestion) => selectedQuestion.area === 'conversation').length >=
      MAX_PRACTICE_CONVERSATION_QUESTIONS;
}

function takePracticeQuestions(questions: LearningQuestion[], count: number): LearningQuestion[] {
  return takePracticeQuestionsFromBuckets([questions], count);
}

function takeFreshQuestionsWithIncorrectReview(
  freshQuestions: LearningQuestion[],
  incorrectQuestions: LearningQuestion[],
  count: number,
  weakAreas: QuestionArea[] = [],
  weakSkillTags: SkillTag[] = [],
): LearningQuestion[] {
  if (incorrectQuestions.length === 0 || count <= 1) {
    return takeWeaknessBalancedPracticeQuestions(freshQuestions, count, weakAreas, weakSkillTags);
  }

  const freshReviewCount = count - 1;
  const selectedFreshQuestions = takeWeaknessBalancedPracticeQuestions(
    freshQuestions,
    freshReviewCount,
    weakAreas,
    weakSkillTags,
  );
  const selectedFreshQuestionIds = new Set(selectedFreshQuestions.map((question) => question.id));
  const selectedFreshQuestionKeys = new Set(
    selectedFreshQuestions.map((question) => getVisibleQuestionKey(question)),
  );
  const selectedIncorrectQuestion = incorrectQuestions.find(
    (question) =>
      !selectedFreshQuestionIds.has(question.id) &&
      !selectedFreshQuestionKeys.has(getVisibleQuestionKey(question)),
  );

  return takePracticeQuestionsFromBuckets(
    [
      selectedFreshQuestions,
      selectedIncorrectQuestion ? [selectedIncorrectQuestion] : [],
      freshQuestions.filter(
        (question) =>
          !selectedFreshQuestionIds.has(question.id) &&
          !selectedFreshQuestionKeys.has(getVisibleQuestionKey(question)),
      ),
      incorrectQuestions,
    ],
    count,
  );
}

function rotateQuestions(questions: LearningQuestion[], offset: number): LearningQuestion[] {
  if (questions.length === 0) {
    return [];
  }

  const normalizedOffset = Math.abs(offset) % questions.length;

  return [...questions.slice(normalizedOffset), ...questions.slice(0, normalizedOffset)];
}

function normalizeQuestionKeyPart(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getVisibleQuestionKey(question: LearningQuestion): string {
  return [
    question.level,
    question.area,
    question.kind,
    question.promptKo,
    question.questionText,
  ].map(normalizeQuestionKeyPart).join('::');
}

function buildUniqueQuestionQueue(buckets: LearningQuestion[][]): LearningQuestion[] {
  const queuedQuestions: LearningQuestion[] = [];
  const queuedQuestionIds = new Set<string>();
  const queuedQuestionKeys = new Set<string>();

  buckets.flat().forEach((question) => {
    const questionKey = getVisibleQuestionKey(question);

    if (queuedQuestionIds.has(question.id) || queuedQuestionKeys.has(questionKey)) {
      return;
    }

    queuedQuestions.push(question);
    queuedQuestionIds.add(question.id);
    queuedQuestionKeys.add(questionKey);
  });

  return queuedQuestions;
}

function buildPracticeQuestionQueue(
  questions: LearningQuestion[],
  offset: number,
): LearningQuestion[] {
  const queuedQuestions = rotateQuestions(questions, offset);
  const queuedQuestionKeys = new Set<string>();

  return queuedQuestions.filter((question) => {
    const questionKey = getVisibleQuestionKey(question);

    if (queuedQuestionKeys.has(questionKey)) {
      return false;
    }

    queuedQuestionKeys.add(questionKey);
    return true;
  });
}

function buildQuestionKeyById(sourceQuestions: LearningQuestion[]): Map<string, string> {
  return new Map(
    sourceQuestions.map((question) => [question.id, getVisibleQuestionKey(question)]),
  );
}

function getQuestionKeyForId(questionId: string, questionKeyById: Map<string, string>): string {
  return questionKeyById.get(questionId) ?? `id:${questionId}`;
}

function getRecentQuestionKeys(
  recentResults: RecentResult[],
  questionKeyById: Map<string, string>,
): Set<string> {
  return new Set(
    recentResults
      .flatMap((result) => result.questionIds ?? [])
      .map((questionId) => getQuestionKeyForId(questionId, questionKeyById)),
  );
}

function getRecentAnswerOutcomesByKey(
  recentResults: RecentResult[],
  questionKeyById: Map<string, string>,
): Map<string, boolean> {
  const outcomes = new Map<string, boolean>();

  recentResults.forEach((result) => {
    if (!result.correctQuestionIds) {
      if (result.score === 100) {
        (result.questionIds ?? []).forEach((questionId) => {
          outcomes.set(getQuestionKeyForId(questionId, questionKeyById), true);
        });
      }

      return;
    }

    const correctQuestionIds = new Set(result.correctQuestionIds);

    result.questionIds.forEach((questionId) => {
      outcomes.set(
        getQuestionKeyForId(questionId, questionKeyById),
        correctQuestionIds.has(questionId),
      );
    });
  });

  return outcomes;
}

function mergeQuestionIdSets(...sets: Set<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

function getWeakAreaPriority(recentResults: RecentResult[]): QuestionArea[] {
  const areaCounts = recentResults.slice(-5).reduce<Record<QuestionArea, number>>(
    (counts, result) => {
      (result.weakAreas ?? []).forEach((area) => {
        counts[area] += 1;
      });
      return counts;
    },
    { reading: 0, conversation: 0, grammar: 0 },
  );

  return (Object.keys(QUESTION_AREA_LABELS) as QuestionArea[])
    .filter((area) => areaCounts[area] > 0)
    .sort((left, right) => areaCounts[right] - areaCounts[left]);
}

function getWeakSkillTagPriority(recentResults: RecentResult[]): SkillTag[] {
  const tagCounts = recentResults.slice(-5).reduce<Map<SkillTag, number>>((counts, result) => {
    (result.weakSkillTags ?? []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
    return counts;
  }, new Map());

  return [...tagCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([tag]) => tag);
}

function isWeakProficiencyStat(stat: ProficiencyStat | undefined): stat is ProficiencyStat {
  if (!stat || stat.attempts <= 0) {
    return false;
  }

  const accuracy = stat.correctCount / stat.attempts;

  return stat.lastScore < WEAKNESS_SCORE_THRESHOLD || accuracy < WEAKNESS_ACCURACY_THRESHOLD;
}

function getWeaknessScore(stat: ProficiencyStat): number {
  const accuracy = stat.attempts > 0 ? stat.correctCount / stat.attempts : 0;
  const scoreGap = Math.max(0, WEAKNESS_SCORE_THRESHOLD - stat.lastScore);
  const accuracyGap = Math.max(0, WEAKNESS_ACCURACY_THRESHOLD - accuracy) * 100;

  return scoreGap + accuracyGap + Math.min(stat.attempts, 5);
}

function getWeakSkillTagPriorityFromStats(skillStats?: SkillProficiencyStats): SkillTag[] {
  if (!skillStats) {
    return [];
  }

  return Object.entries(skillStats)
    .filter((entry): entry is [SkillTag, ProficiencyStat] => isWeakProficiencyStat(entry[1]))
    .sort((left, right) => getWeaknessScore(right[1]) - getWeaknessScore(left[1]))
    .map(([tag]) => tag);
}

function getWeakAreaPriorityFromQuestionStats(
  levelQuestions: LearningQuestion[],
  questionStats?: QuestionProficiencyStats,
): QuestionArea[] {
  if (!questionStats) {
    return [];
  }

  const areaScores = levelQuestions.reduce<Map<QuestionArea, number>>((scores, question) => {
    const stat = questionStats[question.id];

    if (!isWeakProficiencyStat(stat)) {
      return scores;
    }

    scores.set(question.area, (scores.get(question.area) ?? 0) + getWeaknessScore(stat));
    return scores;
  }, new Map());

  return [...areaScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([area]) => area);
}

function mergePriorityLists<T>(...lists: T[][]): T[] {
  const merged: T[] = [];

  lists.forEach((list) => {
    list.forEach((item) => {
      if (!merged.includes(item)) {
        merged.push(item);
      }
    });
  });

  return merged;
}

function sortByWeakSignals(
  questions: LearningQuestion[],
  weakAreas: QuestionArea[],
  weakSkillTags: SkillTag[],
): LearningQuestion[] {
  if (weakAreas.length === 0 && weakSkillTags.length === 0) {
    return questions;
  }

  return [...questions].sort((left, right) => {
    const leftSkillPriority = getQuestionSkillPriority(left, weakSkillTags);
    const rightSkillPriority = getQuestionSkillPriority(right, weakSkillTags);

    if (leftSkillPriority !== rightSkillPriority) {
      return leftSkillPriority - rightSkillPriority;
    }

    const leftAreaPriority = weakAreas.indexOf(left.area);
    const rightAreaPriority = weakAreas.indexOf(right.area);
    const normalizedLeftArea = leftAreaPriority === -1 ? Number.MAX_SAFE_INTEGER : leftAreaPriority;
    const normalizedRightArea = rightAreaPriority === -1 ? Number.MAX_SAFE_INTEGER : rightAreaPriority;

    return normalizedLeftArea - normalizedRightArea;
  });
}

function getQuestionSkillPriority(
  question: LearningQuestion,
  weakSkillTags: SkillTag[],
): number {
  if (weakSkillTags.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const questionTags = getQuestionSkillTags(question);
  const priorities = questionTags
    .map((tag) => weakSkillTags.indexOf(tag))
    .filter((index) => index >= 0);

  return priorities.length > 0 ? Math.min(...priorities) : Number.MAX_SAFE_INTEGER;
}

function hasWeakSignal(
  question: LearningQuestion,
  weakAreas: QuestionArea[],
  weakSkillTags: SkillTag[],
): boolean {
  return weakAreas.includes(question.area) ||
    getQuestionSkillPriority(question, weakSkillTags) !== Number.MAX_SAFE_INTEGER;
}

function getWeaknessTargetCount(count: number): number {
  if (count <= 1) {
    return count;
  }

  return Math.min(count - 1, Math.max(1, Math.floor(count * WEAKNESS_PRACTICE_RATIO)));
}

function removeSelectedQuestions(
  questions: LearningQuestion[],
  selectedQuestions: LearningQuestion[],
): LearningQuestion[] {
  const selectedQuestionIds = new Set(selectedQuestions.map((question) => question.id));
  const selectedQuestionKeys = new Set(
    selectedQuestions.map((question) => getVisibleQuestionKey(question)),
  );

  return questions.filter(
    (question) =>
      !selectedQuestionIds.has(question.id) &&
      !selectedQuestionKeys.has(getVisibleQuestionKey(question)),
  );
}

function takeWeaknessBalancedPracticeQuestions(
  questions: LearningQuestion[],
  count: number,
  weakAreas: QuestionArea[],
  weakSkillTags: SkillTag[],
): LearningQuestion[] {
  if (weakAreas.length === 0 && weakSkillTags.length === 0) {
    return takePracticeQuestions(questions, count);
  }

  const weaknessTargetCount = getWeaknessTargetCount(count);
  const weakQuestions = sortByWeakSignals(
    questions.filter((question) => hasWeakSignal(question, weakAreas, weakSkillTags)),
    weakAreas,
    weakSkillTags,
  );
  const balanceQuestions = questions.filter(
    (question) => !hasWeakSignal(question, weakAreas, weakSkillTags),
  );
  const selectedWeakQuestions = takePracticeQuestions(weakQuestions, weaknessTargetCount);
  const selectedBalanceQuestions = takePracticeQuestions(
    balanceQuestions,
    Math.max(0, count - selectedWeakQuestions.length),
  );

  return takePracticeQuestionsFromBuckets(
    [
      selectedWeakQuestions,
      selectedBalanceQuestions,
      removeSelectedQuestions(weakQuestions, selectedWeakQuestions),
      removeSelectedQuestions(balanceQuestions, selectedBalanceQuestions),
    ],
    count,
  );
}

export function selectPracticeQuestions(
  level: LearnerLevel,
  recentResults: RecentResult[],
  solvedQuestionCount = 0,
  sourceQuestions: LearningQuestion[] = questionBank,
  context: QuestionSelectionContext = {},
): LearningQuestion[] {
  const questionKeyById = buildQuestionKeyById(sourceQuestions);
  const recentQuestionKeys = getRecentQuestionKeys(recentResults, questionKeyById);
  const recentAnswerOutcomesByKey = getRecentAnswerOutcomesByKey(recentResults, questionKeyById);
  const sourceLevelQuestions = sourceQuestions.filter((question) => question.level === level);
  const weakAreas = mergePriorityLists(
    getWeakAreaPriority(recentResults),
    getWeakAreaPriorityFromQuestionStats(sourceLevelQuestions, context.questionStats),
  );
  const weakSkillTags = mergePriorityLists(
    getWeakSkillTagPriority(recentResults),
    getWeakSkillTagPriorityFromStats(context.skillStats),
  );
  const levelQuestions = buildPracticeQuestionQueue(
    sourceLevelQuestions,
    solvedQuestionCount,
  );
  const freshCooldownQuestionKeys = mergeQuestionIdSets(
    recentQuestionKeys,
    new Set(recentAnswerOutcomesByKey.keys()),
  );
  const freshQuestions = levelQuestions.filter(
    (question) => !freshCooldownQuestionKeys.has(getVisibleQuestionKey(question)),
  );
  const sortedFreshQuestions = sortByWeakSignals(freshQuestions, weakAreas, weakSkillTags);

  const freshQuestionKeys = new Set(
    sortedFreshQuestions.map((question) => getVisibleQuestionKey(question)),
  );
  const latestQuestionKeys = new Set(
    (recentResults.at(-1)?.questionIds ?? []).map((questionId) =>
      getQuestionKeyForId(questionId, questionKeyById),
    ),
  );
  const recentlyIncorrectQuestions = levelQuestions.filter(
    (question) =>
      !freshQuestionKeys.has(getVisibleQuestionKey(question)) &&
      recentAnswerOutcomesByKey.get(getVisibleQuestionKey(question)) === false,
  );
  const sortedRecentlyIncorrectQuestions = sortByWeakSignals(
    recentlyIncorrectQuestions,
    weakAreas,
    weakSkillTags,
  );

  if (
    sortedFreshQuestions.length >= PRACTICE_QUESTION_COUNT &&
    recentlyIncorrectQuestions.length === 0
  ) {
    return takeWeaknessBalancedPracticeQuestions(
      sortedFreshQuestions,
      PRACTICE_QUESTION_COUNT,
      weakAreas,
      weakSkillTags,
    );
  }

  if (sortedFreshQuestions.length >= PRACTICE_QUESTION_COUNT) {
    return takeFreshQuestionsWithIncorrectReview(
      sortedFreshQuestions,
      sortedRecentlyIncorrectQuestions,
      PRACTICE_QUESTION_COUNT,
      weakAreas,
      weakSkillTags,
    );
  }

  const olderNeutralQuestions = levelQuestions.filter(
    (question) =>
      !freshQuestionKeys.has(getVisibleQuestionKey(question)) &&
      !recentAnswerOutcomesByKey.has(getVisibleQuestionKey(question)) &&
      !latestQuestionKeys.has(getVisibleQuestionKey(question)),
  );
  const latestNeutralQuestions = levelQuestions.filter(
    (question) =>
      !freshQuestionKeys.has(getVisibleQuestionKey(question)) &&
      !recentAnswerOutcomesByKey.has(getVisibleQuestionKey(question)) &&
      latestQuestionKeys.has(getVisibleQuestionKey(question)),
  );
  const olderCorrectQuestions = levelQuestions.filter(
    (question) =>
      !freshQuestionKeys.has(getVisibleQuestionKey(question)) &&
      recentAnswerOutcomesByKey.get(getVisibleQuestionKey(question)) === true &&
      !latestQuestionKeys.has(getVisibleQuestionKey(question)),
  );
  const latestCorrectQuestions = levelQuestions.filter(
    (question) =>
      !freshQuestionKeys.has(getVisibleQuestionKey(question)) &&
      recentAnswerOutcomesByKey.get(getVisibleQuestionKey(question)) === true &&
      latestQuestionKeys.has(getVisibleQuestionKey(question)),
  );
  return takePracticeQuestionsFromBuckets(
    [
      sortedFreshQuestions,
      sortedRecentlyIncorrectQuestions,
      sortByWeakSignals(olderNeutralQuestions, weakAreas, weakSkillTags),
      sortByWeakSignals(latestNeutralQuestions, weakAreas, weakSkillTags),
      sortByWeakSignals(olderCorrectQuestions, weakAreas, weakSkillTags),
      sortByWeakSignals(latestCorrectQuestions, weakAreas, weakSkillTags),
    ],
    PRACTICE_QUESTION_COUNT,
  );
}

export function selectPromotionExamQuestions(
  currentLevel: LearnerLevel,
  sourceQuestions: LearningQuestion[] = questionBank,
): LearningQuestion[] {
  const nextLevel = getNextLevel(currentLevel);

  if (!nextLevel) {
    return [];
  }

  const nextLevelQuestions = sourceQuestions.filter((question) => question.level === nextLevel);
  const currentLevelQuestions = sourceQuestions.filter(
    (question) => question.level === currentLevel,
  );

  return takePromotionExamBlueprintQuestions(
    nextLevelQuestions,
    currentLevelQuestions,
    PROMOTION_EXAM_QUESTION_COUNT,
  );
}

function takePromotionExamBlueprintQuestions(
  nextLevelQuestions: LearningQuestion[],
  currentLevelQuestions: LearningQuestion[],
  count: number,
): LearningQuestion[] {
  const nextLevelQueue = buildPracticeQuestionQueue(nextLevelQuestions, 0);
  const fallbackQueue = buildPracticeQuestionQueue(
    [...nextLevelQuestions, ...currentLevelQuestions],
    0,
  );
  const collector = createUniqueQuestionCollector();
  const addFirstMatching = (predicate: (question: LearningQuestion) => boolean) => {
    const question = nextLevelQueue.find(predicate);

    if (question) {
      collector.add(question, count);
    }
  };

  addFirstMatching((question) => question.kind === 'writing');
  addFirstMatching((question) => question.area === 'reading');
  addFirstMatching((question) => question.area === 'conversation');
  addFirstMatching((question) => question.area === 'grammar');

  [...nextLevelQueue, ...fallbackQueue].forEach((question) => {
    collector.add(question, count);
  });

  return takeQuestions(collector.questions, count);
}
