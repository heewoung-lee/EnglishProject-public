// @ts-expect-error This filesystem test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { scenarios } from '../data/scenarios';
import type {
  ConversationScenarioPackManifest,
  LevelConversationScenarioPack,
} from '../types/conversation';
import {
  isValidConversationScenarioManifest,
  isValidLevelConversationScenarioPack,
} from './conversationScenarioValidation';
import { createInitialConversationEngineState } from './conversationEngine';
import { getMockActorResponse } from './conversationService';

const scenarioPacksUrl = new URL('../../../public/conversation-scenarios/', import.meta.url);
const expectedManifestPacks = [
  { level: 'A1', version: 2, path: 'packs/a1.v2.json', scenarioCount: 8 },
  { level: 'A2', version: 2, path: 'packs/a2.v2.json', scenarioCount: 8 },
  { level: 'B1', version: 1, path: 'packs/b1.v1.json', scenarioCount: 8 },
  { level: 'B2', version: 1, path: 'packs/b2.v1.json', scenarioCount: 8 },
];
const hangulPattern = /[\uAC00-\uD7A3]/;
const overlyGenericSlotKeywords = new Set([
  'pay',
  'to',
  'issue',
  'problem',
  'delay',
  'because',
  'however',
  'sorry',
  "sorry i can't",
  "i can't",
  'i cannot',
  'reduced',
  'increased',
  'neutral',
  'facts',
  'role',
]);

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, scenarioPacksUrl), 'utf8')) as T;
}

