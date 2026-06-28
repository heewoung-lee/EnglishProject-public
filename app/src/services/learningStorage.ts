import AsyncStorage from '@react-native-async-storage/async-storage';

import { INITIAL_RATE, LEARNING_STORAGE_KEY } from '../constants/learningConfig';
import type { SkillTag } from '../types/conversation';
import type {
  LearnerLevel,
  LocalLearningState,
  ProficiencyStat,
  QuestionArea,
  QuestionProficiencyStats,
  RecentConversationResult,
  RecentResult,
  SkillProficiencyStats,
} from '../types/learning';

const VALID_LEVELS: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2'];
const VALID_QUESTION_AREAS: QuestionArea[] = ['reading', 'conversation', 'grammar'];
const VALID_SKILL_TAGS: SkillTag[] = [
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
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

export function createDefaultLearningState(): LocalLearningState {
  return {
    currentLevel: 'A1',
    currentRate: INITIAL_RATE,
    solvedQuestionCount: 0,
    promotionReady: false,
    recentResults: [],
    recentConversationResults: [],
    questionStats: {},
    skillStats: {},
    updatedAt: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function normalizeRate(value: unknown, fallback = INITIAL_RATE): number {
  const parsedValue = parseFiniteNumber(value);
  const nextValue = parsedValue ?? fallback;

  return Math.max(0, Math.min(100, Math.round(nextValue)));
}

function normalizeCount(value: unknown): number {
  const parsedValue = parseFiniteNumber(value);

  if (parsedValue === null) {
    return 0;
  }

  return Math.max(0, Math.floor(parsedValue));
}

function normalizeLevel(value: unknown): LearnerLevel {
  return VALID_LEVELS.includes(value as LearnerLevel) ? (value as LearnerLevel) : 'A1';
}

function normalizeQuestionArea(value: unknown): QuestionArea | null {
  return VALID_QUESTION_AREAS.includes(value as QuestionArea) ? (value as QuestionArea) : null;
}

function normalizeSkillTag(value: unknown): SkillTag | null {
  return VALID_SKILL_TAGS.includes(value as SkillTag) ? (value as SkillTag) : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeWeakAreas(value: unknown): QuestionArea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<QuestionArea[]>((areas, item) => {
    const area = normalizeQuestionArea(item);
    return area ? [...areas, area] : areas;
  }, []);
}

function normalizeSkillTags(value: unknown): SkillTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<SkillTag[]>((tags, item) => {
    const tag = normalizeSkillTag(item);
    return tag && !tags.includes(tag) ? [...tags, tag] : tags;
  }, []);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidIsoDateTimeString(value: string): boolean {
  const match = ISO_DATE_TIME_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, timezoneText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysByMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  if (timezoneText !== 'Z') {
    const offsetHour = Number(timezoneText.slice(1, 3));
    const offsetMinute = Number(timezoneText.slice(4, 6));

    if (offsetHour > 23 || offsetMinute > 59) {
      return false;
    }
  }

  return !Number.isNaN(Date.parse(value));
}

function normalizeDateString(value: unknown, fallback: string): string {
  return typeof value === 'string' && isValidIsoDateTimeString(value) ? value : fallback;
}

function normalizeProficiencyStat(value: unknown): ProficiencyStat | null {
  if (!isRecord(value)) {
    return null;
  }

  const lastPracticedAt =
    typeof value.lastPracticedAt === 'string' && isValidIsoDateTimeString(value.lastPracticedAt)
      ? value.lastPracticedAt
      : null;

  if (!lastPracticedAt) {
    return null;
  }

  const attempts = normalizeCount(value.attempts);

  if (attempts <= 0) {
    return null;
  }

  return {
    attempts,
    correctCount: Math.min(attempts, normalizeCount(value.correctCount)),
    lastScore: normalizeRate(value.lastScore, 0),
    lastPracticedAt,
  };
}

function normalizeQuestionStats(value: unknown): QuestionProficiencyStats {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<QuestionProficiencyStats>((stats, [questionId, item]) => {
    if (!questionId.trim()) {
      return stats;
    }

    const stat = normalizeProficiencyStat(item);

    if (!stat) {
      return stats;
    }

    return {
      ...stats,
      [questionId]: stat,
    };
  }, {});
}

function normalizeSkillStats(value: unknown): SkillProficiencyStats {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<SkillProficiencyStats>((stats, [skillTag, item]) => {
    const normalizedSkillTag = normalizeSkillTag(skillTag);
    const stat = normalizeProficiencyStat(item);

    if (!normalizedSkillTag || !stat) {
      return stats;
    }

    return {
      ...stats,
      [normalizedSkillTag]: stat,
    };
  }, {});
}

function normalizeRecentResult(value: unknown, fallbackTimestamp: string): RecentResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionSetId = typeof value.questionSetId === 'string' ? value.questionSetId : '';
  const level = normalizeLevel(value.level);
  const score = normalizeRate(value.score);
  const rateAfter = normalizeRate(value.rateAfter);
  const questionIds = normalizeStringList(value.questionIds);
  const correctQuestionIds = Array.isArray(value.correctQuestionIds)
    ? normalizeStringList(value.correctQuestionIds)
    : undefined;
  const weakAreas = normalizeWeakAreas(value.weakAreas);
  const weakSkillTags = normalizeSkillTags(value.weakSkillTags);
  const solvedAt = normalizeDateString(value.solvedAt, fallbackTimestamp);

  if (correctQuestionIds) {
    return {
      questionSetId,
      level,
      score,
      rateAfter,
      questionIds,
      correctQuestionIds,
      weakAreas,
      weakSkillTags,
      solvedAt,
    };
  }

  return {
    questionSetId,
    level,
    score,
    rateAfter,
    questionIds,
    weakAreas,
    weakSkillTags,
    solvedAt,
  };
}

function normalizeRecentResults(value: unknown, fallbackTimestamp: string): RecentResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<RecentResult[]>((results, item) => {
    const result = normalizeRecentResult(item, fallbackTimestamp);
    return result ? [...results, result] : results;
  }, []);
}

function normalizeRecentConversationResult(
  value: unknown,
  fallbackTimestamp: string,
): RecentConversationResult | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    conversationSessionId:
      typeof value.conversationSessionId === 'string' ? value.conversationSessionId : '',
    scenarioId: typeof value.scenarioId === 'string' ? value.scenarioId : '',
    level: normalizeLevel(value.level),
    score: normalizeRate(value.score),
    rateAfter: normalizeRate(value.rateAfter),
    weaknessTags: normalizeSkillTags(value.weaknessTags),
    recommendedScenarioIds: normalizeStringList(value.recommendedScenarioIds),
    solvedAt: normalizeDateString(value.solvedAt, fallbackTimestamp),
  };
}

