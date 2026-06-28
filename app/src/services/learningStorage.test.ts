import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INITIAL_RATE, LEARNING_STORAGE_KEY } from '../constants/learningConfig';
import type { LocalLearningState } from '../types/learning';
import {
  createDefaultLearningState,
  loadLearningState,
  resetLearningState,
  saveLearningState,
} from './learningStorage';

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

const nowIso = '2026-06-08T00:00:00.000Z';
const emptyStats = {
  questionStats: {},
  skillStats: {},
};

const validState: LocalLearningState = {
  currentLevel: 'A2',
  currentRate: 72,
  solvedQuestionCount: 9,
  promotionReady: false,
  recentResults: [
    {
      questionSetId: 'practice-1',
      level: 'A2',
      score: 67,
      rateAfter: 72,
      questionIds: ['q1', 'q2', 'q3'],
      correctQuestionIds: ['q1', 'q2'],
      weakAreas: ['grammar'],
      weakSkillTags: [],
      solvedAt: '2026-06-07T00:00:00.000Z',
    },
  ],
  recentConversationResults: [
    {
      conversationSessionId: 'conversation-1',
      scenarioId: 'a1-cafe-order-001',
      level: 'A1',
      score: 82,
      rateAfter: 78,
      weaknessTags: ['articles'],
      recommendedScenarioIds: ['a1-hotel-checkin-001'],
      solvedAt: '2026-06-07T00:00:30.000Z',
    },
  ],
  ...emptyStats,
  updatedAt: '2026-06-07T00:01:00.000Z',
};

