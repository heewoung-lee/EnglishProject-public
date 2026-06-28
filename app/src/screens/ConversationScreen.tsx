import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatBubble } from '../components/ChatBubble';
import { LevelAreaBadge } from '../components/LevelAreaBadge';
import { getConversationEngineFailureCount } from '../services/conversationEngine';
import {
  buildConversationTurnMessages,
  createUserMessage,
  getActorResponse,
} from '../services/conversationService';
import { scheduleConversationScrollToEnd } from '../services/conversationScrollService';
import { studyColors, studyRadius, studySpacing } from '../theme/studyDesign';
import type { ConversationEngineState, ConversationMessage, Scenario } from '../types/conversation';

type ConversationScreenProps = {
  scenario: Scenario;
  rate: number;
  messages: ConversationMessage[];
  failureCount: number;
  engineState: ConversationEngineState;
  userTurnCount: number;
  onChangeFailureCount: (count: number) => void;
  onChangeEngineState: (engineState: ConversationEngineState) => void;
  onChangeMessages: (messages: ConversationMessage[]) => void;
  onFinishSession: (
    messages?: ConversationMessage[],
    failureCount?: number,
    engineState?: ConversationEngineState,
  ) => Promise<void>;
  onBack: () => void;
  isEvaluating: boolean;
};

export function ConversationScreen({
  scenario,
  rate,
  messages,
  failureCount,
  engineState,
  userTurnCount,
  onChangeFailureCount,
  onChangeEngineState,
  onChangeMessages,
  onFinishSession,
  onBack,
  isEvaluating,
}: ConversationScreenProps) {
  const [draft, setDraft] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const messageListRef = useRef<ScrollView | null>(null);
  const cancelPendingScrollRef = useRef<() => void>(() => undefined);
  const isBusy = isResponding || isEvaluating;

  const scrollToLatestMessage = useCallback((animated = true) => {
    cancelPendingScrollRef.current();
    cancelPendingScrollRef.current = scheduleConversationScrollToEnd(
      () => messageListRef.current,
      { animated },
    );
  }, []);

  useEffect(() => {
    scrollToLatestMessage(false);
  }, [messages.length, scrollToLatestMessage]);

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollToLatestMessage(true);
    });

    return () => {
      keyboardShowSubscription.remove();
      cancelPendingScrollRef.current();
    };
  }, [scrollToLatestMessage]);

  async function sendMessage() {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || isBusy) {
      return;
    }

    const userMessage = createUserMessage(trimmedDraft);
    setDraft('');
    setIsResponding(true);

    try {
      const actorResponse = await getActorResponse({
        scenario,
        userMessage: trimmedDraft,
        previousMessages: messages,
        failureCount,
        engineState,
      });
      const analyzedUserMessage: ConversationMessage = {
        ...userMessage,
        analysis: actorResponse.userAnalysis,
      };
      const nextMessages = buildConversationTurnMessages({
        previousMessages: messages,
        userMessage: analyzedUserMessage,
        actorResponse,
      });
      const nextFailureCount = getConversationEngineFailureCount(actorResponse.engineState);

      onChangeEngineState(actorResponse.engineState);

      if (actorResponse.shouldEndSession) {
        await onFinishSession(nextMessages, nextFailureCount, actorResponse.engineState);
        return;
      }

      onChangeMessages(nextMessages);
      onChangeFailureCount(nextFailureCount);
    } finally {
      setIsResponding(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.headerShell}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <View style={styles.badgeRow}>
            <LevelAreaBadge level={scenario.level} areaLabel="회화" rate={rate} />
          </View>
          <Text style={styles.title}>{scenario.titleKo}</Text>
        </View>
      </View>

      <View style={styles.goalPanel}>
        <Text style={styles.goalLabel}>목표</Text>
        <Text style={styles.goal}>{scenario.userGoalKo}</Text>
        <Text style={styles.turnText}>{`${userTurnCount} / ${scenario.maxUserTurns}`}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.messages}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToLatestMessage(false)}
        ref={messageListRef}
        style={styles.messageList}
      >
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="회화 답변"
          multiline
          editable={!isBusy}
          onChangeText={setDraft}
          onFocus={() => scrollToLatestMessage(true)}
          placeholder="영어로 답해 보세요."
          placeholderTextColor={studyColors.placeholder}
          style={styles.input}
          textAlignVertical="top"
          value={draft}
        />
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => {
              void onFinishSession();
            }}
            style={[styles.secondaryButton, isBusy ? styles.disabledButton : null]}
          >
            <Text style={styles.secondaryButtonText}>
              {isEvaluating ? '평가 중' : '끝내기'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy || draft.trim().length === 0}
            onPress={() => {
              void sendMessage();
            }}
            style={[
              styles.primaryButton,
              isBusy || draft.trim().length === 0 ? styles.disabledButton : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isResponding ? '응답 중' : '전송'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" transparent visible={isEvaluating}>
        <View style={styles.evaluationOverlay}>
          <View style={styles.evaluationCard}>
            <ActivityIndicator color={studyColors.primary} size="large" />
            <Text style={styles.evaluationTitle}>채점 중...</Text>
            <Text style={styles.evaluationBody}>
              응답을 평가하는 중입니다.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: studyColors.canvas,
    flex: 1,
  },
  headerShell: {
    alignItems: 'center',
    backgroundColor: studyColors.canvas,
    borderBottomColor: studyColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: studySpacing.controlGap,
    paddingHorizontal: studySpacing.screenX,
    paddingVertical: 14,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  backButtonText: {
    color: studyColors.primary,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 31,
  },
  headerText: {
    flex: 1,
    gap: 6,
    paddingRight: 52,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: studyColors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  goalPanel: {
    backgroundColor: studyColors.surface,
    borderBottomColor: studyColors.border,
    borderBottomWidth: 1,
    gap: 5,
    paddingHorizontal: studySpacing.screenX,
    paddingVertical: 12,
  },
  goalLabel: {
    color: studyColors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  goal: {
    color: studyColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  turnText: {
    color: studyColors.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  messages: {
    padding: 16,
    paddingBottom: 24,
  },
  messageList: {
    flex: 1,
  },
  composer: {
    backgroundColor: studyColors.surface,
    borderTopColor: studyColors.border,
    borderTopWidth: 1,
    gap: 10,
    padding: studySpacing.controlGap,
  },
  input: {
    backgroundColor: studyColors.canvas,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    color: studyColors.text,
    fontSize: 16,
    maxHeight: 96,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: studyColors.primary,
    borderRadius: studyRadius.sm,
    minWidth: 86,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: studyColors.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: studyColors.canvas,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: studyColors.textSoft,
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  evaluationOverlay: {
    alignItems: 'center',
    backgroundColor: studyColors.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  evaluationCard: {
    alignItems: 'center',
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
    width: '100%',
  },
  evaluationTitle: {
    color: studyColors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  evaluationBody: {
    color: studyColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
