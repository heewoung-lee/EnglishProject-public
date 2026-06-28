import { describe, expect, it } from 'vitest';

import { getSettingsMenuTopOffset } from './appSettingsMenuLayout';

describe('appSettingsMenuLayout', () => {
  it('aligns the settings button with regular screen header content', () => {
    expect(getSettingsMenuTopOffset('practiceResult', 24)).toBe(44);
    expect(getSettingsMenuTopOffset('promotionExam', 24)).toBe(44);
  });

  it('aligns the settings button with the regular practice header', () => {
    expect(getSettingsMenuTopOffset('practice', 24)).toBe(44);
  });

  it('aligns the settings button with the tighter conversation header', () => {
    expect(getSettingsMenuTopOffset('conversation', 24)).toBe(36);
  });

  it('does not allow negative safe area padding to move the button upward', () => {
    expect(getSettingsMenuTopOffset('practice', -12)).toBe(20);
  });
});
