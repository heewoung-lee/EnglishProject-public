import type { AppMode } from '../types/learning';

const REGULAR_HEADER_TOP_PADDING = 20;
const CONVERSATION_HEADER_TOP_PADDING = 12;

export function getSettingsMenuTopOffset(
  mode: AppMode,
  safeAreaTopPadding: number,
): number {
  const normalizedSafeAreaTopPadding = Math.max(0, safeAreaTopPadding);
  const headerTopPadding = getHeaderTopPadding(mode);

  return normalizedSafeAreaTopPadding + headerTopPadding;
}

function getHeaderTopPadding(mode: AppMode) {
  if (mode === 'conversation') {
    return CONVERSATION_HEADER_TOP_PADDING;
  }

  return REGULAR_HEADER_TOP_PADDING;
}
