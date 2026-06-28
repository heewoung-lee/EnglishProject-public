import {
  LEVEL_ORDER,
  PRACTICE_QUESTION_COUNT,
  PROMOTION_EXAM_QUESTION_COUNT,
  QUESTION_PACK_SCHEMA_VERSION,
} from '../constants/learningConfig';
import type {
  CachedQuestionPackState,
  AnswerLanguage,
  LearnerLevel,
  LearningQuestion,
  LevelQuestionPack,
  QuestionArea,
  QuestionChoice,
  QuestionKind,
  QuestionPackManifest,
  QuestionPackManifestEntry,
  ReadingDifficulty,
} from '../types/learning';

type UnknownRecord = Record<string, unknown>;

const VALID_AREAS: QuestionArea[] = ['reading', 'conversation', 'grammar'];
const VALID_KINDS: QuestionKind[] = ['choice', 'writing'];
const VALID_ANSWER_LANGUAGES: AnswerLanguage[] = ['en', 'ko'];
const VALID_READING_DIFFICULTIES: ReadingDifficulty[] = ['easy', 'medium', 'hard'];
const MIN_WRITING_QUESTION_COUNT = 4;
const MIN_PROMOTION_ELIGIBLE_COUNT = PROMOTION_EXAM_QUESTION_COUNT;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidDateString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isValidLevel(value: unknown): value is LearnerLevel {
  return LEVEL_ORDER.includes(value as LearnerLevel);
}

function isValidArea(value: unknown): value is QuestionArea {
  return VALID_AREAS.includes(value as QuestionArea);
}

function isValidKind(value: unknown): value is QuestionKind {
  return VALID_KINDS.includes(value as QuestionKind);
}

function isValidAnswerLanguage(value: unknown): value is AnswerLanguage {
  return value === undefined || VALID_ANSWER_LANGUAGES.includes(value as AnswerLanguage);
}

function isValidReadingDifficulty(value: unknown): value is ReadingDifficulty {
  return VALID_READING_DIFFICULTIES.includes(value as ReadingDifficulty);
}

function isValidChoice(value: unknown): value is QuestionChoice {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.text);
}

function isValidOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

function isValidOptionalStringList(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => isNonEmptyString(item)))
  );
}

function isValidTranslationTimeLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 30 && value <= 90;
}

function containsHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}

function getMinimumQuestionCount(level: LearnerLevel): number {
  return PRACTICE_QUESTION_COUNT * 6;
}

function isSafeRelativePackPath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    value.startsWith('packs/') &&
    value.endsWith('.json') &&
    !value.includes('..') &&
    !value.includes('://')
  );
}

export function isValidLearningQuestion(
  value: unknown,
  expectedLevel?: LearnerLevel,
): value is LearningQuestion {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !isNonEmptyString(value.id) ||
    !isValidLevel(value.level) ||
    (expectedLevel !== undefined && value.level !== expectedLevel) ||
    !isValidArea(value.area) ||
    !isValidKind(value.kind) ||
    !isNonEmptyString(value.promptKo) ||
    !isNonEmptyString(value.explanationKo) ||
    !isValidOptionalString(value.questionText) ||
    !isValidOptionalString(value.weakPointLabel)
  ) {
    return false;
  }

  if (value.kind === 'choice') {
    if (
      !Array.isArray(value.choices) ||
      value.choices.length !== 3 ||
      !value.choices.every((choice) => isValidChoice(choice)) ||
      !isNonEmptyString(value.correctChoiceId)
    ) {
      return false;
    }

    const correctChoice = value.choices.find((choice) => choice.id === value.correctChoiceId);
    const choiceIds = new Set(value.choices.map((choice) => choice.id));

    if (!correctChoice || choiceIds.size !== value.choices.length) {
      return false;
    }

    if (
      typeof value.questionText === 'string' &&
      correctChoice.text.trim() === value.questionText.trim()
    ) {
      return false;
    }

    return true;
  }

  if (
    value.choices !== undefined ||
    value.correctChoiceId !== undefined ||
    !isNonEmptyString(value.sampleAnswer) ||
    !isNonEmptyString(value.evaluationFocusKo) ||
    !isValidOptionalStringList(value.expectedKeywords) ||
    !isValidOptionalStringList(value.expectedKeywordsKo) ||
    !isValidAnswerLanguage(value.answerLanguage)
  ) {
    return false;
  }

  if (value.answerLanguage === 'ko') {
    return (
      value.area === 'reading' &&
      isNonEmptyString(value.questionText) &&
      isValidTranslationTimeLimit(value.timeLimitSeconds) &&
      isValidReadingDifficulty(value.readingDifficulty) &&
      Array.isArray(value.expectedKeywordsKo) &&
      value.expectedKeywordsKo.length >= 3 &&
      containsHangul(value.sampleAnswer) &&
      value.expectedKeywordsKo.every(containsHangul)
    );
  }

  if (value.timeLimitSeconds !== undefined || value.readingDifficulty !== undefined) {
    return false;
  }

  return true;
}

export function isValidQuestionPackManifestEntry(
  value: unknown,
): value is QuestionPackManifestEntry {
  return (
    isRecord(value) &&
    isValidLevel(value.level) &&
    isPositiveInteger(value.version) &&
    isSafeRelativePackPath(value.path) &&
    isPositiveInteger(value.questionCount)
  );
}

export function isValidQuestionPackManifest(value: unknown): value is QuestionPackManifest {
  return (
    isRecord(value) &&
    value.schemaVersion === QUESTION_PACK_SCHEMA_VERSION &&
    isValidDateString(value.publishedAt) &&
    Array.isArray(value.packs) &&
    value.packs.length > 0 &&
    value.packs.every((entry) => isValidQuestionPackManifestEntry(entry))
  );
}

export function isValidLevelQuestionPack(value: unknown): value is LevelQuestionPack {
  if (
    !isRecord(value) ||
    value.schemaVersion !== QUESTION_PACK_SCHEMA_VERSION ||
    !isValidLevel(value.level) ||
    !isPositiveInteger(value.version) ||
    !isValidDateString(value.publishedAt) ||
    !Array.isArray(value.questions) ||
    value.questions.length < getMinimumQuestionCount(value.level)
  ) {
    return false;
  }

  const questionIds = new Set<string>();
  let writingQuestionCount = 0;
  const areaCounts: Record<QuestionArea, number> = {
    reading: 0,
    conversation: 0,
    grammar: 0,
  };

  for (const question of value.questions) {
    if (!isValidLearningQuestion(question, value.level)) {
      return false;
    }

    if (questionIds.has(question.id)) {
      return false;
    }

    questionIds.add(question.id);

    if (question.kind === 'writing') {
      writingQuestionCount += 1;
    }

    areaCounts[question.area] += 1;
  }

  return (
    value.questions.length >= MIN_PROMOTION_ELIGIBLE_COUNT &&
    writingQuestionCount >= MIN_WRITING_QUESTION_COUNT &&
    areaCounts.reading >= 1 &&
    areaCounts.conversation >= 1 &&
    areaCounts.grammar >= 1
  );
}

export function flattenCachedPacks(cache: CachedQuestionPackState): LearningQuestion[] {
  return LEVEL_ORDER.flatMap((level) => cache.packs[level]?.questions ?? []);
}
