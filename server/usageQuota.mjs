import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const DEFAULT_CLIENT_DAILY_CREDITS = 30;
const DEFAULT_IP_DAILY_CREDITS = 120;
const DEFAULT_LIMITS_ENABLED = true;
const QUOTA_COLLECTION_NAME = 'aiUsageQuotas';
const CLIENT_ID_HEADER = 'x-english-project-client-id';
const MASTER_TEST_TOKEN_HEADER = 'x-english-project-master-test-token';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';
const VALID_CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,96}$/;

export const AI_OPERATION_COSTS = {
  'conversation.respond': 1,
  'conversation.evaluate': 2,
  'writing.evaluate': 1,
};

const defaultQuotaStore = createMemoryQuotaStore();

export function createMemoryQuotaStore() {
  return new Map();
}

export function getAiQuotaIdentity(request) {
  const rawClientId = getHeaderValue(request, CLIENT_ID_HEADER);
  const clientId = normalizeClientId(rawClientId);
  const forwardedFor = getHeaderValue(request, FORWARDED_FOR_HEADER);
  const socketIp = request?.socket?.remoteAddress;
  const ip = normalizeIp(request?.ip)
    || getTrustedForwardedIp(forwardedFor)
    || normalizeIp(socketIp)
    || 'unknown';

  return {
    clientId,
    ip,
  };
}

