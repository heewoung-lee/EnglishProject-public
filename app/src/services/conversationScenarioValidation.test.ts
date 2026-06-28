import { describe, expect, it } from 'vitest';

import {
  CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
} from '../constants/learningConfig';
import { scenarios } from '../data/scenarios';
import type {
  ConversationScenarioPackManifest,
  LevelConversationScenarioPack,
} from '../types/conversation';
import {
  isValidConversationScenario,
  isValidConversationScenarioManifest,
  isValidLevelConversationScenarioPack,
} from './conversationScenarioValidation';

const publishedAt = '2026-06-10T00:00:00.000Z';

describe('conversationScenarioValidation', () => {
  it('accepts a valid bundled scenario', () => {
    expect(isValidConversationScenario(scenarios[0])).toBe(true);
  });

  it('rejects a scenario without required slots', () => {
    expect(isValidConversationScenario({
      ...scenarios[0],
      requiredSlots: [],
    })).toBe(false);
  });

  it('accepts a valid manifest', () => {
    const manifest: ConversationScenarioPackManifest = {
      schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
      publishedAt,
      packs: [
        {
          level: 'A1',
          version: 1,
          path: 'packs/a1.json',
          scenarioCount: 3,
        },
      ],
    };

    expect(isValidConversationScenarioManifest(manifest)).toBe(true);
  });

  it('rejects unsafe manifest paths', () => {
    const unsafePaths = [
      'packs/../a1.json',
      'https://example.com/packs/a1.json',
      'a1.json',
      'packs/a1.txt',
    ];

    for (const path of unsafePaths) {
      expect(isValidConversationScenarioManifest({
        schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
        publishedAt,
        packs: [
          {
            level: 'A1',
            version: 1,
            path,
            scenarioCount: 3,
          },
        ],
      })).toBe(false);
    }
  });

  it('accepts a valid level scenario pack', () => {
    const pack: LevelConversationScenarioPack = {
      schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
      level: 'A1',
      version: 1,
      publishedAt,
      scenarios: scenarios.filter((scenario) => scenario.level === 'A1'),
    };

    expect(isValidLevelConversationScenarioPack(pack)).toBe(true);
  });

  it('rejects duplicate scenario ids within a level pack', () => {
    const a1Scenarios = scenarios.filter((scenario) => scenario.level === 'A1');
    const pack: LevelConversationScenarioPack = {
      schemaVersion: CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION,
      level: 'A1',
      version: 1,
      publishedAt,
      scenarios: [
        a1Scenarios[0],
        { ...a1Scenarios[1], id: a1Scenarios[0].id },
      ],
    };

    expect(isValidLevelConversationScenarioPack(pack)).toBe(false);
  });
});
