// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error This source audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const componentPath = fileURLToPath(new URL('./AppSettingsMenu.tsx', import.meta.url));

function readComponentSource() {
  return existsSync(componentPath) ? readFileSync(componentPath, 'utf8') : '';
}

describe('AppSettingsMenu source', () => {
  it('exposes a gear settings button with reset and exit actions', () => {
    const source = readComponentSource();

    expect(source).toContain('accessibilityLabel="설정"');
    expect(source).toContain('⚙');
    expect(source).toContain('레벨 초기화');
    expect(source).toContain('종료');
  });
});
