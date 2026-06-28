import type { PracticeSessionResult, PromotionExamResult } from '../types/learning';

export type FeedbackSoundCue =
  | 'setProgress'
  | 'setPerfect'
  | 'promotionReady'
  | 'promotionPassed'
  | 'promotionRetry';

export type FeedbackTone = 'neutral' | 'review' | 'success' | 'promotion';

export type ResultFeedback = {
  soundCue: FeedbackSoundCue;
  tone: Exclude<FeedbackTone, 'neutral'>;
  heroScaleFrom: number;
  heroFadeDurationMs: number;
  rateCountDurationMs: number;
};

export function getPracticeResultFeedback(result: PracticeSessionResult): ResultFeedback {
  if (result.promotionReady) {
    return createResultFeedback('promotionReady', 'promotion');
  }

  if (result.correctCount === result.totalCount) {
    return createResultFeedback('setPerfect', 'success');
  }

  return createResultFeedback('setProgress', 'review');
}

export function getPromotionResultFeedback(result: PromotionExamResult): ResultFeedback {
  return result.passed
    ? createResultFeedback('promotionPassed', 'promotion')
    : createResultFeedback('promotionRetry', 'review');
}

export function getRevealDelayMs(index: number): number {
  return Math.min(180 + Math.max(index, 0) * 90, 630);
}

function createResultFeedback(
  soundCue: ResultFeedback['soundCue'],
  tone: ResultFeedback['tone'],
): ResultFeedback {
  return {
    soundCue,
    tone,
    heroScaleFrom: tone === 'promotion' ? 0.94 : 0.97,
    heroFadeDurationMs: 360,
    rateCountDurationMs: 700,
  };
}
