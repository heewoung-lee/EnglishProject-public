import { StyleSheet, Text, View } from 'react-native';

import { shouldShowInlineConversationFeedback } from '../services/conversationInlineFeedback';
import type { ConversationMessage } from '../types/conversation';

type ChatBubbleProps = {
  message: ConversationMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const shouldShowNote = shouldShowInlineConversationFeedback(message.analysis);

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.content, isUser ? styles.userContent : styles.assistantContent]}>{message.content}</Text>
        {shouldShowNote ? (
          <Text style={[styles.note, isUser ? styles.userNote : styles.assistantNote]}>
            {message.analysis?.shortReasonKo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: 10,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#176b5d',
  },
  assistantBubble: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderWidth: 1,
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
  },
  userContent: {
    color: '#ffffff',
  },
  assistantContent: {
    color: '#232927',
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  userNote: {
    color: '#ffe3d4',
  },
  assistantNote: {
    color: '#8f3f2b',
  },
});
