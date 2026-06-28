import { describe, expect, it, vi } from 'vitest';

import { scheduleConversationScrollToEnd } from './conversationScrollService';

describe('conversationScrollService', () => {
  it('scrolls the latest available scroll target to the end after a short delay', () => {
    const scrollToEnd = vi.fn();
    const target = { scrollToEnd };
    const setTimeoutImpl = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });

    scheduleConversationScrollToEnd(() => target, {
      animated: true,
      setTimeoutImpl,
    });

    expect(setTimeoutImpl).toHaveBeenCalledWith(expect.any(Function), 80);
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it('does not throw when the scroll target is not mounted yet', () => {
    const setTimeoutImpl = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });

    expect(() => {
      scheduleConversationScrollToEnd(() => null, {
        setTimeoutImpl,
      });
    }).not.toThrow();
  });

  it('returns a cleanup function that clears a pending scheduled scroll', () => {
    const clearTimeoutImpl = vi.fn();
    const cancel = scheduleConversationScrollToEnd(() => null, {
      setTimeoutImpl: vi.fn(() => 7),
      clearTimeoutImpl,
    });

    cancel();

    expect(clearTimeoutImpl).toHaveBeenCalledWith(7);
  });
});
