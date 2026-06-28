import {
  LEVEL_ORDER,
  QUESTION_PACK_SCHEMA_VERSION,
  REMOTE_QUESTION_PACK_BASE_URL,
} from '../constants/learningConfig';
import { questionBank } from '../data/questionBank';
import type {
  CachedQuestionPackState,
  LearnerLevel,
  LearningQuestion,
  LevelQuestionPack,
  QuestionPackSource,
} from '../types/learning';
import {
  isValidLevelQuestionPack,
  isValidQuestionPackManifest,
} from './questionPackValidation';
import {
  loadCachedQuestionPacks as loadCachedQuestionPacksFromStorage,
  saveCachedQuestionPacks as saveCachedQuestionPacksToStorage,
} from './questionPackStorage';

type FetchResponseLike = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type FetchLike = (url: string) => Promise<FetchResponseLike>;

function getFetchImplementation(fetchImpl?: FetchLike): FetchLike | null {
  if (fetchImpl) {
    return fetchImpl;
  }

  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;

  return typeof globalFetch === 'function' ? globalFetch.bind(globalThis) : null;
}

function createBaseQuestionPackUrl(baseUrl: string): URL | null {
  try {
    const normalizedBaseUrl = new URL(baseUrl);
    normalizedBaseUrl.hash = '';
    normalizedBaseUrl.search = '';

    if (!normalizedBaseUrl.pathname.endsWith('/')) {
      normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname}/`;
    }

    return normalizedBaseUrl;
  } catch {
    return null;
  }
}

function resolveBaseRelativeUrl(baseUrl: URL, relativePath: string): URL | null {
  try {
    const resolvedUrl = new URL(relativePath.replace(/^\/+/, ''), baseUrl);

    if (
      resolvedUrl.origin !== baseUrl.origin ||
      !resolvedUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      return null;
    }

    return resolvedUrl;
  } catch {
    return null;
  }
}

function resolvePackUrl(baseUrl: URL, relativePath: string): string | null {
  const resolvedUrl = resolveBaseRelativeUrl(baseUrl, relativePath);

  if (!resolvedUrl) {
    return null;
  }

  const packPathPrefix = `${baseUrl.pathname}packs/`;

  return resolvedUrl.pathname.startsWith(packPathPrefix) ? resolvedUrl.href : null;
}

async function fetchJson(fetchImpl: FetchLike, url: string): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function hasDuplicateManifestLevels(
  entries: { level: LearnerLevel }[],
): boolean {
  const seenLevels = new Set<LearnerLevel>();

  for (const entry of entries) {
    if (seenLevels.has(entry.level)) {
      return true;
    }

    seenLevels.add(entry.level);
  }

  return false;
}

function hasDuplicateQuestionIds(questions: LearningQuestion[]): boolean {
  const seenIds = new Set<string>();

  for (const question of questions) {
    if (seenIds.has(question.id)) {
      return true;
    }

    seenIds.add(question.id);
  }

  return false;
}

function doesPackMatchManifestEntry(
  pack: LevelQuestionPack,
  entry: { level: LearnerLevel; version: number; questionCount: number },
): boolean {
  return (
    pack.level === entry.level &&
    pack.version === entry.version &&
    pack.questions.length === entry.questionCount
  );
}

function addCachedPack(
  packs: CachedQuestionPackState['packs'],
  pack: LevelQuestionPack,
  cachedAt: string,
): void {
  switch (pack.level) {
    case 'A1':
      packs.A1 = {
        level: 'A1',
        version: pack.version,
        publishedAt: pack.publishedAt,
        questions: pack.questions,
        cachedAt,
      };
      break;
    case 'A2':
      packs.A2 = {
        level: 'A2',
        version: pack.version,
        publishedAt: pack.publishedAt,
        questions: pack.questions,
        cachedAt,
      };
      break;
    case 'B1':
      packs.B1 = {
        level: 'B1',
        version: pack.version,
        publishedAt: pack.publishedAt,
        questions: pack.questions,
        cachedAt,
      };
      break;
    case 'B2':
      packs.B2 = {
        level: 'B2',
        version: pack.version,
        publishedAt: pack.publishedAt,
        questions: pack.questions,
        cachedAt,
      };
      break;
  }
}

export function getBundledQuestionPackSource(): QuestionPackSource {
  return {
    origin: 'bundled',
    questions: questionBank,
    cachedState: null,
  };
}

function hasCachedPacks(cache: CachedQuestionPackState): boolean {
  return LEVEL_ORDER.some((level) => Boolean(cache.packs[level]));
}

function mergeCachedPacksOverBundled(cache: CachedQuestionPackState): LearningQuestion[] {
  return LEVEL_ORDER.flatMap((level) => {
    const bundledQuestions = questionBank.filter((question) => question.level === level);
    const cachedQuestions = cache.packs[level]?.questions;

    return cachedQuestions && cachedQuestions.length >= bundledQuestions.length
      ? cachedQuestions
      : bundledQuestions;
  });
}

export function buildQuestionPackSourceFromCache(
  cache: CachedQuestionPackState | null,
): QuestionPackSource {
  if (!cache || !hasCachedPacks(cache)) {
    return getBundledQuestionPackSource();
  }

  const questions = mergeCachedPacksOverBundled(cache);

  if (hasDuplicateQuestionIds(questions)) {
    return getBundledQuestionPackSource();
  }

  return {
    origin: 'cache',
    questions,
    cachedState: cache,
  };
}

export async function loadQuestionPackSource(options?: {
  loadCachedQuestionPacks?: typeof loadCachedQuestionPacksFromStorage;
}): Promise<QuestionPackSource> {
  const loadCachedQuestionPacks =
    options?.loadCachedQuestionPacks ?? loadCachedQuestionPacksFromStorage;

  try {
    return buildQuestionPackSourceFromCache(await loadCachedQuestionPacks());
  } catch (error) {
    console.warn('Failed to load question pack source from cache.', error);
    return getBundledQuestionPackSource();
  }
}

export async function fetchRemoteQuestionPackCache(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<CachedQuestionPackState | null> {
  const fetchImpl = getFetchImplementation(options?.fetchImpl);

  if (!fetchImpl) {
    return null;
  }

  const baseUrl = options?.baseUrl ?? REMOTE_QUESTION_PACK_BASE_URL;
  const normalizedBaseUrl = createBaseQuestionPackUrl(baseUrl);
  const manifestUrl = normalizedBaseUrl
    ? resolveBaseRelativeUrl(normalizedBaseUrl, 'manifest.json')
    : null;

  if (!normalizedBaseUrl || !manifestUrl) {
    return null;
  }

  const manifestJson = await fetchJson(fetchImpl, manifestUrl.href);

  if (!isValidQuestionPackManifest(manifestJson)) {
    return null;
  }

  if (hasDuplicateManifestLevels(manifestJson.packs)) {
    return null;
  }

  const cachedAt = new Date().toISOString();
  const packs: CachedQuestionPackState['packs'] = {};

  for (const entry of manifestJson.packs) {
    const packUrl = resolvePackUrl(normalizedBaseUrl, entry.path);

    if (!packUrl) {
      return null;
    }

    const packJson = await fetchJson(fetchImpl, packUrl);

    if (
      !isValidLevelQuestionPack(packJson) ||
      !doesPackMatchManifestEntry(packJson, entry)
    ) {
      return null;
    }

    addCachedPack(packs, packJson, cachedAt);
  }

  const nextCache = {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    manifestPublishedAt: manifestJson.publishedAt,
    packs,
  };

  return hasDuplicateQuestionIds(mergeCachedPacksOverBundled(nextCache)) ? null : nextCache;
}

export async function refreshQuestionPackCache(options?: {
  fetchRemoteQuestionPackCache?: typeof fetchRemoteQuestionPackCache;
  saveCachedQuestionPacks?: typeof saveCachedQuestionPacksToStorage;
}): Promise<QuestionPackSource | null> {
  const fetchRemoteCache =
    options?.fetchRemoteQuestionPackCache ?? fetchRemoteQuestionPackCache;
  const saveCachedQuestionPacks =
    options?.saveCachedQuestionPacks ?? saveCachedQuestionPacksToStorage;
  const nextCache = await fetchRemoteCache();

  if (!nextCache) {
    return null;
  }

  const questions = mergeCachedPacksOverBundled(nextCache);

  if (hasDuplicateQuestionIds(questions)) {
    return null;
  }

  try {
    await saveCachedQuestionPacks(nextCache);
  } catch (error) {
    console.warn('Failed to save refreshed question pack cache.', error);
    return null;
  }

  return {
    origin: 'remote',
    questions,
    cachedState: nextCache,
  };
}
