import { describe, expect, it } from 'vitest';

import { getStorageErrorCopy } from './storageErrorCopy';

describe('getStorageErrorCopy', () => {
  it('returns Korean retry copy for failed initial loads', () => {
    expect(getStorageErrorCopy('load')).toEqual({
      title: '학습 기록을 불러오지 못했어요',
      description: '저장된 학습 기록을 읽는 중 문제가 생겼습니다. 기기 저장 공간 상태를 확인한 뒤 다시 시도해 주세요.',
      retryButtonLabel: '다시 불러오기',
    });
  });

  it('tells learners their completed practice answers are preserved while retrying save', () => {
    const copy = getStorageErrorCopy('savePracticeResult');

    expect(copy.title).toBe('학습 결과를 저장하지 못했어요');
    expect(copy.description).toBe('답안은 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.');
    expect(copy.retryButtonLabel).toBe('저장 다시 시도');
  });

  it('maps conversation result save failures to conversation-specific copy', () => {
    const copy = getStorageErrorCopy('saveConversationResult');

    expect(copy.title).toBe('회화 결과를 저장하지 못했어요');
    expect(copy.description).toBe('대화와 평가 결과는 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.');
    expect(copy.retryButtonLabel).toBe('저장 다시 시도');
  });

  it('maps promotion result save failures to promotion-specific copy', () => {
    const copy = getStorageErrorCopy('savePromotionResult');

    expect(copy.title).toBe('승급 시험 결과를 저장하지 못했어요');
    expect(copy.description).toBe('시험 답안은 그대로 유지됩니다. 저장이 완료되면 결과 화면으로 이동합니다.');
    expect(copy.retryButtonLabel).toBe('저장 다시 시도');
  });
});
