import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_CLIENT_ID_STORAGE_KEY = 'englishProject.apiClientId.v1';
const CLIENT_ID_PATTERN = /^ep-[A-Za-z0-9._:-]{5,93}$/;

type ExpoEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

let cachedClientId: string | null = null;
let pendingClientId: Promise<string> | null = null;

export async function getApiClientId(): Promise<string> {
  const overrideClientId = getConfiguredClientIdOverride();

  if (overrideClientId) {
    return overrideClientId;
  }

  if (cachedClientId) {
    return cachedClientId;
  }

  if (!pendingClientId) {
    pendingClientId = loadOrCreateClientId().finally(() => {
      pendingClientId = null;
    });
  }

  return pendingClientId;
}

export async function getAiRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-English-Project-Client-Id': await getApiClientId(),
  };
  const masterTestToken = getConfiguredMasterTestToken();

  if (masterTestToken) {
    headers['X-English-Project-Master-Test-Token'] = masterTestToken;
  }

  return headers;
}

export function __resetApiClientIdCacheForTest() {
  cachedClientId = null;
  pendingClientId = null;
}

async function loadOrCreateClientId(): Promise<string> {
  const storedClientId = await readStoredClientId();

  if (storedClientId) {
    cachedClientId = storedClientId;
    return storedClientId;
  }

  const nextClientId = createClientId();
  cachedClientId = nextClientId;

  try {
    await AsyncStorage.setItem(API_CLIENT_ID_STORAGE_KEY, nextClientId);
  } catch {
    // The in-memory id still protects one app session if storage is unavailable.
  }

  return nextClientId;
}

async function readStoredClientId(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(API_CLIENT_ID_STORAGE_KEY);
    return isValidClientId(value) ? value : null;
  } catch {
    return null;
  }
}

function createClientId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `ep-${timestamp}-${randomPart}`;
}

function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value);
}

function getConfiguredClientIdOverride(): string | null {
  const value = (globalThis as ExpoEnv).process?.env?.EXPO_PUBLIC_API_CLIENT_ID_OVERRIDE;
  return isValidClientId(value) ? value : null;
}

function getConfiguredMasterTestToken(): string | null {
  const value = (globalThis as ExpoEnv).process?.env?.EXPO_PUBLIC_MASTER_TEST_TOKEN;
  const token = typeof value === 'string' ? value.trim() : '';
  return token.length > 0 ? token : null;
}
