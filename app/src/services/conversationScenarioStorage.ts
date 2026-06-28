import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
  CONVERSATION_SCENARIO_PACK_STORAGE_KEY,
  LEVEL_ORDER,
} from '../constants/learningConfig';
import type {
  CachedConversationScenarioPack,
  CachedConversationScenarioPackState,
  LearnerLevel,
} from '../types/conversation';
import { isValidLevelConversationScenarioPack } from './conversationScenarioValidation';

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

function isValidCachedScenarioPack<Level extends LearnerLevel>(
  value: unknown,
  expectedLevel: Level,
): value is CachedConversationScenarioPack<Level> {
  if (!isRecord(value) || value.level !== expectedLevel || !isValidDateString(value.cachedAt)) {
    return false;
  }

  return isValidLevelConversationScenarioPack({
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    level: expectedLevel,
    version: value.version,
    publishedAt: value.publishedAt,
    scenarios: value.scenarios,
  });
}

function isValidCachedPacksObject(
  value: unknown,
): value is CachedConversationScenarioPackState['packs'] {
  if (!isRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);

  return entries.length > 0 && entries.every(([level, pack]) => {
    return isValidLevel(level) && isValidCachedScenarioPack(pack, level);
  });
}

function isValidCachedConversationScenarioPackState(
  value: unknown,
): value is CachedConversationScenarioPackState {
  return (
    isRecord(value) &&
    value.schemaVersion === CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION &&
    isValidDateString(value.manifestPublishedAt) &&
    isValidCachedPacksObject(value.packs)
  );
}

export async function loadCachedConversationScenarios(): Promise<CachedConversationScenarioPackState | null> {
  let rawCache: string | null;

  try {
    rawCache = await AsyncStorage.getItem(CONVERSATION_SCENARIO_PACK_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to load conversation scenario cache.', error);
    return null;
  }

  if (!rawCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(rawCache) as unknown;
    return isValidCachedConversationScenarioPackState(parsedCache) ? parsedCache : null;
  } catch (error) {
    console.warn('Failed to parse conversation scenario cache.', error);
    return null;
  }
}

export async function saveCachedConversationScenarios(
  cache: CachedConversationScenarioPackState,
): Promise<void> {
  await AsyncStorage.setItem(CONVERSATION_SCENARIO_PACK_STORAGE_KEY, JSON.stringify(cache));
}
