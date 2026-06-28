import { describe, expect, it } from 'vitest';

import { PROMOTION_FAILURE_RATE, PROMOTION_SUCCESS_RATE } from '../constants/learningConfig';
import {
  calculateExamScore,
  calculateNextRateFromConversationScore,
  calculateNextRate,
  calculatePromotionResult,
  clampRate,
  getNextLevel,
  isPromotionReady,
} from './rateService';

describe('rateService', () => {
  it('clamps rate to the 0-100 range', () => {
    expect(clampRate(-12)).toBe(0);
    expect(clampRate(113)).toBe(100);
  });

  it('moves the practice rate by the fixed three-question scoring table', () => {
    expect(calculateNextRate(72, 3, 3)).toBe(82);
    expect(calculateNextRate(72, 2, 3)).toBe(78);
    expect(calculateNextRate(72, 1, 3)).toBe(74);
    expect(calculateNextRate(3, 0, 3)).toBe(0);
  });

  it('moves the conversation rate by the conversation score bands', () => {
    expect(calculateNextRateFromConversationScore(72, 86)).toBe(82);
    expect(calculateNextRateFromConversationScore(72, 70)).toBe(78);
    expect(calculateNextRateFromConversationScore(72, 50)).toBe(74);
    expect(calculateNextRateFromConversationScore(3, 49)).toBe(0);
  });

  it('marks a learner promotion-ready at the configured rate threshold', () => {
    expect(isPromotionReady(79)).toBe(false);
    expect(isPromotionReady(80)).toBe(true);
  });

  it('calculates exam score as a rounded percentage', () => {
    expect(calculateExamScore(4, 5)).toBe(80);
    expect(calculateExamScore(0, 0)).toBe(0);
  });

  it('returns the next level until the final level', () => {
    expect(getNextLevel('A1')).toBe('A2');
    expect(getNextLevel('B2')).toBeNull();
  });

  it('creates pass and fail promotion outcomes', () => {
    expect(calculatePromotionResult('A1', 80)).toEqual({
      passed: true,
      toLevel: 'A2',
      nextRate: PROMOTION_SUCCESS_RATE,
    });
    expect(calculatePromotionResult('A1', 60)).toEqual({
      passed: false,
      toLevel: null,
      nextRate: PROMOTION_FAILURE_RATE,
    });
  });
});
