import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEVEL_ORDER,
  QUESTION_PACK_SCHEMA_VERSION,
  REMOTE_QUESTION_PACK_BASE_URL,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  CachedLevelPack,
  CachedQuestionPackState,
  LearnerLevel,
  LearningQuestion,
  LevelQuestionPack,
  QuestionPackManifest,
} from '../types/learning';
import {
  buildQuestionPackSourceFromCache,
  fetchRemoteQuestionPackCache,
  getBundledQuestionPackSource,
  loadQuestionPackSource,
  refreshQuestionPackCache,
} from './questionPackService';

const publishedAt = '2026-06-09T00:00:00.000Z';
const cachedAt = '2026-06-09T00:01:00.000Z';

function levelQuestions(level: LearnerLevel): LearningQuestion[] {
  return questionBank.filter((question) => question.level === level);
}

function createCachedPack<Level extends LearnerLevel>(
  level: Level,
  questions: LearningQuestion[] = levelQuestions(level),
): CachedLevelPack<Level> {
  return {
    level,
    version: 1,
    publishedAt,
    cachedAt,
    questions,
  };
}

function createCache(packs: CachedQuestionPackState['packs']): CachedQuestionPackState {
  return {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    manifestPublishedAt: publishedAt,
    packs,
  };
}

function createLevelPack<Level extends LearnerLevel>(
  level: Level,
  questions: LearningQuestion[] = levelQuestions(level),
): LevelQuestionPack {
  return {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    level,
    version: 1,
    publishedAt,
    questions,
  };
}

function createManifestEntry(level: LearnerLevel, questionCount = levelQuestions(level).length) {
  return {
    level,
    version: 1,
    path: `packs/${level.toLowerCase()}.json`,
    questionCount,
  };
}

function createManifest(packs = [createManifestEntry('A1')]): QuestionPackManifest {
  return {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    publishedAt,
    packs,
  };
}

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function mergeBundledWithLevelQuestions(
  replacements: Partial<Record<LearnerLevel, LearningQuestion[]>>,
): LearningQuestion[] {
  return LEVEL_ORDER.flatMap((level) => replacements[level] ?? levelQuestions(level));
}

function replaceFirstLevelQuestionId(level: LearnerLevel, id: string): LearningQuestion[] {
  return levelQuestions(level).map((question, index) => (
    index === 0 ? { ...question, id } : question
  ));
}

function okJson(value: unknown): FetchResponse {
  return {
    ok: true,
    json: async () => value,
  };
}

