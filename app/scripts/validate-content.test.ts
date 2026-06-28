// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { spawnSync } from 'node:child_process';
// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { tmpdir } from 'node:os';
// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { join } from 'node:path';
// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { execPath } from 'node:process';
// @ts-expect-error This CLI test runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./validate-content.mjs', import.meta.url));
const questionManifestPath = fileURLToPath(
  new URL('../../public/question-packs/manifest.json', import.meta.url),
);
const tempRoots: string[] = [];
const explicitEnglishWritingPromptPattern = /^다음 문장을 영어로 쓰세요: [^"\r\n]+$/u;

function runValidator(args: string[] = []) {
  return spawnSync(execPath, [scriptPath, ...args], {
    encoding: 'utf8',
  });
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getCurrentEnglishWritingQuestions() {
  const manifest = readJson(questionManifestPath);
  return manifest.packs.flatMap((entry: { path: string }) => {
    const packPath = fileURLToPath(new URL(`../../public/question-packs/${entry.path}`, import.meta.url));
    const pack = readJson(packPath);

    return pack.questions.filter((question: { kind: string; answerLanguage?: string }) => {
      return question.kind === 'writing' && question.answerLanguage !== 'ko';
    });
  });
}

function createBrokenContentRoot() {
  const root = mkdtempSync(join(tmpdir(), 'english-content-audit-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'public/question-packs/packs'), { recursive: true });
  mkdirSync(join(root, 'public/conversation-scenarios/packs'), { recursive: true });

  writeJson(join(root, 'public/question-packs/manifest.json'), {
    schemaVersion: 1,
    publishedAt: '2026-06-11T00:00:00.000Z',
    packs: [
      {
        level: 'A1',
        version: 1,
        path: 'packs/a1.v1.json',
        questionCount: 2,
      },
      {
        level: 'B1',
        version: 1,
        path: 'packs/b1.v1.json',
        questionCount: 4,
      },
    ],
  });
  writeJson(join(root, 'public/question-packs/packs/a1.v1.json'), {
    schemaVersion: 1,
    level: 'A1',
    version: 1,
    publishedAt: '2026-06-11T00:00:00.000Z',
    questions: [
      {
        id: 'duplicate-question',
        level: 'A1',
        area: 'reading',
        kind: 'choice',
        promptKo: 'Read the sentence.',
        questionText: 'Tom has a red bag.',
        choices: [
          { id: 'a', text: '' },
          { id: 'b', text: 'Tom has a red bag.' },
          { id: 'b', text: 'Tom has a blue bag.' },
        ],
        correctChoiceId: 'b',
        explanationKo: 'No Korean here.',
        weakPointLabel: '',
      },
      {
        id: 'duplicate-question',
        level: 'A1',
        area: 'grammar',
        kind: 'writing',
        promptKo: 'Write one sentence.',
        sampleAnswer: '',
        evaluationFocusKo: 'No Korean here.',
        choices: [],
        correctChoiceId: 'a',
        explanationKo: 'No Korean here.',
        weakPointLabel: 'No Korean here.',
      },
      {
        id: 'romanized-translation-question',
        level: 'A1',
        area: 'reading',
        kind: 'writing',
        promptKo: '영어 문장을 읽고 한글로 번역하세요.',
        questionText: 'The bus arrives at nine.',
        answerLanguage: 'ko',
        timeLimitSeconds: 30,
        readingDifficulty: 'easy',
        sampleAnswer: 'The bus arrives at nine.',
        expectedKeywordsKo: ['bus', 'nine', 'arrive'],
        evaluationFocusKo: '시간과 동작을 정확히 번역하는지 평가합니다.',
        explanationKo: 'arrives는 도착한다는 뜻입니다.',
        weakPointLabel: '기초 번역',
      },
    ],
  });
  writeJson(join(root, 'public/question-packs/packs/b1.v1.json'), {
    schemaVersion: 1,
    level: 'B1',
    version: 1,
    publishedAt: '2026-06-11T00:00:00.000Z',
    questions: Array.from({ length: 4 }, (_, index) => ({
      id: `b1-writing-${index + 1}`,
      level: 'B1',
      area: 'grammar',
      kind: 'writing',
      promptKo: '영어 문장을 쓰세요.',
      sampleAnswer: 'I think this is useful.',
      evaluationFocusKo: '의견 표현과 문장 구성',
      explanationKo: '의견을 영어 문장으로 쓰면 됩니다.',
      weakPointLabel: '문장 구성',
    })),
  });
  writeJson(join(root, 'public/question-packs/packs/a2.v0.json'), {
    stale: true,
  });

  writeJson(join(root, 'public/conversation-scenarios/manifest.json'), {
    schemaVersion: 1,
    publishedAt: '2026-06-11T00:00:00.000Z',
    packs: [
      {
        level: 'A1',
        version: 1,
        path: 'packs/a1.v1.json',
        scenarioCount: 1,
      },
    ],
  });
  writeJson(join(root, 'public/conversation-scenarios/packs/a1.v1.json'), {
    schemaVersion: 1,
    level: 'A1',
    version: 1,
    publishedAt: '2026-06-11T00:00:00.000Z',
    scenarios: [
      {
        id: 'broken-scenario',
        level: 'A1',
        area: 'conversation',
        titleKo: 'No Korean title',
        titleEn: 'Broken Scenario',
        situationKo: 'No Korean situation',
        descriptionKo: 'No Korean description',
        userGoalKo: 'No Korean goal',
        aiRole: 'Clerk',
        userRole: 'Customer',
        difficulty: 'beginner',
        maxUserTurns: 5,
        targetExpressions: ['I need ...'],
        targetSkills: ['task_completion'],
        openingMessage: 'Hello.',
        completionMessage: 'Done.',
        repairPolicy: {
          unclear: 'Please say it again.',
          offTopic: 'Please answer the question.',
          correction: 'Thanks.',
          koreanOnly: '',
        },
        successCriteria: ['Ask for help.'],
        requiredSlots: [
          {
            key: 'destination',
            label: 'destination',
            prompt: 'Where are you going?',
            matchKeywords: ['to'],
            required: 'yes',
          },
          {
            key: 'destination',
            label: 'duplicate destination',
            prompt: 'Where are you going?',
            matchKeywords: ['station'],
          },
        ],
      },
    ],
  });
  writeJson(join(root, 'public/conversation-scenarios/packs/a2.v0.json'), {
    stale: true,
  });

  return root;
}

describe('validate-content CLI', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('summarizes the current published packs as JSON', () => {
    const result = runValidator(['--json']);

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);

    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.totals).toEqual({
      questions: 640,
      scenarios: 32,
    });
    expect(report.questionPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'A1', version: 7, count: 160 }),
        expect.objectContaining({ level: 'B2', version: 7, count: 160 }),
      ]),
    );
    expect(report.conversationPacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'A1', version: 2, count: 8 }),
        expect.objectContaining({ level: 'B2', version: 1, count: 8 }),
      ]),
    );
  });
  it('uses an explicit Korean target sentence for every English writing question', () => {
    const abstractWritingQuestions = getCurrentEnglishWritingQuestions().filter(
      (question: { promptKo: string }) => !explicitEnglishWritingPromptPattern.test(question.promptKo),
    );

    expect(abstractWritingQuestions).toEqual([]);
  });

  it('fails when packs contain duplicate ids, malformed Korean fields, empty choices, and generic slot keywords', () => {
    const root = createBrokenContentRoot();
    const result = runValidator(['--root', root, '--json']);

    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    const errors = report.errors.join('\n');

    expect(report.ok).toBe(false);
    expect(errors).toContain('duplicate question id');
    expect(errors).toContain('stale pack file is not listed in manifest');
    expect(errors).toContain('visible duplicate');
    expect(errors).toContain('choice text is empty');
    expect(errors).toContain('must contain Korean text');
    expect(errors).toContain('generic slot keyword');
    expect(errors).toContain('missing manifest level B2');
    expect(errors).toContain('writing question must not include choices');
    expect(errors).toContain('expectedKeywordsKo[0]: must contain Korean text');
    expect(errors).toContain('English writing prompt must include an explicit Korean target sentence');
    expect(errors).toContain('duplicate required slot key destination');
    expect(errors).toContain('must contain at least 18 questions');
    expect(errors).toContain('must contain at least 4 writing questions');
    expect(errors).toContain('must contain at least 5 promotion-eligible questions');
    expect(errors).toContain('must contain reading, conversation, and grammar questions');
    expect(errors).toContain('repairPolicy.koreanOnly');
    expect(errors).toContain('required must be a boolean');
  });
});
