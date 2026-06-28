import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEVEL_ORDER,
  QUESTION_PACK_SCHEMA_VERSION,
  QUESTION_PACK_STORAGE_KEY,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  CachedLevelPack,
  CachedQuestionPackState,
  LearnerLevel,
  LearningQuestion,
} from '../types/learning';
import {
  loadCachedQuestionPacks,
  saveCachedQuestionPacks,
} from './questionPackStorage';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

const publishedAt = '2026-06-09T00:00:00.000Z';
const cachedAt = '2026-06-09T00:01:00.000Z';

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

function levelQuestions(level: LearnerLevel): LearningQuestion[] {
  const questions = questionBank.filter((item) => item.level === level);

  if (questions.length === 0) {
    throw new Error(`Missing bundled ${level} question fixture.`);
  }

  return questions;
}

function questionForLevel(level: LearnerLevel): LearningQuestion {
  return levelQuestions(level)[0];
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

function createValidCache(
  packs: CachedQuestionPackState['packs'] = LEVEL_ORDER.reduce<CachedQuestionPackState['packs']>(
    (cachePacks, level) => ({
      ...cachePacks,
      [level]: createCachedPack(level),
    }),
    {},
  ),
): CachedQuestionPackState {
  return {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    manifestPublishedAt: publishedAt,
    packs,
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

describe('questionPackStorage', () => {
  it('uses the current question pack cache namespace', () => {
    expect(QUESTION_PACK_STORAGE_KEY).toBe('englishProject.questionPacks.v4');
  });

  it('returns null when no question pack cache exists', async () => {
    asyncStorageMock.getItem.mockResolvedValue(null);

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith(QUESTION_PACK_STORAGE_KEY);
  });

  it('loads a valid question pack cache', async () => {
    const cache = createValidCache();
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toEqual(cache);
  });

  it('returns null and warns when cached JSON is malformed', async () => {
    asyncStorageMock.getItem.mockResolvedValue('{bad json');

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
  });

  it('returns null and warns when reading the cache fails', async () => {
    asyncStorageMock.getItem.mockRejectedValue(new Error('read unavailable'));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
  });

  it('returns null for cached packs with invalid questions', async () => {
    const invalidQuestion = {
      ...questionForLevel('A1'),
      choices: [],
    };
    const cache = createValidCache({
      A1: createCachedPack('A1', [invalidQuestion]),
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when a cached pack map key does not match the pack level', async () => {
    const cache = createValidCache({
      A1: createCachedPack('A2') as unknown as CachedLevelPack<'A1'>,
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null for malformed cached state shapes', async () => {
    const cache = createValidCache();
    const invalidCaches = [
      { ...cache, schemaVersion: 2 },
      { ...cache, manifestPublishedAt: undefined },
      { ...cache, packs: [] },
    ];

    for (const invalidCache of invalidCaches) {
      asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(invalidCache));

      await expect(loadCachedQuestionPacks()).resolves.toBeNull();
    }
  });

  it('returns null when the cached packs object is empty', async () => {
    const cache = createValidCache({});
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when a cached pack has no questions', async () => {
    const cache = createValidCache({
      A1: createCachedPack('A1', []),
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when a cached pack has too few questions', async () => {
    const cache = createValidCache({
      A1: createCachedPack('A1', [questionForLevel('A1')]),
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when a cached pack has duplicate question ids', async () => {
    const firstQuestion = questionForLevel('A1');
    const duplicateQuestions = levelQuestions('A1').map((question, index) =>
      index === 1 ? { ...question, id: firstQuestion.id } : question,
    );
    const cache = createValidCache({
      A1: createCachedPack('A1', duplicateQuestions),
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('returns null when a cached pack cannot cover promotion blueprint areas', async () => {
    const questions = levelQuestions('A2').map((question, index) => {
      if (question.area !== 'conversation') {
        return question;
      }

      return {
        ...question,
        id: `${question.id}-grammar-${index}`,
        area: 'grammar' as const,
      } satisfies LearningQuestion;
    });
    const cache = createValidCache({
      A2: createCachedPack('A2', questions),
    });
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(cache));

    await expect(loadCachedQuestionPacks()).resolves.toBeNull();
  });

  it('saves the question pack cache under the question pack storage key', async () => {
    const cache = createValidCache();

    await expect(saveCachedQuestionPacks(cache)).resolves.toBeUndefined();
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      QUESTION_PACK_STORAGE_KEY,
      JSON.stringify(cache),
    );
  });
});