describe('questionPackService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(cachedAt));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns the bundled question pack source', () => {
    expect(getBundledQuestionPackSource()).toEqual({
      origin: 'bundled',
      questions: questionBank,
      cachedState: null,
    });
  });

  it('merges cached packs over bundled questions by level', () => {
    const a1CacheQuestions = replaceFirstLevelQuestionId('A1', 'a1-cache');
    const b1CacheQuestions = replaceFirstLevelQuestionId('B1', 'b1-cache');
    const cache = createCache({
      B1: createCachedPack('B1', b1CacheQuestions),
      A1: createCachedPack('A1', a1CacheQuestions),
    });

    expect(buildQuestionPackSourceFromCache(cache)).toEqual({
      origin: 'cache',
      questions: mergeBundledWithLevelQuestions({
        A1: a1CacheQuestions,
        B1: b1CacheQuestions,
      }),
      cachedState: cache,
    });
  });

  it('keeps bundled B1 questions when only A1 is cached', () => {
    const a1CacheQuestions = replaceFirstLevelQuestionId('A1', 'a1-cache');
    const cache = createCache({
      A1: createCachedPack('A1', a1CacheQuestions),
    });
    const source = buildQuestionPackSourceFromCache(cache);

    expect(source.origin).toBe('cache');
    expect(source.cachedState).toBe(cache);
    expect(source.questions).toEqual(mergeBundledWithLevelQuestions({ A1: a1CacheQuestions }));
    expect(source.questions.filter((question) => question.level === 'B1')).toEqual(
      levelQuestions('B1'),
    );
  });

  it('keeps bundled level questions when a cached pack has fewer questions than bundled', () => {
    const staleA1Questions = levelQuestions('A1').slice(0, 3);
    const cache = createCache({
      A1: createCachedPack('A1', staleA1Questions),
    });
    const source = buildQuestionPackSourceFromCache(cache);

    expect(source.origin).toBe('cache');
    expect(source.cachedState).toBe(cache);
    expect(source.questions.filter((question) => question.level === 'A1')).toEqual(
      levelQuestions('A1'),
    );
  });

  it('returns bundled source when cached A1 questions reuse a bundled B1 question id', () => {
    const a1CacheQuestions = replaceFirstLevelQuestionId('A1', levelQuestions('B1')[0].id);
    const cache = createCache({
      A1: createCachedPack('A1', a1CacheQuestions),
    });

    expect(buildQuestionPackSourceFromCache(cache)).toEqual(getBundledQuestionPackSource());
  });

  it('returns bundled source when no cached packs exist', () => {
    expect(buildQuestionPackSourceFromCache(null)).toEqual(getBundledQuestionPackSource());
    expect(buildQuestionPackSourceFromCache(createCache({}))).toEqual(
      getBundledQuestionPackSource(),
    );
  });

  it('loads a cached question pack source when cache exists', async () => {
    const a2CacheQuestions = replaceFirstLevelQuestionId('A2', 'a2-cache');
    const cache = createCache({
      A2: createCachedPack('A2', a2CacheQuestions),
    });
    const loadCachedQuestionPacks = vi.fn().mockResolvedValue(cache);

    await expect(loadQuestionPackSource({ loadCachedQuestionPacks })).resolves.toEqual({
      origin: 'cache',
      questions: mergeBundledWithLevelQuestions({ A2: a2CacheQuestions }),
      cachedState: cache,
    });
    expect(loadCachedQuestionPacks).toHaveBeenCalledTimes(1);
  });

  it('loads the bundled question pack source when cache returns null', async () => {
    const loadCachedQuestionPacks = vi.fn().mockResolvedValue(null);

    await expect(loadQuestionPackSource({ loadCachedQuestionPacks })).resolves.toEqual(
      getBundledQuestionPackSource(),
    );
  });

  it('loads the bundled question pack source when cache loading throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loadCachedQuestionPacks = vi.fn().mockRejectedValue(new Error('storage unavailable'));

    await expect(loadQuestionPackSource({ loadCachedQuestionPacks })).resolves.toEqual(
      getBundledQuestionPackSource(),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load question pack source from cache.',
      expect.any(Error),
    );
  });

  it('refreshes and saves a remote question pack cache when refresh succeeds', async () => {
    const b2RemoteQuestions = replaceFirstLevelQuestionId('B2', 'b2-remote');
    const nextCache = createCache({
      B2: createCachedPack('B2', b2RemoteQuestions),
    });
    const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(nextCache);
    const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshQuestionPackCache({
        fetchRemoteQuestionPackCache,
        saveCachedQuestionPacks,
      }),
    ).resolves.toEqual({
      origin: 'remote',
      questions: mergeBundledWithLevelQuestions({ B2: b2RemoteQuestions }),
      cachedState: nextCache,
    });
    expect(saveCachedQuestionPacks).toHaveBeenCalledWith(nextCache);
  });

  it('keeps bundled B1 questions when only A1 is refreshed remotely', async () => {
    const a1RemoteQuestions = replaceFirstLevelQuestionId('A1', 'a1-remote');
    const nextCache = createCache({
      A1: createCachedPack('A1', a1RemoteQuestions),
    });
    const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(nextCache);
    const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);
    const source = await refreshQuestionPackCache({
      fetchRemoteQuestionPackCache,
      saveCachedQuestionPacks,
    });

    expect(source).toEqual({
      origin: 'remote',
      questions: mergeBundledWithLevelQuestions({ A1: a1RemoteQuestions }),
      cachedState: nextCache,
    });
    expect(source?.questions.filter((question) => question.level === 'B1')).toEqual(
      levelQuestions('B1'),
    );
  });

  it('returns null and does not save when remote A1 questions reuse a bundled B1 question id', async () => {
    const a1RemoteQuestions = replaceFirstLevelQuestionId('A1', levelQuestions('B1')[0].id);
    const nextCache = createCache({
      A1: createCachedPack('A1', a1RemoteQuestions),
    });
    const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(nextCache);
    const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshQuestionPackCache({
        fetchRemoteQuestionPackCache,
        saveCachedQuestionPacks,
      }),
    ).resolves.toBeNull();
    expect(saveCachedQuestionPacks).not.toHaveBeenCalled();
  });

  it('returns null and does not save when remote refresh returns null', async () => {
    const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(null);
    const saveCachedQuestionPacks = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshQuestionPackCache({
        fetchRemoteQuestionPackCache,
        saveCachedQuestionPacks,
      }),
    ).resolves.toBeNull();
    expect(saveCachedQuestionPacks).not.toHaveBeenCalled();
  });

  it('returns null when saving refreshed question packs throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const nextCache = createCache({
      A1: createCachedPack('A1'),
    });
    const fetchRemoteQuestionPackCache = vi.fn().mockResolvedValue(nextCache);
    const saveCachedQuestionPacks = vi.fn().mockRejectedValue(new Error('save unavailable'));

    await expect(
      refreshQuestionPackCache({
        fetchRemoteQuestionPackCache,
        saveCachedQuestionPacks,
      }),
    ).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to save refreshed question pack cache.',
      expect.any(Error),
    );
  });

  it('downloads a valid manifest and pack into cache', async () => {
    const manifest = createManifest();
    const pack = createLevelPack('A1');
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === 'https://example.test/question-packs/manifest.json') {
        return okJson(manifest);
      }

      if (url === 'https://example.test/question-packs/packs/a1.json') {
        return okJson(pack);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      fetchRemoteQuestionPackCache({
        baseUrl: 'https://example.test/question-packs/',
        fetchImpl,
      }),
    ).resolves.toEqual({
      schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
      manifestPublishedAt: publishedAt,
      packs: {
        A1: {
          level: 'A1',
          version: 1,
          publishedAt,
          questions: pack.questions,
          cachedAt,
        },
      },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://example.test/question-packs/manifest.json',
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://example.test/question-packs/packs/a1.json',
    );
  });

  it('uses the configured Firebase Hosting base URL by default', async () => {
    const manifest = createManifest();
    const pack = createLevelPack('A1');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(manifest))
      .mockResolvedValueOnce(okJson(pack));

    await fetchRemoteQuestionPackCache({ fetchImpl });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `${REMOTE_QUESTION_PACK_BASE_URL}/manifest.json`,
    );
  });

  it('uses global fetch with the configured Firebase Hosting base URL by default', async () => {
    const originalFetch = globalThis.fetch;
    const manifest = createManifest();
    const pack = createLevelPack('A1');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(manifest))
      .mockResolvedValueOnce(okJson(pack));
    globalThis.fetch = fetchImpl as unknown as typeof globalThis.fetch;

    try {
      await expect(fetchRemoteQuestionPackCache()).resolves.toEqual({
        schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
        manifestPublishedAt: publishedAt,
        packs: {
          A1: {
            level: 'A1',
            version: 1,
            publishedAt,
            questions: pack.questions,
            cachedAt,
          },
        },
      });
      expect(fetchImpl).toHaveBeenNthCalledWith(
        1,
        `${REMOTE_QUESTION_PACK_BASE_URL}/manifest.json`,
      );
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        `${REMOTE_QUESTION_PACK_BASE_URL}/packs/a1.json`,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns null when the manifest cannot be fetched', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network unavailable');
    });

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });

  it('returns null when a downloaded pack fails validation', async () => {
    const invalidPack = {
      ...createLevelPack('A1'),
      questions: [],
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest()))
      .mockResolvedValueOnce(okJson(invalidPack));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });

  it('returns null when downloaded packs reuse a question id across levels', async () => {
    const a1Pack = createLevelPack('A1', [
      {
        ...levelQuestions('A1')[0],
        id: levelQuestions('B1')[0].id,
      },
      ...levelQuestions('A1').slice(1),
    ]);
    const b1Pack = createLevelPack('B1');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest([
        createManifestEntry('A1', a1Pack.questions.length),
        createManifestEntry('B1', b1Pack.questions.length),
      ])))
      .mockResolvedValueOnce(okJson(a1Pack))
      .mockResolvedValueOnce(okJson(b1Pack));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });

  it('returns null without fetching a pack when the manifest path uses encoded traversal', async () => {
    const baseUrl = 'https://example.test/question-packs';
    const unsafePath = 'packs/%2e%2e/%2e%2e/config.json';
    const unsafePackUrl = `${baseUrl}/${unsafePath}`;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === `${baseUrl}/manifest.json`) {
        return okJson(createManifest([
          {
            ...createManifestEntry('A1'),
            path: unsafePath,
          },
        ]));
      }

      if (url === unsafePackUrl) {
        return okJson(createLevelPack('A1'));
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(fetchRemoteQuestionPackCache({ baseUrl, fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalledWith(unsafePackUrl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null when the manifest contains duplicate levels', async () => {
    const manifest = createManifest([
      createManifestEntry('A1'),
      {
        ...createManifestEntry('A1'),
        path: 'packs/a1-v2.json',
      },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(okJson(manifest));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null when the manifest entry question count does not match the pack', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest([createManifestEntry('A1', 999)])))
      .mockResolvedValueOnce(okJson(createLevelPack('A1')));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });

  it('returns null when the manifest entry level does not match the pack', async () => {
    const pack = createLevelPack('B1');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest([createManifestEntry('A1', pack.questions.length)])))
      .mockResolvedValueOnce(okJson(pack));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });

  it('returns null when the manifest entry version does not match the pack', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okJson(createManifest([
        {
          ...createManifestEntry('A1'),
          version: 2,
        },
      ])))
      .mockResolvedValueOnce(okJson(createLevelPack('A1')));

    await expect(fetchRemoteQuestionPackCache({ fetchImpl })).resolves.toBeNull();
  });
});
