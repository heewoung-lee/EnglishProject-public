// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readScreenSource(fileName: string) {
  return readFileSync(fileURLToPath(new URL(`./${fileName}`, import.meta.url)), 'utf8');
}

function stripSourceComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function assertAfter(source: string, earlier: string, later: string) {
  expect(source.indexOf(earlier)).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(later)).toBeGreaterThan(source.indexOf(earlier));
}

function assertAfterLast(source: string, earlier: string, later: string) {
  expect(source.lastIndexOf(earlier)).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(later)).toBeGreaterThan(source.lastIndexOf(earlier));
}

function assertFooterAfterLastScrollContainsSubmit(source: string) {
  assertAfterLast(source, '</ScrollView>', 'style={styles.footer}');
  const footerSource = source.slice(source.indexOf('style={styles.footer}'));
  expect(footerSource).toMatch(/<Pressable[\s\S]*?style=\{\[\s*styles\.submitButton/);
}

describe('mobile QA source guardrails', () => {
  it('keeps the practice submit footer outside the scrollable question body and keyboard aware', () => {
    const source = stripSourceComments(readScreenSource('PracticeQuestionScreen.tsx'));

    expect(source).toContain('<KeyboardAvoidingView');
    expect(source).toMatch(/behavior=\{Platform\.OS\s*===\s*'ios'\s*\?\s*'padding'\s*:\s*'height'\}/);
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain('keyboardDismissMode="interactive"');
    expect(source).toContain('textAlignVertical="top"');
    expect(source).toContain('style={styles.footer}');
    assertFooterAfterLastScrollContainsSubmit(source);
  });

  it('keeps conversation input visible, scrolls to the latest message, and blocks actions during evaluation', () => {
    const source = stripSourceComments(readScreenSource('ConversationScreen.tsx'));

    expect(source).toContain('<KeyboardAvoidingView');
    expect(source).toMatch(/behavior=\{Platform\.OS\s*===\s*'ios'\s*\?\s*'padding'\s*:\s*'height'\}/);
    expect(source).toContain("Keyboard.addListener('keyboardDidShow'");
    expect(source).toContain('onFocus={() => scrollToLatestMessage(true)}');
    expect(source).toContain('onContentSizeChange={() => scrollToLatestMessage(false)}');
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain('visible={isEvaluating}');
    expect(source).toContain('const isBusy = isResponding || isEvaluating');
    expect(source).toContain('disabled={isBusy || draft.trim().length === 0}');
    assertAfter(source, '</ScrollView>', 'style={styles.composer}');
  });

  it('keeps promotion exam submission fixed outside the scrollable questions', () => {
    const source = stripSourceComments(readScreenSource('PromotionExamScreen.tsx'));

    expect(source).toContain('<KeyboardAvoidingView');
    expect(source).toContain('<TextInput');
    expect(source).toContain("question?.kind === 'writing'");
    expect(source).toContain('getWritingAnswerPlaceholder(question)');
    expect(source).toContain('isSubmittingAnswer');
    expect(source).toContain('채점 중...');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('style={styles.footer}');
    assertFooterAfterLastScrollContainsSubmit(source);
  });
});
