export function getAndroidSafeAreaTopPadding(
  platform: string,
  statusBarHeight?: number | null,
) {
  if (platform !== 'android') {
    return 0;
  }

  return Math.max(0, Math.round(statusBarHeight ?? 0));
}
