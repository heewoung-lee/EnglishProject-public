// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./LevelAreaBadge.tsx', import.meta.url)),
  'utf8',
);

describe('LevelAreaBadge source', () => {
  it('shows learner-friendly level names instead of CEFR codes', () => {
    expect(source).toContain("A1: '입문'");
    expect(source).toContain("A2: '초급'");
    expect(source).toContain("B1: '중급'");
    expect(source).toContain("B2: '중상급'");
    expect(source).toContain('{levelDisplayName}</Text>');
    expect(source).not.toContain('{`${level} 단계`}</Text>');
  });

  it('can render Rate as a same-row badge with the level and area badges', () => {
    expect(source).toContain('rate?: number');
    expect(source).toContain('styles.rateBadge');
    expect(source).toContain('Rate {rate}');
  });
});
