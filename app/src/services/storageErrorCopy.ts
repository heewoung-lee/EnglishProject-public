import type { StorageErrorOperation } from '../types/learning';

export type StorageErrorCopy = {
  title: string;
  description: string;
  retryButtonLabel: string;
};

const STORAGE_ERROR_COPY: Record<StorageErrorOperation, StorageErrorCopy> = {
  load: {
    title: '학습 기록을 불러오지 못했어요',
    description: '저장된 학습 기록을 읽는 중 문제가 생겼습니다. 기기 저장 공간 상태를 확인한 뒤 다시 시도해 주세요.',
    retryButtonLabel: '다시 불러오기',
  },
  savePracticeResult: {
    title: '학습 결과를 저장하지 못했어요',
    description: '답안은 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.',
    retryButtonLabel: '저장 다시 시도',
  },
  saveConversationResult: {
    title: '회화 결과를 저장하지 못했어요',
    description: '대화와 평가 결과는 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.',
    retryButtonLabel: '저장 다시 시도',
  },
  savePromotionResult: {
    title: '승급 시험 결과를 저장하지 못했어요',
    description: '시험 답안은 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.',
    retryButtonLabel: '저장 다시 시도',
  },
};

export function getStorageErrorCopy(operation: StorageErrorOperation): StorageErrorCopy {
  return STORAGE_ERROR_COPY[operation];
}
