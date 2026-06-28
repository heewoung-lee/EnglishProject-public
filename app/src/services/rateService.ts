import {
  LEVEL_ORDER,
  PROMOTION_FAILURE_RATE,
  PROMOTION_PASS_SCORE,
  PROMOTION_RATE_THRESHOLD,
  PROMOTION_SUCCESS_RATE,
} from '../constants/learningConfig';
import type { LearnerLevel } from '../types/learning';

export function clampRate(rate: number): number {
  return Math.max(0, Math.min(100, Math.round(rate)));
}

export function calculateNextRate(currentRate: number, correctCount: number, totalCount: number): number {
  const deltaByCorrectCount: Record<number, number> = {
    0: -4,
    1: 2,
    2: 6,
    3: 10,
  };
  const delta = totalCount === 3 ? deltaByCorrectCount[correctCount] ?? 0 : Math.round((correctCount / totalCount) * 10);

  return clampRate(currentRate + delta);
}

export function calculateNextRateFromConversationScore(currentRate: number, score: number): number {
  if (score >= 85) {
    return clampRate(currentRate + 10);
  }

  if (score >= 70) {
    return clampRate(currentRate + 6);
  }

  if (score >= 50) {
    return clampRate(currentRate + 2);
  }

  return clampRate(currentRate - 4);
}

export function isPromotionReady(rate: number): boolean {
  return rate >= PROMOTION_RATE_THRESHOLD;
}

export function calculateExamScore(correctCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((correctCount / totalCount) * 100);
}

export function getNextLevel(level: LearnerLevel): LearnerLevel | null {
  const currentIndex = LEVEL_ORDER.indexOf(level);
  const nextLevel = LEVEL_ORDER[currentIndex + 1];

  return nextLevel ?? null;
}

export function calculatePromotionResult(
  currentLevel: LearnerLevel,
  score: number,
): { toLevel: LearnerLevel | null; passed: boolean; nextRate: number } {
  const nextLevel = getNextLevel(currentLevel);
  const passed = Boolean(nextLevel) && score >= PROMOTION_PASS_SCORE;

  return {
    passed,
    toLevel: passed ? nextLevel : null,
    nextRate: passed ? PROMOTION_SUCCESS_RATE : PROMOTION_FAILURE_RATE,
  };
}
