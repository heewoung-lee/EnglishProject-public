// @ts-expect-error This documentation audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { readFileSync } from 'node:fs';
// @ts-expect-error This documentation audit runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const qaDocPath = new URL('../../docs/qa/android-apk-smoke-test.md', import.meta.url);

function readQaDoc() {
  return readFileSync(fileURLToPath(qaDocPath), 'utf8');
}

describe('Android APK smoke test checklist', () => {
  it('documents the local APK path, install command, and core mobile flows', () => {
    const source = readQaDoc();

    expect(source).toContain('C:\\Users\\woung\\Desktop\\이력서\\app-release.apk');
    expect(source).toContain('$env:USERPROFILE\\Desktop\\이력서\\app-release.apk');
    expect(source).toContain('adb install -r');
    expect(source).toContain('처음 실행');
    expect(source).toContain('영작 키보드');
    expect(source).toContain('회화 키보드');
    expect(source).toContain('채점 중 팝업');
    expect(source).toContain('승급 시험');
    expect(source).toContain('설정 메뉴');
  });

  it('defines pass/fail evidence for repeated APK testing', () => {
    const source = readQaDoc();

    expect(source).toContain('PASS 기준');
    expect(source).toContain('FAIL 기준');
    expect(source).toContain('스크린샷');
    expect(source).toContain('APK SHA256');
    expect(source).toContain('되돌릴 커밋');
  });
});
