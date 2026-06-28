import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_CLIENT_ID_STORAGE_KEY,
  __resetApiClientIdCacheForTest,
  getAiRequestHeaders,
  getApiClientId,
} from './apiClientIdentity';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

beforeEach(() => {
  asyncStorageMock.getItem.mockReset();
  asyncStorageMock.setItem.mockReset();
  asyncStorageMock.setItem.mockResolvedValue(undefined);
  __resetApiClientIdCacheForTest();
});

describe('apiClientIdentity', () => {
  const originalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;

  beforeEach(() => {
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process = originalProcess;
  });

  it('reuses a valid stored client id', async () => {
    asyncStorageMock.getItem.mockResolvedValue('ep-existing-client-123');

    const clientId = await getApiClientId();

    expect(clientId).toBe('ep-existing-client-123');
    expect(asyncStorageMock.getItem).toHaveBeenCalledWith(API_CLIENT_ID_STORAGE_KEY);
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('creates and stores a client id when none exists', async () => {
    asyncStorageMock.getItem.mockResolvedValue(null);

    const clientId = await getApiClientId();

    expect(clientId).toMatch(/^ep-[a-z0-9]+-[a-z0-9]+$/);
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(API_CLIENT_ID_STORAGE_KEY, clientId);
  });

  it('adds the client id header for AI requests', async () => {
    asyncStorageMock.getItem.mockResolvedValue('ep-header-client-123');

    const headers = await getAiRequestHeaders();

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'X-English-Project-Client-Id': 'ep-header-client-123',
    });
  });

  it('uses the master test override headers without touching AsyncStorage', async () => {
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process = {
      env: {
        EXPO_PUBLIC_API_CLIENT_ID_OVERRIDE: 'ep-master-hiwoong-test',
        EXPO_PUBLIC_MASTER_TEST_TOKEN: 'master-token',
      },
    };

    const headers = await getAiRequestHeaders();

    expect(headers).toEqual({
      'Content-Type': 'application/json',
      'X-English-Project-Client-Id': 'ep-master-hiwoong-test',
      'X-English-Project-Master-Test-Token': 'master-token',
    });
    expect(asyncStorageMock.getItem).not.toHaveBeenCalled();
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });
});
