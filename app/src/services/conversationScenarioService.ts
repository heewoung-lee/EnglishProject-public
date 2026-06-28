import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
  LEVEL_ORDER,
  REMOTE_CONVERSATION_SCENARIO_BASE_URL,
} from '../constants/learningConfig';
import { scenarios as bundledScenarios } from '../data/scenarios';
import type {
  CachedConversationScenarioPackState,
  LearnerLevel,
  LevelConversationScenarioPack,
  ConversationScenarioSource,
  Scenario,
} from '../types/conversation';
import {
  isValidConversationScenarioManifest,
  isValidLevelConversationScenarioPack,
} from './conversationScenarioValidation';
import {
  loadCachedConversationScenarios as loadCachedConversationScenariosFromStorage,
  saveCachedConversationScenarios as saveCachedConversationScenariosToStorage,
} from './conversationScenarioStorage';

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

function createBaseScenarioPackUrl(baseUrl: string): URL | null {
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

function hasDuplicateManifestLevels(entries: { level: LearnerLevel }[]): boolean {
  const seenLevels = new Set<LearnerLevel>();

  for (const entry of entries) {
    if (seenLevels.has(entry.level)) {
      return true;
    }

    seenLevels.add(entry.level);
  }

  return false;
}

function hasDuplicateScenarioIds(scenarios: Scenario[]): boolean {
  const seenIds = new Set<string>();

  for (const scenario of scenarios) {
    if (seenIds.has(scenario.id)) {
      return true;
    }

    seenIds.add(scenario.id);
  }

  return false;
}

function doesPackMatchManifestEntry(
  pack: LevelConversationScenarioPack,
  entry: { level: LearnerLevel; version: number; scenarioCount: number },
): boolean {
  return (
    pack.level === entry.level &&
    pack.version === entry.version &&
    pack.scenarios.length === entry.scenarioCount
  );
}

function addCachedPack(
  packs: CachedConversationScenarioPackState['packs'],
  pack: LevelConversationScenarioPack,
  cachedAt: string,
): void {
  switch (pack.level) {
    case 'A1':
      packs.A1 = {
        level: 'A1',
        version: pack.version,
        publishedAt: pack.publishedAt,
        scenarios: pack.scenarios,
        cachedAt,
      };
      break;
    case 'A2':
      packs.A2 = {
        level: 'A2',
        version: pack.version,
        publishedAt: pack.publishedAt,
        scenarios: pack.scenarios,
        cachedAt,
      };
      break;
    case 'B1':
      packs.B1 = {
        level: 'B1',
        version: pack.version,
        publishedAt: pack.publishedAt,
        scenarios: pack.scenarios,
        cachedAt,
      };
      break;
    case 'B2':
      packs.B2 = {
        level: 'B2',
        version: pack.version,
        publishedAt: pack.publishedAt,
        scenarios: pack.scenarios,
        cachedAt,
      };
      break;
  }
}

export function getBundledConversationScenarioSource(): ConversationScenarioSource {
  return {
    origin: 'bundled',
    scenarios: bundledScenarios,
    cachedState: null,
  };
}

function hasCachedPacks(cache: CachedConversationScenarioPackState): boolean {
  return LEVEL_ORDER.some((level) => Boolean(cache.packs[level]));
}

function mergeCachedScenariosOverBundled(
  cache: CachedConversationScenarioPackState,
): Scenario[] {
  return LEVEL_ORDER.flatMap((level) => {
    const bundledLevelScenarios = bundledScenarios.filter((scenario) => scenario.level === level);
    const cachedLevelScenarios = cache.packs[level]?.scenarios;

    return cachedLevelScenarios && cachedLevelScenarios.length >= bundledLevelScenarios.length
      ? cachedLevelScenarios
      : bundledLevelScenarios;
  });
}

export function buildConversationScenarioSourceFromCache(
  cache: CachedConversationScenarioPackState | null,
): ConversationScenarioSource {
  if (!cache || !hasCachedPacks(cache)) {
    return getBundledConversationScenarioSource();
  }

  const scenarios = mergeCachedScenariosOverBundled(cache);

  if (hasDuplicateScenarioIds(scenarios)) {
    return getBundledConversationScenarioSource();
  }

  return {
    origin: 'cache',
    scenarios,
    cachedState: cache,
  };
}

export async function loadConversationScenarioSource(options?: {
  loadCachedConversationScenarios?: typeof loadCachedConversationScenariosFromStorage;
}): Promise<ConversationScenarioSource> {
  const loadCachedConversationScenarios =
    options?.loadCachedConversationScenarios ?? loadCachedConversationScenariosFromStorage;

  try {
    return buildConversationScenarioSourceFromCache(await loadCachedConversationScenarios());
  } catch (error) {
    console.warn('Failed to load conversation scenario source from cache.', error);
    return getBundledConversationScenarioSource();
  }
}

export async function fetchRemoteConversationScenarioCache(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<CachedConversationScenarioPackState | null> {
  const fetchImpl = getFetchImplementation(options?.fetchImpl);

  if (!fetchImpl) {
    return null;
  }

  const baseUrl = options?.baseUrl ?? REMOTE_CONVERSATION_SCENARIO_BASE_URL;
  const normalizedBaseUrl = createBaseScenarioPackUrl(baseUrl);
  const manifestUrl = normalizedBaseUrl
    ? resolveBaseRelativeUrl(normalizedBaseUrl, 'manifest.json')
    : null;

  if (!normalizedBaseUrl || !manifestUrl) {
    return null;
  }

  const manifestJson = await fetchJson(fetchImpl, manifestUrl.href);

  if (!isValidConversationScenarioManifest(manifestJson)) {
    return null;
  }

  if (hasDuplicateManifestLevels(manifestJson.packs)) {
    return null;
  }

  const cachedAt = new Date().toISOString();
  const packs: CachedConversationScenarioPackState['packs'] = {};

  for (const entry of manifestJson.packs) {
    const packUrl = resolvePackUrl(normalizedBaseUrl, entry.path);

    if (!packUrl) {
      return null;
    }

    const packJson = await fetchJson(fetchImpl, packUrl);

    if (
      !isValidLevelConversationScenarioPack(packJson) ||
      !doesPackMatchManifestEntry(packJson, entry)
    ) {
      return null;
    }

    addCachedPack(packs, packJson, cachedAt);
  }

  const nextCache: CachedConversationScenarioPackState = {
    schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
    manifestPublishedAt: manifestJson.publishedAt,
    packs,
  };

  return hasDuplicateScenarioIds(mergeCachedScenariosOverBundled(nextCache)) ? null : nextCache;
}

export async function refreshConversationScenarioCache(options?: {
  fetchRemoteConversationScenarioCache?: typeof fetchRemoteConversationScenarioCache;
  saveCachedConversationScenarios?: typeof saveCachedConversationScenariosToStorage;
}): Promise<ConversationScenarioSource | null> {
  const fetchRemoteCache =
    options?.fetchRemoteConversationScenarioCache ?? fetchRemoteConversationScenarioCache;
  const saveCachedConversationScenarios =
    options?.saveCachedConversationScenarios ?? saveCachedConversationScenariosToStorage;
  const nextCache = await fetchRemoteCache();

  if (!nextCache) {
    return null;
  }

  const scenarios = mergeCachedScenariosOverBundled(nextCache);

  if (hasDuplicateScenarioIds(scenarios)) {
    return null;
  }

  try {
    await saveCachedConversationScenarios(nextCache);
  } catch (error) {
    console.warn('Failed to save refreshed conversation scenario cache.', error);
    return null;
  }

  return {
    origin: 'remote',
    scenarios,
    cachedState: nextCache,
  };
}
