// @ts-expect-error This filesystem test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { questionBank } from '../data/questionBank';
import type { LevelQuestionPack, QuestionPackManifest } from '../types/learning';
import {
  isValidLevelQuestionPack,
  isValidQuestionPackManifest,
} from './questionPackValidation';

const questionPacksUrl = new URL('../../../public/question-packs/', import.meta.url);
const expectedManifestPacks = [
  { level: 'A1', path: 'packs/a1.v7.json' },
  { level: 'A2', path: 'packs/a2.v7.json' },
  { level: 'B1', path: 'packs/b1.v7.json' },
  { level: 'B2', path: 'packs/b2.v7.json' },
];
const targetQuestionCount = 160;
const hangulPattern = /[\uAC00-\uD7A3]/;

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, questionPacksUrl), 'utf8')) as T;
}

describe('hosted question packs', () => {
  it('publishes a valid manifest with current bundled level packs', () => {
    const manifest = readJsonFile<QuestionPackManifest>('manifest.json');

    expect(isValidQuestionPackManifest(manifest)).toBe(true);
    expect(manifest.packs.map(({ level, path }) => ({ level, path }))).toEqual(
      expectedManifestPacks,
    );

    manifest.packs.forEach((entry) => {
      const pack = readJsonFile<LevelQuestionPack>(entry.path);
      const bundledQuestions = questionBank.filter((question) => question.level === entry.level);
      const packQuestionsById = new Map(pack.questions.map((question) => [question.id, question]));

      expect(isValidLevelQuestionPack(pack)).toBe(true);
      expect(entry.questionCount).toBe(targetQuestionCount);
      expect(pack.questions).toHaveLength(entry.questionCount);
      bundledQuestions.forEach((question) => {
        expect(packQuestionsById.get(question.id)).toEqual(question);
      });
      expect(pack.questions.length).toBeGreaterThanOrEqual(bundledQuestions.length);
      pack.questions.forEach((question) => {
        expect(question.promptKo).toMatch(hangulPattern);
        expect(question.explanationKo).toMatch(hangulPattern);
        expect(question.weakPointLabel).toMatch(hangulPattern);

        if (question.kind === 'writing') {
          expect(question.evaluationFocusKo).toMatch(hangulPattern);
        }
      });
    });
  });

  it('does not publish the unnatural rain and umbrella sentence', () => {
    const manifest = readJsonFile<QuestionPackManifest>('manifest.json');

    manifest.packs.forEach((entry) => {
      const pack = readJsonFile<LevelQuestionPack>(entry.path);
      const unnaturalQuestions = pack.questions.filter((question) =>
        question.questionText?.includes('I carry an umbrella'),
      );

      expect(unnaturalQuestions).toEqual([]);
    });
  });
});
