import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
  REMOTE_CONVERSATION_SCENARIO_BASE_URL,
} from '../constants/learningConfig';
import { scenarios } from '../data/scenarios';
import type {
  CachedConversationScenarioPack,
  CachedConversationScenarioPackState,
  ConversationScenarioPackManifest,
  LearnerLevel,
  LevelConversationScenarioPack,
  Scenario,
} from '../types/conversation';
import {
  buildConversationScenarioSourceFromCache,
  fetchRemoteConversationScenarioCache,
  getBundledConversationScenarioSource,
  loadConversationScenarioSource,
  refreshConversationScenarioCache,
} from './conversationScenarioService';

const publishedAt = '2026-06-10T00:00:00.000Z';
const cachedAt = '2026-06-10T00:01:00.000Z';

function levelScenarios(level: LearnerLevel): Scenario[] {
  return scenarios.filter((scenario) => scenario.level === level);
}

function replaceFirstScenarioId(level: LearnerLevel, id: string): Scenario[] {
  return levelScenarios(level).map((scenario, index) => (
    index === 0 ? { ...scenario, id } : scenario
  ));
}

function createCachedPack<Level extends LearnerLevel>(
  level: Level,
  scenarioList: Scenario[] = levelScenarios(level),
): CachedConversationScenarioPack<Level> {
  return {
    level,
    version: 1,
    publishedAt,
    cachedAt,
    scenarios: scenarioList,
  };
}

function createCache(
  packs: CachedConversationScenarioPackState['packs'],
): CachedConversationScenarioPackState {
  return {
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    manifestPublishedAt: publishedAt,
    packs,
  };
}

function createLevelPack<Level extends LearnerLevel>(
  level: Level,
  scenarioList: Scenario[] = levelScenarios(level),
): LevelConversationScenarioPack {
  return {
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    level,
    version: 1,
    publishedAt,
    scenarios: scenarioList,
  };
}

function createManifestEntry(level: LearnerLevel, scenarioCount = levelScenarios(level).length) {
  return {
    level,
    version: 1,
    path: `packs/${level.toLowerCase()}.json`,
    scenarioCount,
  };
}

function createManifest(packs = [createManifestEntry('A1')]): ConversationScenarioPackManifest {
  return {
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    publishedAt,
    packs,
  };
}

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function okJson(value: unknown): FetchResponse {
  return {
    ok: true,
    json: async () => value,
  };
}

describe('conversationScenarioService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(cachedAt));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns bundled conversation scenarios', () => {
    expect(getBundledConversationScenarioSource()).toEqual({
      origin: 'bundled',
      scenarios,
      cachedState: null,
    });
  });

  it('merges cached scenarios over bundled scenarios by level', () => {
    const a1RemoteScenarios = replaceFirstScenarioId('A1', 'a1-remote-scenario');
    const cache = createCache({
      A1: createCachedPack('A1', a1RemoteScenarios),
    });

    expect(buildConversationScenarioSourceFromCache(cache)).toEqual({
      origin: 'cache',
      scenarios: [
        ...a1RemoteScenarios,
        ...levelScenarios('A2'),
      ],
      cachedState: cache,
    });
  });

  it('loads bundled scenarios when cache loading fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loadCachedConversationScenarios = vi.fn().mockRejectedValue(new Error('read failed'));

    await expect(
      loadConversationScenarioSource({ loadCachedConversationScenarios }),
    ).resolves.toEqual(getBundledConversationScenarioSource());
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load conversation scenario source from cache.',
      expect.any(Error),
    );
  });

  it('downloads a valid remote manifest and scenario pack into cache', async () => {
    const manifest = createManifest();
    const pack = createLevelPack('A1');
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === 'https://example.test/conversation-scenarios/manifest.json') {
        return okJson(manifest);
      }

      if (url === 'https://example.test/conversation-scenarios/packs/a1.json') {
        return okJson(pack);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      fetchRemoteConversationScenarioCache({
        baseUrl: 'https://example.test/conversation-scenarios/',
        fetchImpl,
      }),
    ).resolves.toEqual({
      schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
      manifestPublishedAt: publishedAt,
      packs: {
        A1: {
          level: 'A1',
          version: 1,
          publishedAt,
          scenarios: pack.scenarios,
          cachedAt,
        },
      },
    });
  });

  it('uses the configured Firebase Hosting base URL by default', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest()))
      .mockResolvedValueOnce(okJson(createLevelPack('A1')));

    await fetchRemoteConversationScenarioCache({ fetchImpl });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `${REMOTE_CONVERSATION_SCENARIO_BASE_URL}/manifest.json`,
    );
  });

  it('rejects unsafe manifest paths before fetching a pack', async () => {
    const baseUrl = 'https://example.test/conversation-scenarios';
    const unsafePath = 'packs/%2e%2e/config.json';
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === `${baseUrl}/manifest.json`) {
        return okJson(createManifest([{
          ...createManifestEntry('A1'),
          path: unsafePath,
        }]));
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      fetchRemoteConversationScenarioCache({ baseUrl, fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a downloaded pack that does not match its manifest entry', async () => {
    const pack = createLevelPack('A2');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest([createManifestEntry('A1', pack.scenarios.length)])))
      .mockResolvedValueOnce(okJson(pack));

    await expect(fetchRemoteConversationScenarioCache({ fetchImpl })).resolves.toBeNull();
  });

  it('refreshes and saves a remote scenario cache', async () => {
    const nextCache = createCache({
      A2: createCachedPack('A2', replaceFirstScenarioId('A2', 'a2-remote-scenario')),
    });
    const fetchRemoteConversationScenarioCache = vi.fn().mockResolvedValue(nextCache);
    const saveCachedConversationScenarios = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshConversationScenarioCache({
        fetchRemoteConversationScenarioCache,
        saveCachedConversationScenarios,
      }),
    ).resolves.toEqual({
      origin: 'remote',
      scenarios: [
        ...levelScenarios('A1'),
        ...nextCache.packs.A2!.scenarios,
      ],
      cachedState: nextCache,
    });
    expect(saveCachedConversationScenarios).toHaveBeenCalledWith(nextCache);
  });
});