export async function checkAndConsumeAiQuota(request, operation, options = {}) {
  const env = options.env ?? process.env;

  if (!isLimitsEnabled(env)) {
    return {
      allowed: true,
      status: 200,
      payload: null,
      remainingCredits: null,
    };
  }

  const cost = AI_OPERATION_COSTS[operation];

  if (!Number.isFinite(cost)) {
    throw new Error(`Unknown AI quota operation: ${operation}`);
  }

  const now = options.now ?? new Date();
  const dayKey = getUtcDayKey(now);
  const resetAt = getNextUtcDayStart(now).toISOString();
  const identity = getAiQuotaIdentity(request);

  if (isMasterTestClient(request, identity, env)) {
    return {
      allowed: true,
      status: 200,
      payload: null,
      remainingCredits: null,
      quotaBypass: 'masterTest',
    };
  }

  const buckets = createQuotaBuckets({
    env,
    identity,
    dayKey,
  });

  if (shouldUseFirestoreQuota(env, options)) {
    try {
      return await checkAndConsumeFirestoreQuota({
        firestore: options.firestore ?? getQuotaFirestore(),
        buckets,
        cost,
        operation,
        dayKey,
        resetAt,
        now,
      });
    } catch (error) {
      if (isStrictFirestoreQuota(env, options)) {
        throw error;
      }

      console.warn(
        'Firestore AI quota unavailable; falling back to in-memory quota.',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return checkAndConsumeMemoryQuota({
    store: options.fallbackStore ?? options.store ?? defaultQuotaStore,
    buckets,
    cost,
    operation,
    resetAt,
  });
}

function checkAndConsumeMemoryQuota({
  store,
  buckets,
  cost,
  operation,
  resetAt,
}) {
  const rejectedBucket = buckets.find((bucket) => {
    const usedCredits = getUsedCredits(store, bucket.key);
    return usedCredits + cost > bucket.limit;
  });

  if (rejectedBucket) {
    const usedCredits = getUsedCredits(store, rejectedBucket.key);

    return createRejectedQuotaResult({
      bucket: rejectedBucket,
      usedCredits,
      cost,
      operation,
      resetAt,
    });
  }

  for (const bucket of buckets) {
    const usedCredits = getUsedCredits(store, bucket.key);
    store.set(bucket.key, usedCredits + cost);
  }

  return createAllowedQuotaResult({
    buckets,
    getUsedCredits: (bucket) => getUsedCredits(store, bucket.key),
  });
}

async function checkAndConsumeFirestoreQuota({
  firestore,
  buckets,
  cost,
  operation,
  dayKey,
  resetAt,
  now,
}) {
  return firestore.runTransaction(async (transaction) => {
    const bucketSnapshots = [];

    for (const bucket of buckets) {
      const documentRef = getQuotaDocumentRef(firestore, bucket.key);
      const snapshot = await transaction.get(documentRef);
      bucketSnapshots.push({
        bucket,
        documentRef,
        usedCredits: getSnapshotUsedCredits(snapshot),
      });
    }

    const rejectedBucket = bucketSnapshots.find(({ bucket, usedCredits }) => (
      usedCredits + cost > bucket.limit
    ));

    if (rejectedBucket) {
      return createRejectedQuotaResult({
        bucket: rejectedBucket.bucket,
        usedCredits: rejectedBucket.usedCredits,
        cost,
        operation,
        resetAt,
      });
    }

    for (const { bucket, documentRef, usedCredits } of bucketSnapshots) {
      transaction.set(documentRef, {
        key: bucket.key,
        dayKey,
        scope: bucket.scope,
        usedCredits: usedCredits + cost,
        limit: bucket.limit,
        resetAt: Timestamp.fromDate(new Date(resetAt)),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: now.getTime(),
      }, { merge: true });
    }

    return createAllowedQuotaResult({
      buckets,
      getUsedCredits: (bucket) => {
        const snapshot = bucketSnapshots.find((value) => value.bucket.key === bucket.key);
        return (snapshot?.usedCredits ?? 0) + cost;
      },
    });
  });
}

function createRejectedQuotaResult({
  bucket,
  usedCredits,
  cost,
  operation,
  resetAt,
}) {
  return {
    allowed: false,
    status: 429,
    payload: {
      error: 'AI_DAILY_LIMIT_REACHED',
      message: 'Daily AI usage limit reached. Please try again tomorrow.',
      operation,
      cost,
      limit: bucket.limit,
      limitScope: bucket.scope,
      remainingCredits: Math.max(bucket.limit - usedCredits, 0),
      resetAt,
    },
  };
}

function createAllowedQuotaResult({
  buckets,
  getUsedCredits,
}) {
  return {
    allowed: true,
    status: 200,
    payload: null,
    remainingCredits: buckets.length
      ? Math.min(
          ...buckets.map((bucket) =>
            Math.max(bucket.limit - getUsedCredits(bucket), 0),
          ),
        )
      : null,
  };
}

function createQuotaBuckets({
  env,
  identity,
  dayKey,
}) {
  const ipLimit = readCreditLimit(env.AI_DAILY_IP_CREDITS, DEFAULT_IP_DAILY_CREDITS);
  const buckets = [
    {
      scope: 'ip',
      limit: ipLimit,
      key: `${dayKey}:ip:${identity.ip}`,
    },
  ];

  if (identity.clientId) {
    buckets.unshift({
      scope: 'client',
      limit: readCreditLimit(env.AI_DAILY_CLIENT_CREDITS, DEFAULT_CLIENT_DAILY_CREDITS),
      key: `${dayKey}:client:${identity.clientId}`,
    });
  }

  return buckets;
}

function shouldUseFirestoreQuota(env, options) {
  if (options.store) {
    return false;
  }

  if (options.firestore) {
    return true;
  }

  const configuredStore = String(env.AI_QUOTA_STORE ?? '').toLowerCase();

  if (configuredStore === 'memory') {
    return false;
  }

  if (configuredStore === 'firestore') {
    return true;
  }

  return Boolean(env.K_SERVICE || env.FUNCTION_TARGET || env.FIREBASE_CONFIG);
}

function isStrictFirestoreQuota(env, options) {
  if (options.strictFirestore === true) {
    return true;
  }

  return ['1', 'true', 'on', 'yes'].includes(String(env.AI_QUOTA_FIRESTORE_STRICT ?? '').toLowerCase());
}

function isMasterTestClient(request, identity, env) {
  if (!identity.clientId) {
    return false;
  }

  const exemptClientIds = parseList(env.AI_QUOTA_EXEMPT_CLIENT_IDS);

  if (!exemptClientIds.has(identity.clientId)) {
    return false;
  }

  const configuredToken = getNonEmptyString(env.AI_QUOTA_MASTER_TEST_TOKEN);
  const requestToken = getNonEmptyString(getHeaderValue(request, MASTER_TEST_TOKEN_HEADER));

  return Boolean(configuredToken && requestToken && configuredToken === requestToken);
}

function parseList(value) {
  return new Set(
    String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function getHeaderValue(request, headerName) {
  const headers = request?.headers ?? {};
  const lowerName = headerName.toLowerCase();
  const directValue = headers[headerName] ?? headers[lowerName];

  if (Array.isArray(directValue)) {
    return directValue[0];
  }

  return typeof directValue === 'string' ? directValue : '';
}

function normalizeClientId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return VALID_CLIENT_ID_PATTERN.test(candidate) ? candidate : null;
}

function getNonEmptyString(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return candidate || null;
}

function normalizeIp(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const firstIp = value.split(',')[0]?.trim();
  return firstIp || null;
}

function getTrustedForwardedIp(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const candidates = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const publicCandidate = [...candidates]
    .reverse()
    .find((candidate) => !isPrivateIp(candidate));

  return publicCandidate ?? candidates[candidates.length - 1] ?? null;
}

function isPrivateIp(value) {
  return (
    value === '::1'
    || value.startsWith('127.')
    || value.startsWith('10.')
    || value.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(value)
    || value.toLowerCase().startsWith('fc')
    || value.toLowerCase().startsWith('fd')
  );
}

function isLimitsEnabled(env) {
  const rawValue = env.AI_USAGE_LIMITS_ENABLED;

  if (rawValue === undefined) {
    return DEFAULT_LIMITS_ENABLED;
  }

  return !['0', 'false', 'off', 'no'].includes(String(rawValue).toLowerCase());
}

function readCreditLimit(value, fallback) {
  const parsedValue = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

function getUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function getNextUtcDayStart(date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  ));
}

function getUsedCredits(store, key) {
  const value = store.get(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getQuotaFirestore() {
  if (getApps().length === 0) {
    initializeApp();
  }

  return getFirestore();
}

function getQuotaDocumentRef(firestore, key) {
  return firestore
    .collection(QUOTA_COLLECTION_NAME)
    .doc(Buffer.from(key, 'utf8').toString('base64url'));
}

function getSnapshotUsedCredits(snapshot) {
  if (!snapshot?.exists) {
    return 0;
  }

  const value = snapshot.get('usedCredits');
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
