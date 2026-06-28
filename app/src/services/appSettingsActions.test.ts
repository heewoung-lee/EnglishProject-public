import { describe, expect, it, vi } from 'vitest';

import { exitApplication, resetLevelProgress } from './appSettingsActions';
import type { LocalLearningState } from '../types/learning';

const defaultState: LocalLearningState = {
  currentLevel: 'A1',
  currentRate: 0,
  solvedQuestionCount: 0,
  promotionReady: false,
  recentResults: [],
  recentConversationResults: [],
  questionStats: {},
  skillStats: {},
  updatedAt: '2026-06-11T00:00:00.000Z',
};

describe('appSettingsActions', () => {
  it('resets level progress through the provided storage reset function', async () => {
    const resetLearningState = vi.fn().mockResolvedValue(defaultState);

    await expect(resetLevelProgress(resetLearningState)).resolves.toEqual(defaultState);
    expect(resetLearningState).toHaveBeenCalledTimes(1);
  });

  it('exits the app through the provided native exit function', () => {
    const exitApp = vi.fn();

    exitApplication(exitApp);

    expect(exitApp).toHaveBeenCalledTimes(1);
  });
});
