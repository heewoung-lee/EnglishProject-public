import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
  LEVEL_ORDER,
} from '../constants/learningConfig';
import type {
  ConversationScenarioPackManifest,
  ConversationScenarioPackManifestEntry,
  LearnerLevel,
  LevelConversationScenarioPack,
  RepairPolicy,
  Scenario,
  SkillTag,
} from '../types/conversation';

type UnknownRecord = Record<string, unknown>;

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

const VALID_DIFFICULTIES: Scenario['difficulty'][] = [
  'beginner',
  'intermediate',
  'advanced',
];

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

function isNonEmptyStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

function isValidSkillTagList(value: unknown): value is SkillTag[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => VALID_SKILL_TAGS.includes(item as SkillTag))
  );
}

function isValidRepairPolicy(value: unknown): value is RepairPolicy {
  return (
    isRecord(value) &&
    isNonEmptyString(value.unclear) &&
    isNonEmptyString(value.offTopic) &&
    isNonEmptyString(value.correction) &&
    isNonEmptyString(value.koreanOnly)
  );
}

function isValidConversationSlot(value: unknown) {
  return (
    isRecord(value) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.prompt) &&
    isNonEmptyStringList(value.matchKeywords) &&
    (value.required === undefined || typeof value.required === 'boolean')
  );
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

export function isValidConversationScenario(
  value: unknown,
  expectedLevel?: LearnerLevel,
): value is Scenario {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isValidLevel(value.level) &&
    (expectedLevel === undefined || value.level === expectedLevel) &&
    value.area === 'conversation' &&
    isNonEmptyString(value.titleKo) &&
    isNonEmptyString(value.titleEn) &&
    isNonEmptyString(value.situationKo) &&
    isNonEmptyString(value.descriptionKo) &&
    isNonEmptyString(value.aiRole) &&
    isNonEmptyString(value.userRole) &&
    isNonEmptyString(value.userGoalKo) &&
    VALID_DIFFICULTIES.includes(value.difficulty as Scenario['difficulty']) &&
    isPositiveInteger(value.maxUserTurns) &&
    isNonEmptyStringList(value.targetExpressions) &&
    isValidSkillTagList(value.targetSkills) &&
    isNonEmptyString(value.openingMessage) &&
    isNonEmptyString(value.completionMessage) &&
    isValidRepairPolicy(value.repairPolicy) &&
    isNonEmptyStringList(value.successCriteria) &&
    Array.isArray(value.requiredSlots) &&
    value.requiredSlots.length > 0 &&
    value.requiredSlots.every((slot) => isValidConversationSlot(slot))
  );
}

export function isValidConversationScenarioManifestEntry(
  value: unknown,
): value is ConversationScenarioPackManifestEntry {
  return (
    isRecord(value) &&
    isValidLevel(value.level) &&
    isPositiveInteger(value.version) &&
    isSafeRelativePackPath(value.path) &&
    isPositiveInteger(value.scenarioCount)
  );
}

export function isValidConversationScenarioManifest(
  value: unknown,
): value is ConversationScenarioPackManifest {
  return (
    isRecord(value) &&
    value.schemaVersion === CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION &&
    isValidDateString(value.publishedAt) &&
    Array.isArray(value.packs) &&
    value.packs.length > 0 &&
    value.packs.every((entry) => isValidConversationScenarioManifestEntry(entry))
  );
}

export function isValidLevelConversationScenarioPack(
  value: unknown,
): value is LevelConversationScenarioPack {
  if (
    !isRecord(value) ||
    value.schemaVersion !== CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION ||
    !isValidLevel(value.level) ||
    !isPositiveInteger(value.version) ||
    !isValidDateString(value.publishedAt) ||
    !Array.isArray(value.scenarios) ||
    value.scenarios.length === 0
  ) {
    return false;
  }

  const scenarioIds = new Set<string>();

  for (const scenario of value.scenarios) {
    if (!isValidConversationScenario(scenario, value.level)) {
      return false;
    }

    if (scenarioIds.has(scenario.id)) {
      return false;
    }

    scenarioIds.add(scenario.id);
  }

  return true;
}