describe('hosted conversation scenarios', () => {
  it('publishes a valid manifest with current bundled scenario packs', () => {
    const manifest = readJsonFile<ConversationScenarioPackManifest>('manifest.json');

    expect(isValidConversationScenarioManifest(manifest)).toBe(true);
    expect(
      manifest.packs.map(({ level, version, path, scenarioCount }) => ({
        level,
        version,
        path,
        scenarioCount,
      })),
    ).toEqual(expectedManifestPacks);

    for (const entry of manifest.packs) {
      const pack = readJsonFile<LevelConversationScenarioPack>(entry.path);
      const bundledScenarios = scenarios.filter((scenario) => scenario.level === entry.level);

      expect(isValidLevelConversationScenarioPack(pack)).toBe(true);
      expect(pack.scenarios).toHaveLength(entry.scenarioCount);
      expect(pack.scenarios.slice(0, bundledScenarios.length)).toEqual(bundledScenarios);
      expect(pack.scenarios.length).toBeGreaterThan(bundledScenarios.length);
      pack.scenarios.slice(bundledScenarios.length).forEach((scenario) => {
        expect(scenario.titleKo).toMatch(hangulPattern);
        expect(scenario.situationKo).toMatch(hangulPattern);
        expect(scenario.descriptionKo).toMatch(hangulPattern);
        expect(scenario.userGoalKo).toMatch(hangulPattern);
      });
    }
  });

  it('keeps new scenario slots specific enough to avoid obvious false completion loops', () => {
    const a1Pack = readJsonFile<LevelConversationScenarioPack>('packs/a1.v2.json');
    const a2Pack = readJsonFile<LevelConversationScenarioPack>('packs/a2.v2.json');
    const convenienceStore = a1Pack.scenarios.find((scenario) => {
      return scenario.id === 'a1-convenience-store-001';
    });
    const busTicket = a1Pack.scenarios.find((scenario) => {
      return scenario.id === 'a1-bus-ticket-001';
    });
    const taxi = a2Pack.scenarios.find((scenario) => {
      return scenario.id === 'a2-taxi-destination-001';
    });
    const restaurantReservation = a2Pack.scenarios.find((scenario) => {
      return scenario.id === 'a2-restaurant-reservation-001';
    });

    expect(convenienceStore?.requiredSlots.find((slot) => slot.key === 'payment')?.matchKeywords).not.toContain('pay');
    expect(busTicket?.requiredSlots.find((slot) => slot.key === 'destination')?.matchKeywords).not.toContain('to');
    expect(taxi?.requiredSlots.find((slot) => slot.key === 'route')?.matchKeywords).toEqual(
      expect.arrayContaining(['no preference', 'any route']),
    );
    expect(restaurantReservation?.requiredSlots.map((slot) => slot.key)).toEqual(
      expect.arrayContaining(['partySize', 'reservationTime']),
    );

    for (const entry of expectedManifestPacks) {
      const pack = readJsonFile<LevelConversationScenarioPack>(entry.path);

      for (const scenario of pack.scenarios) {
        for (const slot of scenario.requiredSlots) {
          const normalizedKeywords = slot.matchKeywords.map((keyword) => {
            return keyword.trim().toLowerCase();
          });

          for (const keyword of overlyGenericSlotKeywords) {
            expect(normalizedKeywords).not.toContain(keyword);
          }
        }
      }
    }
  });

  it('uses natural retry examples for every hosted scenario slot', () => {
    for (const entry of expectedManifestPacks) {
      const pack = readJsonFile<LevelConversationScenarioPack>(entry.path);

      for (const scenario of pack.scenarios) {
        for (const slot of scenario.requiredSlots) {
          const response = getMockActorResponse({
            scenario,
            userMessage: 'I need help.',
            previousMessages: [],
            failureCount: 0,
            engineState: {
              ...createInitialConversationEngineState(scenario),
              filledSlotKeys: scenario.requiredSlots
                .filter((candidate) => candidate.key !== slot.key)
                .map((candidate) => candidate.key),
              pendingSlotKey: slot.key,
              repeatedPromptCount: 1,
              noProgressCount: 1,
              userTurnCount: 1,
            },
          });
          const context = `${scenario.id}:${slot.key}`;

          expect(response.message.content, context).not.toMatch(/"I need /);
          expect(response.message.content, context).not.toMatch(/\b(undefined|null)\b/i);
        }
      }
    }
  });

  it('completes the pharmacy scenario when learners ask for medicine after symptoms', () => {
    const a2Pack = readJsonFile<LevelConversationScenarioPack>('packs/a2.v2.json');
    const pharmacy = a2Pack.scenarios.find((scenario) => {
      return scenario.id === 'a2-pharmacy-symptom-001';
    });

    if (!pharmacy) {
      throw new Error('Pharmacy scenario is missing.');
    }

    const response = getMockActorResponse({
      scenario: pharmacy,
      userMessage: 'Do you have any medicine for stomachache?',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: pharmacy.openingMessage,
          createdAt: '2026-06-10T00:00:00.000Z',
        },
        {
          id: 'user-1',
          role: 'user',
          content: "I'm feeling stomachache.",
          createdAt: '2026-06-10T00:00:01.000Z',
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: 'Do you have any questions about the medicine?',
          createdAt: '2026-06-10T00:00:02.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('goal_completed');
    expect(response.message.content).toBe(pharmacy.completionMessage);
  });

  it('completes a B1 workplace scenario when all required details are provided', () => {
    const b1Pack = readJsonFile<LevelConversationScenarioPack>('packs/b1.v1.json');
    const workplaceUpdate = b1Pack.scenarios.find((scenario) => {
      return scenario.id === 'b1-workplace-update-001';
    });

    if (!workplaceUpdate) {
      throw new Error('B1 workplace update scenario is missing.');
    }

    const response = getMockActorResponse({
      scenario: workplaceUpdate,
      userMessage:
        'I am almost finished, but there is a client feedback delay. I expect to finish it by Friday.',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: workplaceUpdate.openingMessage,
          createdAt: '2026-06-11T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('goal_completed');
    expect(response.message.content).toBe(workplaceUpdate.completionMessage);
  });

  it('completes a B2 scope negotiation scenario when all required tradeoffs are provided', () => {
    const b2Pack = readJsonFile<LevelConversationScenarioPack>('packs/b2.v1.json');
    const scopeNegotiation = b2Pack.scenarios.find((scenario) => {
      return scenario.id === 'b2-project-scope-negotiation-001';
    });

    if (!scopeNegotiation) {
      throw new Error('B2 project scope negotiation scenario is missing.');
    }

    const response = getMockActorResponse({
      scenario: scopeNegotiation,
      userMessage:
        'I understand you want the reporting dashboard and advanced export. That would affect the timeline, so could we prioritize the must-have feature and move the rest to phase two?',
      previousMessages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: scopeNegotiation.openingMessage,
          createdAt: '2026-06-11T00:00:00.000Z',
        },
      ],
      failureCount: 0,
    });

    expect(response.shouldEndSession).toBe(true);
    expect(response.endReason).toBe('goal_completed');
    expect(response.message.content).toBe(scopeNegotiation.completionMessage);
  });
});
