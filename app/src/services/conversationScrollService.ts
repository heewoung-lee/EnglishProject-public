export type ConversationScrollTarget = {
  scrollToEnd: (options: { animated: boolean }) => void;
};

type ScheduleConversationScrollOptions = {
  animated?: boolean;
  delayMs?: number;
  setTimeoutImpl?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeoutImpl?: (timeoutId: ReturnType<typeof globalThis.setTimeout>) => void;
};

export const CONVERSATION_SCROLL_DELAY_MS = 80;

export function scheduleConversationScrollToEnd(
  getTarget: () => ConversationScrollTarget | null,
  {
    animated = true,
    delayMs = CONVERSATION_SCROLL_DELAY_MS,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
  }: ScheduleConversationScrollOptions = {},
) {
  const timeoutId = setTimeoutImpl(() => {
    getTarget()?.scrollToEnd({ animated });
  }, delayMs);

  return () => {
    clearTimeoutImpl(timeoutId);
  };
}
