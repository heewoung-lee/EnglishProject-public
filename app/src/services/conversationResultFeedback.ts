import type { ConversationMessage, CorrectedExample, SkillTag } from '../types/conversation';

export type ConversationImprovementItem = {
  id: string;
  original: string;
  corrected: string;
  explanationKo: string;
  tags: SkillTag[];
};

export function buildConversationImprovementItems(_input: {
  correctedExamples: CorrectedExample[];
  messages: ConversationMessage[];
}): ConversationImprovementItem[] {
  const seen = new Set<string>();
  const items: ConversationImprovementItem[] = [];
  const pushItem = (item: Omit<ConversationImprovementItem, 'id'>) => {
    const original = item.original.trim();
    const corrected = item.corrected.trim();

    if (!original || !corrected || normalizeSentence(original) === normalizeSentence(corrected)) {
      return;
    }

    const id = `${normalizeSentence(original)}::${normalizeSentence(corrected)}`;

    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    items.push({
      ...item,
      id,
      original,
      corrected,
      tags: item.tags.length > 0 ? item.tags : ['natural_phrasing'],
    });
  };

  _input.correctedExamples.forEach((example) => {
    pushItem({
      original: example.original,
      corrected: example.corrected,
      explanationKo: example.explanationKo,
      tags: example.tags,
    });
  });

  _input.messages
    .filter((message) => message.role === 'user')
    .forEach((message) => {
      const corrected = message.analysis?.correctedSentence;

      if (!corrected) {
        return;
      }

      pushItem({
        original: message.content,
        corrected,
        explanationKo: message.analysis?.shortReasonKo ?? '이렇게 바꾸면 의미가 더 분명하고 자연스럽게 전달됩니다.',
        tags: message.analysis?.detectedIssues ?? ['natural_phrasing'],
      });
    });

  return items.slice(0, 3);
}

function normalizeSentence(sentence: string) {
  return sentence
    .toLowerCase()
    .replace(/['‘’]/g, '’')
    .replace(/[^\p{L}\p{N}’]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