function normalizeRecentConversationResults(
  value: unknown,
  fallbackTimestamp: string,
): RecentConversationResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<RecentConversationResult[]>((results, item) => {
    const result = normalizeRecentConversationResult(item, fallbackTimestamp);
    return result ? [...results, result] : results;
  }, []);
}

function normalizeLearningState(value: unknown, fallbackTimestamp = new Date().toISOString()): LocalLearningState {
  if (!isRecord(value)) {
    return {
      ...createDefaultLearningState(),
      updatedAt: fallbackTimestamp,
    };
  }

  return {
    currentLevel: normalizeLevel(value.currentLevel),
    currentRate: normalizeRate(value.currentRate),
    solvedQuestionCount: normalizeCount(value.solvedQuestionCount),
    promotionReady: typeof value.promotionReady === 'boolean' ? value.promotionReady : false,
    recentResults: normalizeRecentResults(value.recentResults, fallbackTimestamp),
    recentConversationResults: normalizeRecentConversationResults(
      value.recentConversationResults,
      fallbackTimestamp,
    ),
    questionStats: normalizeQuestionStats(value.questionStats),
    skillStats: normalizeSkillStats(value.skillStats),
    updatedAt: normalizeDateString(value.updatedAt, fallbackTimestamp),
  };
}

async function persistLearningState(state: LocalLearningState): Promise<LocalLearningState> {
  await AsyncStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(state));
  return state;
}

async function persistLearningStateSafely(state: LocalLearningState): Promise<void> {
  try {
    await persistLearningState(state);
  } catch (error) {
    console.warn('Failed to persist normalized learning state.', error);
  }
}

export async function loadLearningState(): Promise<LocalLearningState> {
  let rawState: string | null;

  try {
    rawState = await AsyncStorage.getItem(LEARNING_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load learning state.', error);
    throw error;
  }

  if (!rawState) {
    const defaultState = createDefaultLearningState();
    await persistLearningStateSafely(defaultState);
    return defaultState;
  }

  try {
    const normalizedState = normalizeLearningState(JSON.parse(rawState));
    const normalizedRawState = JSON.stringify(normalizedState);

    if (rawState !== normalizedRawState) {
      await persistLearningStateSafely(normalizedState);
    }

    return normalizedState;
  } catch (error) {
    const defaultState = createDefaultLearningState();
    await persistLearningStateSafely(defaultState);
    return defaultState;
  }
}

export async function saveLearningState(state: LocalLearningState): Promise<LocalLearningState> {
  const nextState: LocalLearningState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  return persistLearningState(nextState);
}

export async function resetLearningState(): Promise<LocalLearningState> {
  const defaultState = createDefaultLearningState();
  return saveLearningState(defaultState);
}
