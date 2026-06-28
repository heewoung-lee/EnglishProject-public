import type { LocalLearningState } from '../types/learning';

export async function resetLevelProgress(
  resetLearningState: () => Promise<LocalLearningState>,
): Promise<LocalLearningState> {
  return resetLearningState();
}

export function exitApplication(exitApp: () => void): void {
  exitApp();
}
