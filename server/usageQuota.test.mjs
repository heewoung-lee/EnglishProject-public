import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_OPERATION_COSTS,
  checkAndConsumeAiQuota,
  createMemoryQuotaStore,
  getAiQuotaIdentity,
} from './usageQuota.mjs';

test('getAiQuotaIdentity uses a stable client id header and avoids trusting spoofed leftmost forwarded IPs', () => {
  const identity = getAiQuotaIdentity({
    headers: {
      'x-english-project-client-id': 'ep-test-client-1',
      'x-appengine-user-ip': '192.0.2.200',
      'x-forwarded-for': '198.51.100.99, 203.0.113.10, 10.0.0.1',
    },
  });

  assert.equal(identity.clientId, 'ep-test-client-1');
  assert.equal(identity.ip, '203.0.113.10');
});

test('checkAndConsumeAiQuota consumes operation credits per client and rejects over limit', async () => {
  const store = createMemoryQuotaStore();
  const request = {
    headers: {
      'x-english-project-client-id': 'ep-client-a',
      'x-forwarded-for': '203.0.113.11',
    },
  };
  const options = {
    store,
    env: {
      AI_DAILY_CLIENT_CREDITS: '2',
      AI_DAILY_IP_CREDITS: '20',
    },
    now: new Date('2026-06-19T10:00:00.000Z'),
  };

  const first = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);
  const second = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);
  const third = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);

  assert.equal(AI_OPERATION_COSTS['writing.evaluate'], 1);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.status, 429);
  assert.equal(third.payload.error, 'AI_DAILY_LIMIT_REACHED');
  assert.equal(third.payload.limitScope, 'client');
  assert.equal(third.payload.resetAt, '2026-06-20T00:00:00.000Z');
});

test('checkAndConsumeAiQuota falls back to IP limits when client id is missing', async () => {
  const store = createMemoryQuotaStore();
  const request = {
    headers: {
      'x-forwarded-for': '203.0.113.12',
    },
  };
  const options = {
    store,
    env: {
      AI_DAILY_CLIENT_CREDITS: '100',
      AI_DAILY_IP_CREDITS: '1',
    },
    now: new Date('2026-06-19T11:00:00.000Z'),
  };

  assert.equal((await checkAndConsumeAiQuota(request, 'writing.evaluate', options)).allowed, true);

  const rejected = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);

  assert.equal(rejected.allowed, false);
  assert.equal(rejected.payload.limitScope, 'ip');
});

test('checkAndConsumeAiQuota can be disabled for local development', async () => {
  const result = await checkAndConsumeAiQuota(
    { headers: {} },
    'conversation.evaluate',
    {
      store: createMemoryQuotaStore(),
      env: {
        AI_USAGE_LIMITS_ENABLED: 'false',
        AI_DAILY_CLIENT_CREDITS: '0',
        AI_DAILY_IP_CREDITS: '0',
      },
      now: new Date('2026-06-19T12:00:00.000Z'),
    },
  );

  assert.equal(result.allowed, true);
  assert.equal(result.remainingCredits, null);
});

test('checkAndConsumeAiQuota exempts only configured master test clients with a matching token', async () => {
  const store = createMemoryQuotaStore();
  const request = {
    headers: {
      'x-english-project-client-id': 'ep-master-hiwoong-test',
      'x-english-project-master-test-token': 'master-token',
      'x-forwarded-for': '203.0.113.30',
    },
  };
  const options = {
    store,
    env: {
      AI_DAILY_CLIENT_CREDITS: '0',
      AI_DAILY_IP_CREDITS: '0',
      AI_QUOTA_EXEMPT_CLIENT_IDS: 'ep-master-hiwoong-test',
      AI_QUOTA_MASTER_TEST_TOKEN: 'master-token',
    },
    now: new Date('2026-06-19T12:30:00.000Z'),
  };

  const result = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);

  assert.equal(result.allowed, true);
  assert.equal(result.quotaBypass, 'masterTest');
  assert.equal(result.remainingCredits, null);
  assert.equal(store.size, 0);
});

test('checkAndConsumeAiQuota rejects configured master clients when the token is missing', async () => {
  const result = await checkAndConsumeAiQuota(
    {
      headers: {
        'x-english-project-client-id': 'ep-master-hiwoong-test',
        'x-forwarded-for': '203.0.113.31',
      },
    },
    'writing.evaluate',
    {
      store: createMemoryQuotaStore(),
      env: {
        AI_DAILY_CLIENT_CREDITS: '0',
        AI_DAILY_IP_CREDITS: '10',
        AI_QUOTA_EXEMPT_CLIENT_IDS: 'ep-master-hiwoong-test',
        AI_QUOTA_MASTER_TEST_TOKEN: 'master-token',
      },
      now: new Date('2026-06-19T12:40:00.000Z'),
    },
  );

  assert.equal(result.allowed, false);
  assert.equal(result.payload.limitScope, 'client');
});

test('checkAndConsumeAiQuota uses a transaction store when Firestore is selected', async () => {
  const firestore = createFakeFirestore();
  const request = {
    headers: {
      'x-english-project-client-id': 'ep-firestore-client',
      'x-forwarded-for': '203.0.113.20',
    },
  };
  const options = {
    firestore,
    env: {
      AI_QUOTA_STORE: 'firestore',
      AI_DAILY_CLIENT_CREDITS: '1',
      AI_DAILY_IP_CREDITS: '20',
    },
    now: new Date('2026-06-19T13:00:00.000Z'),
  };

  const first = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);
  const second = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.payload.limitScope, 'client');
  assert.equal(firestore.records.size, 2);
});

test('checkAndConsumeAiQuota falls back to memory when Firestore quota is unavailable', async () => {
  const fallbackStore = createMemoryQuotaStore();
  const firestore = {
    async runTransaction() {
      throw new Error('5 NOT_FOUND:');
    },
  };
  const request = {
    headers: {
      'x-english-project-client-id': 'ep-firestore-missing',
      'x-forwarded-for': '203.0.113.21',
    },
  };
  const options = {
    fallbackStore,
    firestore,
    env: {
      AI_QUOTA_STORE: 'firestore',
      AI_DAILY_CLIENT_CREDITS: '1',
      AI_DAILY_IP_CREDITS: '20',
    },
    now: new Date('2026-06-19T14:00:00.000Z'),
  };

  const first = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);
  const second = await checkAndConsumeAiQuota(request, 'writing.evaluate', options);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.payload.limitScope, 'client');
});

function createFakeFirestore() {
  const records = new Map();

  return {
    records,
    collection(collectionName) {
      assert.equal(collectionName, 'aiUsageQuotas');

      return {
        doc(documentId) {
          return {
            path: `${collectionName}/${documentId}`,
          };
        },
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(documentRef) {
          const record = records.get(documentRef.path);

          return {
            exists: Boolean(record),
            get(fieldName) {
              return record?.[fieldName];
            },
          };
        },
        set(documentRef, value, options = {}) {
          const previousValue = options.merge ? records.get(documentRef.path) ?? {} : {};
          records.set(documentRef.path, {
            ...previousValue,
            ...value,
          });
        },
      };

      return callback(transaction);
    },
  };
}
