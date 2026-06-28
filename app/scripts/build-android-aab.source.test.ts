// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error This source guard runs in Vitest's Node runtime, but the app tsconfig omits Node types.
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./build-android-aab.ps1', import.meta.url));
const source = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8') : '';

describe('build-android-aab script', () => {
  it('builds a Play Store app bundle and publishes it to the local release folder', () => {
    expect(source).toContain('bundleRelease');
    expect(source).toContain('app-release.aab');
    expect(source).toContain('Desktop');
    expect(source).toContain('$resumeFolderName');
  });

  it('uses a release upload keystore instead of the debug signing config', () => {
    expect(source).toContain('level-fit-upload.jks');
    expect(source).toContain('level-fit-upload-keystore.properties');
    expect(source).toContain('signingConfigs.releaseUpload');
    expect(source).not.toContain('signingConfig signingConfigs.debug');
  });

  it('repairs a stale upload keystore path without regenerating the key', () => {
    expect(source).toContain('Write-KeystoreProperties');
    expect(source).toContain('[System.IO.File]::ReadAllLines');
    expect(source).toContain('[System.Text.Encoding]::UTF8');
    expect(source).toContain('Upload keystore properties storeFile repaired');
    expect(source).toContain('Do not regenerate silently after Play upload');
  });

  it('keeps PKCS12 upload key and store passwords aligned for Gradle signing', () => {
    expect(source).toContain('$keyPassword = $storePassword');
    expect(source).toContain('keyPassword aligned with storePassword');
  });
});
