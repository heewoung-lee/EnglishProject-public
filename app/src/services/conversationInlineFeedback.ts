import type { UserMessageAnalysis } from '../types/conversation';

const blockingIssueTags = new Set(['clarification', 'task_completion']);

export function shouldShowInlineConversationFeedback(analysis?: UserMessageAnalysis) {
  if (!analysis?.shortReasonKo) {
    return false;
  }

  if (!analysis.isUnderstandable || !analysis.isRelevant) {
    return true;
  }

  return analysis.detectedIssues.some((issue) => blockingIssueTags.has(issue));
}
