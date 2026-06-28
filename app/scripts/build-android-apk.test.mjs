import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptSource = readFileSync(join(scriptDir, 'build-android-apk.ps1'), 'utf8');

describe('build-android-apk.ps1', () => {
  it('builds master test APKs with a separate Android package id', () => {
    expect(scriptSource).toContain('$masterTestApplicationId = "com.heewounglee.englishproject.master"');
    expect(scriptSource).toContain('$masterTestAppName = "EnglishProject Master"');
    expect(scriptSource).toContain('Set-AndroidBuildIdentity');
    expect(scriptSource).toContain('Restore-AndroidBuildIdentity');
    expect(scriptSource).toContain('Write-TextFileWithoutBom');
    expect(scriptSource).toContain('New-Object System.Text.UTF8Encoding($false)');
  });
});
