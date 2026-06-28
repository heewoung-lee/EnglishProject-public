import { describe, expect, it } from 'vitest';

import { getChoiceLabel } from './choiceLabel';

describe('choiceLabel', () => {
  it('uses visible A/B/C labels by choice index', () => {
    expect([0, 1, 2].map(getChoiceLabel)).toEqual(['A', 'B', 'C']);
  });
});
