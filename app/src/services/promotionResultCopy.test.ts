import { describe, expect, it } from 'vitest';

import { formatPromotionScoreSummary } from './promotionResultCopy';

describe('promotionResultCopy', () => {
  it('formats promotion score as a score and pass threshold, not a fraction', () => {
    const summary = formatPromotionScoreSummary({ score: 100, passScore: 80 });

    expect(summary).toBe('점수 100점 (합격 기준 80점)');
    expect(summary).not.toContain('100 / 80');
  });
});
