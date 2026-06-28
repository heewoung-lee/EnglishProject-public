import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LEVEL_ORDER,
  QUESTION_PACK_SCHEMA_VERSION,
  QUESTION_PACK_STORAGE_KEY,
} from '../constants/learningConfig';
import type {
  CachedLevelPack,
  CachedQuestionPackState,
  LearnerLevel,
} from '../types/learning';
import { isValidLevelQuestionPack } from './questionPackValidation';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLevel(value: unknown): value is LearnerLevel {
  return LEVEL_ORDER.includes(value as LearnerLevel);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isValidCachedLevelPack<Level extends LearnerLevel>(
  value: unknown,
  expectedLevel: Level,
): value is CachedLevelPack<Level> {
  if (!isRecord(value) || value.level !== expectedLevel || !isValidDateString(value.cachedAt)) {
    return false;
  }

  return isValidLevelQuestionPack({
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    level: expectedLevel,
    version: value.version,
    publishedAt: value.publishedAt,
    questions: value.questions,
  });
}

function isValidCachedPacksObject(value: unknown): value is CachedQuestionPackState['packs'] {
  if (!isRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);

  return entries.length > 0 && entries.every(([level, pack]) => {
    return isValidLevel(level) && isValidCachedLevelPack(pack, level);
  });
}

function isValidCachedQuestionPackState(value: unknown): value is CachedQuestionPackState {
  return (
    isRecord(value) &&
    value.schemaVersion === QUESTION_PACK_SCHEMA_VERSION &&
    isValidDateString(value.manifestPublishedAt) &&
    isValidCachedPacksObject(value.packs)
  );
}

export async function loadCachedQuestionPacks(): Promise<CachedQuestionPackState | null> {
  let rawCache: string | null;

  try {
    rawCache = await AsyncStorage.getItem(QUESTION_PACK_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load question pack cache.', error);
    return null;
  }

  if (!rawCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(rawCache) as unknown;
    return isValidCachedQuestionPackState(parsedCache) ? parsedCache : null;
  } catch (error) {
    console.warn('Failed to parse question pack cache.', error);
    return null;
  }
}

export async function saveCachedQuestionPacks(
  cache: CachedQuestionPackState,
): Promise<void> {
  await AsyncStorage.setItem(QUESTION_PACK_STORAGE_KEY, JSON.stringify(cache));
}
