import { describe, expect, it } from 'vitest';

import { studyColors, studyRadius, studySpacing } from './studyDesign';

describe('studyDesign', () => {
  it('defines the approved study app color system', () => {
    expect(studyColors.canvas).toBe('#f6f8f5');
    expect(studyColors.primary).toBe('#176b5d');
    expect(studyColors.accent).toBe('#d86f49');
    expect(studyColors.surface).toBe('#ffffff');
  });

  it('keeps mobile spacing and radius restrained', () => {
    expect(studySpacing.screenX).toBe(22);
    expect(studySpacing.controlGap).toBe(12);
    expect(studyRadius.sm).toBe(8);
  });
});
