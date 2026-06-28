// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readScreenSource(fileName: string) {
  return readFileSync(fileURLToPath(new URL(`./${fileName}`, import.meta.url)), 'utf8');
}

function readComponentSource(fileName: string) {
  return readFileSync(fileURLToPath(new URL(`../components/${fileName}`, import.meta.url)), 'utf8');
}

function stripSourceComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function assertAfter(source: string, earlier: string, later: string) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);

  expect(earlierIndex).toBeGreaterThanOrEqual(0);
  expect(laterIndex).toBeGreaterThan(earlierIndex);
}

describe('approved design direction source guards', () => {
  it('applies the reading translation mockup structure to practice questions', () => {
    const source = stripSourceComments(readScreenSource('PracticeQuestionScreen.tsx'));

    expect(source).toContain("from '../theme/studyDesign'");
    assertAfter(source, 'styles.metaRow', 'styles.readBlock');
    assertAfter(source, 'styles.readBlock', 'styles.answerPanel');
    expect(source).toMatch(/<View style=\{styles\.answerPanel\}>\s*<TextInput/);
  });

  it('keeps the practice Rate badge next to the level and area badges', () => {
    const source = stripSourceComments(readScreenSource('PracticeQuestionScreen.tsx'));
    const badgeRowStart = source.indexOf('style={styles.badgeRow}');
    const titleRowStart = source.indexOf('style={styles.titleRow}');
    const titleRowEnd = source.indexOf('</View>', titleRowStart);

    expect(badgeRowStart).toBeGreaterThanOrEqual(0);
    expect(source.slice(badgeRowStart, titleRowStart)).toContain('rate={rate}');
    expect(source.slice(titleRowStart, titleRowEnd)).not.toContain('styles.ratePill');
  });

  it('keeps practice result feedback in scannable cards with shared design tokens', () => {
    const source = stripSourceComments(readScreenSource('PracticeResultScreen.tsx'));
    const cardSource = stripSourceComments(readComponentSource('QuestionExplanationCard.tsx'));

    expect(source).toContain("from '../theme/studyDesign'");
    expect(source).toContain('QuestionExplanationCard');
    expect(cardSource).toContain("from '../theme/studyDesign'");
    assertAfter(source, 'styles.resultHero', 'styles.section');
    expect(cardSource).toContain('styles.explanationCard');
  });

  it('keeps conversation practice aligned to the same header and input system', () => {
    const source = stripSourceComments(readScreenSource('ConversationScreen.tsx'));

    expect(source).toContain("from '../theme/studyDesign'");
    assertAfter(source, 'style={styles.headerShell}', 'style={styles.goalPanel}');
    expect(source.slice(source.indexOf('style={styles.badgeRow}'), source.indexOf('style={styles.title}'))).toContain('rate={rate}');
    assertAfter(source, 'style={styles.goalPanel}', 'style={styles.messageList}');
    assertAfter(source, '</ScrollView>', 'style={styles.composer}');
  });
});
