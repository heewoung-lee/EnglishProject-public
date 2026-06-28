import { describe, expect, it } from 'vitest';

import { skillLabels } from './skillLabels';

describe('skillLabels', () => {
  it('uses learner-facing wording for task completion weaknesses', () => {
    expect(skillLabels.task_completion).toBe('핵심 의미 전달');
    expect(Object.values(skillLabels)).not.toContain('목표 달성');
  });
});
