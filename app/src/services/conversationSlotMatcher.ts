import type { ConversationSlot, Scenario } from '../types/conversation';

const restaurantRequestPhrases = [
  "i'd like",
  'i would like',
  'i want',
  'i need',
  "i'll have",
  'i will have',
  'can i get',
  'could i get',
  'can i have',
  'could i have',
  'may i get',
  'may i have',
  'please bring',
  'could you bring',
  'would you bring',
  'bring me',
  'order',
];

const restaurantRequestFillerWords = new Set([
  'a',
  'an',
  'and',
  'any',
  'bring',
  'can',
  'could',
  'else',
  'get',
  'have',
  'i',
  "i'd",
  "i'll",
  'like',
  'may',
  'me',
  'more',
  'need',
  'order',
  'please',
  'some',
  'the',
  'want',
  'will',
  'would',
  'you',
]);

export function getRequiredSlots(scenario: Scenario): ConversationSlot[] {
  return Array.isArray(scenario.requiredSlots)
    ? scenario.requiredSlots.filter((slot) => slot.required !== false)
    : [];
}

export function slotMatches(slot: ConversationSlot, text: string, scenario?: Scenario) {
  const normalizedText = text.toLowerCase();

  return slot.matchKeywords.some((keyword) => keywordMatches(keyword, normalizedText)) ||
    restaurantRequestSlotMatches(slot, normalizedText, scenario) ||
    reasonSlotMatches(slot, normalizedText);
}

function restaurantRequestSlotMatches(slot: ConversationSlot, text: string, scenario?: Scenario) {
  if (
    !scenario?.id.includes('restaurant') ||
    (slot.key !== 'requestItem' &&
      slot.label.toLowerCase() !== 'restaurant request')
  ) {
    return false;
  }

  return restaurantRequestPhrases.some((phrase) => {
    const phrasePattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'ig');

    return [...text.matchAll(phrasePattern)].some((match) => {
      const matchEnd = (match.index ?? 0) + match[0].length;
      const sameSentenceTail = text.slice(matchEnd).split(/[.!?]/)[0];

      return hasRestaurantRequestObject(sameSentenceTail);
    });
  });
}

function hasRestaurantRequestObject(requestTail: string) {
  return (requestTail.match(/[a-z][a-z']*/gi) ?? []).some((word) => {
    return word.length >= 3 && !restaurantRequestFillerWords.has(word.toLowerCase());
  });
}

function reasonSlotMatches(slot: ConversationSlot, text: string) {
  const descriptor = `${slot.key} ${slot.label} ${slot.prompt}`.toLowerCase();

  if (!/\breason\b|why do you need/.test(descriptor)) {
    return false;
  }

  return /\b(because|accident|emergency|urgent|appointment|work|school|sick|traffic|busy|late|family|doctor|problem|something came up|something happened|came up)\b/.test(text);
}

function keywordMatches(keyword: string, text: string) {
  const normalizedKeyword = keyword.toLowerCase().trim();

  if (!normalizedKeyword) {
    return false;
  }

  if (normalizedKeyword.includes(' ')) {
    return text.includes(normalizedKeyword);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, 'i').test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
