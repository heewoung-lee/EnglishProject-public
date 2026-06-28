import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
  CONVERSATION_SCENARIO_PACK_STORAGE_KEY,
} from '../constants/learningConfig';
import { scenarios } from '../data/scenarios';
import type {
  CachedConversationScenarioPack,
  CachedConversationScenarioPackState,
  LearnerLevel,
} from '../types/conversation';
import {
  loadCachedConversationScenarios,
  saveCachedConversationScenarios,
} from './conversationScenarioStorage';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

const publishedAt = '2026-06-10T00:00:00.000Z';
const cachedAt = '2026-06-10T00:01:00.000Z';

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

function levelScenarios(level: LearnerLevel) {
  return scenarios.filter((scenario) => scenario.level === level);
}

function createCachedPack<Level extends LearnerLevel>(
  level: Level,
): CachedConversationScenarioPack<Level> {
  return {
    level,
    version: 1,
    publishedAt,
    cachedAt,
    scenarios: levelScenarios(level),
  };
}

function createValidCache(): CachedConversationScenarioPackState {
  return {
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    manifestPublishedAt: publishedAt,
    packs: {
      A1: createCachedPack('A1'),
    },
  };
}

beforeEach(() => {
  asyncStorageMock.getItem.mockReset();
  asyncStorageMock.setItem.mockReset();
  asyncStorageMock.setItem.mockResolvedValue(undefined);
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
});

describe('conversationScenarioStorage', () => {
  it('returns null when no scenario cache exists', async () => {
    asyncStorageMock.getItem.mockResolvedValue(null);

    await expect(loadCachedConversationScenarios()).resolves.toBeNull();
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith(CONVERSATION_SCENARIO_PACK_STORAGE_KEY);
  });

  it('loads a valid scenario cache', async () => {
    const cache = createValidCache();
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedConversationScenarios()).resolves.toEqual(cache);
  });

  it('returns null for malformed cached state shapes', async () => {
    const cache = createValidCache();
    const invalidCaches = [
      { ...cache, schemaVersion: 2 },
      { ...cache, manifestPublishedAt: undefined },
      { ...cache, packs: {} },
    ];

    for (const invalidCache of invalidCaches) {
      asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(invalidCache));

      await expect(loadCachedConversationScenarios()).resolves.toBeNull();
    }
  });

  it('saves the scenario cache under the scenario storage key', async () => {
    const cache = createValidCache();

    await expect(saveCachedConversationScenarios(cache)).resolves.toBeUndefined();
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      CONVERSATION_SCENARIO_PACK_STORAGE_KEY,
      JSON.stringify(cache),
    );
  });
});
