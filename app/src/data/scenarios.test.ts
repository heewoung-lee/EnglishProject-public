import { describe, expect, it } from 'vitest';

import { scenarios } from './scenarios';

describe('conversation scenarios', () => {
  it('define data-driven roleplay slots, repair policy, and success criteria', () => {
    for (const scenario of scenarios) {
      expect(scenario.requiredSlots.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.successCriteria.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.completionMessage.trim(), scenario.id).not.toBe('');
      expect(scenario.repairPolicy.unclear.trim(), scenario.id).not.toBe('');
      expect(scenario.repairPolicy.offTopic.trim(), scenario.id).not.toBe('');
      expect(scenario.repairPolicy.correction.trim(), scenario.id).not.toBe('');
      expect(scenario.repairPolicy.koreanOnly.trim(), scenario.id).not.toBe('');

      for (const slot of scenario.requiredSlots) {
        expect(slot.key.trim(), scenario.id).not.toBe('');
        expect(slot.label.trim(), scenario.id).not.toBe('');
        expect(slot.prompt.trim(), scenario.id).not.toBe('');
        expect(slot.matchKeywords.length, `${scenario.id}:${slot.key}`).toBeGreaterThan(0);
      }
    }
  });
});
