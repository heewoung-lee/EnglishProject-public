// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourcePath = fileURLToPath(new URL('./feedbackSound.ts', import.meta.url));

describe('feedbackSound source', () => {
  it('maps every result feedback cue to an in-app sound asset', () => {
    const source = readFileSync(sourcePath, 'utf8');

    [
      'set-progress.wav',
      'set-perfect.wav',
      'promotion-ready.wav',
      'promotion-passed.wav',
      'promotion-retry.wav',
    ].forEach((assetName) => {
      expect(source).toContain(assetName);
    });
  });

  it('replays short effects from the beginning and treats sound as optional feedback', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('player.seekTo(0)');
    expect(source).toContain('catch');
  });

  it('does not attempt feedback audio on web browsers', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('tap.wav');
    expect(source).not.toContain('tapPlayer');
    expect(source).toContain("Platform.OS === 'web'");
  });
});