let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(nowIso));
  asyncStorageMock.getItem.mockReset();
  asyncStorageMock.setItem.mockReset();
  asyncStorageMock.setItem.mockResolvedValue(undefined);
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  consoleWarnSpy.mockRestore();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('learningStorage', () => {
  it('creates a default local learning state for a first launch', () => {
    const state = createDefaultLearningState();

    expect(state.currentLevel).toBe('A1');
    expect(state.currentRate).toBe(INITIAL_RATE);
    expect(state.solvedQuestionCount).toBe(0);
    expect(state.promotionReady).toBe(false);
    expect(state.recentResults).toEqual([]);
    expect(state.recentConversationResults).toEqual([]);
    expect(Date.parse(state.updatedAt)).not.toBeNaN();
  });

  it('creates and stores a default state when no saved state exists', async () => {
    asyncStorageMock.getItem.mockResolvedValue(null);

    const state = await loadLearningState();

    expect(state).toEqual({
      currentLevel: 'A1',
      currentRate: INITIAL_RATE,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: nowIso,
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(state),
    );
  });

  it('loads a valid saved state without rewriting it', async () => {
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(validState));

    await expect(loadLearningState()).resolves.toEqual(validState);
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('rejects read failures instead of replacing progress with a default state', async () => {
    asyncStorageMock.getItem.mockRejectedValue(new Error('read unavailable'));

    await expect(loadLearningState()).rejects.toThrow('read unavailable');
    expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('recovers malformed JSON to a default state and stores the recovery', async () => {
    asyncStorageMock.getItem.mockResolvedValue('{bad json');

    const state = await loadLearningState();

    expect(state).toEqual({
      currentLevel: 'A1',
      currentRate: INITIAL_RATE,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: nowIso,
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(state),
    );
  });

  it('keeps load successful when recovery persistence fails', async () => {
    const recoveryFailure = new Error('write unavailable');
    const defaultState = {
      currentLevel: 'A1',
      currentRate: INITIAL_RATE,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: nowIso,
    };
    const migratedState = {
      currentLevel: 'B2',
      currentRate: 72,
      solvedQuestionCount: 4,
      promotionReady: true,
      recentResults: [],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: '2026-06-07T00:01:00.000Z',
    };
    const cases = [
      {
        rawState: null,
        expectedState: defaultState,
      },
      {
        rawState: '{bad json',
        expectedState: defaultState,
      },
      {
        rawState: JSON.stringify({
          currentLevel: 'B2',
          currentRate: '71.5',
          solvedQuestionCount: '4',
          promotionReady: true,
          recentResults: [],
          recentConversationResults: [],
          updatedAt: '2026-06-07T00:01:00.000Z',
        }),
        expectedState: migratedState,
      },
    ];

    for (const testCase of cases) {
      asyncStorageMock.getItem.mockReset();
      asyncStorageMock.setItem.mockReset();
      asyncStorageMock.getItem.mockResolvedValue(testCase.rawState);
      asyncStorageMock.setItem.mockRejectedValue(recoveryFailure);

      await expect(loadLearningState()).resolves.toEqual(testCase.expectedState);
      expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
        LEARNING_STORAGE_KEY,
        JSON.stringify(testCase.expectedState),
      );
    }
  });

  it('normalizes legacy saved state with missing optional fields', async () => {
    const legacyState = {
      currentLevel: 'B1',
      currentRate: '42.4',
      recentResults: [
        {
          questionSetId: 'practice-legacy',
          level: 'A2',
          score: '66.6',
          rateAfter: '42.4',
          questionIds: ['q1', 2, 'q2'],
          weakAreas: ['reading', 'unknown', 'grammar'],
          solvedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-06-07T00:01:00.000Z',
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(legacyState));

    const state = await loadLearningState();

    expect(state).toEqual({
      currentLevel: 'B1',
      currentRate: 42,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [
        {
          questionSetId: 'practice-legacy',
          level: 'A2',
          score: 67,
          rateAfter: 42,
          questionIds: ['q1', 'q2'],
          weakAreas: ['reading', 'grammar'],
          weakSkillTags: [],
          solvedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: '2026-06-07T00:01:00.000Z',
    });
  });

  it('normalizes practice weak skill tags without duplicating invalid values', async () => {
    const stateWithWeakSkillTags = {
      currentLevel: 'A2',
      currentRate: 72,
      solvedQuestionCount: 9,
      promotionReady: false,
      recentResults: [
        {
          questionSetId: 'practice-skill-tags',
          level: 'A2',
          score: 67,
          rateAfter: 72,
          questionIds: ['q1', 'q2', 'q3'],
          correctQuestionIds: ['q1', 'q2'],
          weakAreas: ['grammar'],
          weakSkillTags: ['articles', 'unknown', 'articles', 'verb_tense'],
          solvedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
      recentConversationResults: [],
      updatedAt: '2026-06-07T00:01:00.000Z',
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(stateWithWeakSkillTags));

    const state = await loadLearningState();

    expect(state.recentResults[0]?.weakSkillTags).toEqual(['articles', 'verb_tense']);
  });

  it('normalizes proficiency stats and drops malformed entries', async () => {
    const stateWithStats = {
      ...validState,
      questionStats: {
        q1: {
          attempts: '2',
          correctCount: '1',
          lastScore: '86.6',
          lastPracticedAt: '2026-06-07T00:02:00.000Z',
        },
        q2: {
          attempts: 0,
          correctCount: 0,
          lastScore: 50,
          lastPracticedAt: '2026-06-07T00:02:00.000Z',
        },
        '': {
          attempts: 1,
          correctCount: 1,
          lastScore: 100,
          lastPracticedAt: '2026-06-07T00:02:00.000Z',
        },
      },
      skillStats: {
        articles: {
          attempts: 3,
          correctCount: 5,
          lastScore: 101,
          lastPracticedAt: '2026-06-07T00:03:00.000Z',
        },
        unknown: {
          attempts: 1,
          correctCount: 1,
          lastScore: 100,
          lastPracticedAt: '2026-06-07T00:03:00.000Z',
        },
        verb_tense: {
          attempts: 1,
          correctCount: 0,
          lastScore: 40,
          lastPracticedAt: 'not-a-date',
        },
      },
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(stateWithStats));

    const state = await loadLearningState();

    expect(state.questionStats).toEqual({
      q1: {
        attempts: 2,
        correctCount: 1,
        lastScore: 87,
        lastPracticedAt: '2026-06-07T00:02:00.000Z',
      },
    });
    expect(state.skillStats).toEqual({
      articles: {
        attempts: 3,
        correctCount: 3,
        lastScore: 100,
        lastPracticedAt: '2026-06-07T00:03:00.000Z',
      },
    });
  });

  it('normalizes invalid boundaries for level, rates, counts, booleans, and result fields', async () => {
    const invalidState = {
      currentLevel: 'C1',
      currentRate: '105.6',
      solvedQuestionCount: -3,
      promotionReady: 'yes',
      recentResults: [
        {
          questionSetId: 123,
          level: 'C1',
          score: '-10',
          rateAfter: 120.2,
          questionIds: ['q1', '', null, 'q2'],
          correctQuestionIds: ['q2', false, ''],
          weakAreas: ['grammar', 'speaking', 'conversation'],
          solvedAt: 'not-a-date',
        },
        'not-a-result',
      ],
      recentConversationResults: [
        {
          conversationSessionId: 77,
          scenarioId: 'a1-cafe-order-001',
          level: 'B9',
          score: 101,
          rateAfter: '-5',
          weaknessTags: ['articles', 'unknown', 'articles'],
          recommendedScenarioIds: ['a1-hotel-checkin-001', '', null],
          solvedAt: 'not-a-date',
        },
        'not-a-conversation-result',
      ],
      updatedAt: 'not-a-date',
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(invalidState));

    const state = await loadLearningState();

    expect(state).toEqual({
      currentLevel: 'A1',
      currentRate: 100,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [
        {
          questionSetId: '',
          level: 'A1',
          score: 0,
          rateAfter: 100,
          questionIds: ['q1', 'q2'],
          correctQuestionIds: ['q2'],
          weakAreas: ['grammar', 'conversation'],
          weakSkillTags: [],
          solvedAt: nowIso,
        },
      ],
      recentConversationResults: [
        {
          conversationSessionId: '',
          scenarioId: 'a1-cafe-order-001',
          level: 'A1',
          score: 100,
          rateAfter: 0,
          weaknessTags: ['articles'],
          recommendedScenarioIds: ['a1-hotel-checkin-001'],
          solvedAt: nowIso,
        },
      ],
      ...emptyStats,
      updatedAt: nowIso,
    });
  });

  it('falls back invalid calendar ISO dates for state and recent result timestamps', async () => {
    const invalidCalendarDate = '2026-02-31T00:00:00.000Z';
    const stateWithInvalidDates = {
      currentLevel: 'A2',
      currentRate: 72,
      solvedQuestionCount: 9,
      promotionReady: false,
      recentResults: [
        {
          questionSetId: 'practice-invalid-date',
          level: 'A2',
          score: 67,
          rateAfter: 72,
          questionIds: ['q1', 'q2', 'q3'],
          weakAreas: ['grammar'],
          weakSkillTags: [],
          solvedAt: invalidCalendarDate,
        },
      ],
      updatedAt: invalidCalendarDate,
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(stateWithInvalidDates));

    const state = await loadLearningState();

    expect(state.updatedAt).toBe(nowIso);
    expect(state.recentResults[0]?.solvedAt).toBe(nowIso);
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(state),
    );
  });

  it('rejects when saving fails', async () => {
    const failure = new Error('storage unavailable');
    asyncStorageMock.setItem.mockRejectedValue(failure);

    await expect(saveLearningState(validState)).rejects.toThrow('storage unavailable');
  });

  it('returns the state persisted by save with a refreshed timestamp', async () => {
    const savedState = await saveLearningState(validState);

    expect(savedState).toEqual({
      ...validState,
      updatedAt: nowIso,
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(savedState),
    );
  });

  it('returns the persisted default state when resetting', async () => {
    const toISOStringSpy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2026-06-08T00:00:00.000Z')
      .mockReturnValueOnce('2026-06-08T00:00:01.000Z');

    const state = await resetLearningState();

    expect(state).toEqual({
      currentLevel: 'A1',
      currentRate: INITIAL_RATE,
      solvedQuestionCount: 0,
      promotionReady: false,
      recentResults: [],
      recentConversationResults: [],
      ...emptyStats,
      updatedAt: '2026-06-08T00:00:01.000Z',
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(state),
    );

    toISOStringSpy.mockRestore();
  });

  it('tries to persist a normalized migration when raw saved state changes', async () => {
    const legacyState = {
      currentLevel: 'B2',
      currentRate: '71.5',
      solvedQuestionCount: '4',
      promotionReady: true,
      recentResults: [],
      updatedAt: '2026-06-07T00:01:00.000Z',
    };
    asyncStorageMock.getItem.mockResolvedValue(JSON.stringify(legacyState));

    const state = await loadLearningState();

    expect(state.currentRate).toBe(72);
    expect(state.solvedQuestionCount).toBe(4);
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      LEARNING_STORAGE_KEY,
      JSON.stringify(state),
    );
  });
});
