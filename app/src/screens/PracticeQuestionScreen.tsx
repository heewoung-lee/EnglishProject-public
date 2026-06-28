import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LevelAreaBadge } from '../components/LevelAreaBadge';
import { QUESTION_AREA_LABELS } from '../constants/learningConfig';
import { getChoiceLabel } from '../services/choiceLabel';
import {
  formatTimeLimitLabel,
  getQuestionDisplayParts,
  getWritingAnswerAccessibilityLabel,
  getWritingAnswerPlaceholder,
  isKoreanTranslationQuestion,
  isTimedTranslationExpired,
  shouldAutoSubmitTimedTranslation,
} from '../services/practiceQuestionPresentation';
import { studyColors, studyRadius, studySpacing } from '../theme/studyDesign';
import type { ActiveSession, LearnerLevel } from '../types/learning';

type PracticeQuestionScreenProps = {
  level: LearnerLevel;
  rate: number;
  session: ActiveSession;
  isSubmittingAnswer?: boolean;
  onSubmitAnswer: (answer: string) => void;
};

export function PracticeQuestionScreen({
  level,
  rate,
  session,
  isSubmittingAnswer = false,
  onSubmitAnswer,
}: PracticeQuestionScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [writingAnswer, setWritingAnswer] = useState('');
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState<number | null>(null);
  const timeoutSubmittedQuestionIdRef = useRef<string | null>(null);
  const question = session.questions[session.currentQuestionIndex];
  const progressText = `${Math.min(session.currentQuestionIndex + 1, session.questions.length)} / ${session.questions.length}`;
  const isWritingQuestion = question?.kind === 'writing';
  const isTranslationQuestion = isKoreanTranslationQuestion(question);
  const hasTimedTranslationExpired = isTimedTranslationExpired(question, remainingTimeSeconds);
  const canSubmit = !isSubmittingAnswer && (
    isWritingQuestion
      ? writingAnswer.trim().length > 0 && !hasTimedTranslationExpired
      : Boolean(selectedChoiceId)
  );
  const choices = useMemo(
    () => (question?.kind === 'choice' ? question.choices : []),
    [question],
  );

  useEffect(() => {
    setSelectedChoiceId(null);
    setWritingAnswer('');
    setRemainingTimeSeconds(
      isKoreanTranslationQuestion(question) ? question.timeLimitSeconds ?? null : null,
    );
  }, [question]);

  useEffect(() => {
    if (!isTranslationQuestion || remainingTimeSeconds === null || remainingTimeSeconds <= 0) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      setRemainingTimeSeconds((currentValue) => {
        if (currentValue === null || currentValue <= 0) {
          return currentValue;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => clearTimeout(timerId);
  }, [isTranslationQuestion, remainingTimeSeconds]);

  useEffect(() => {
    if (!shouldAutoSubmitTimedTranslation({
      isSubmittingAnswer,
      question,
      remainingTimeSeconds,
      submittedQuestionId: timeoutSubmittedQuestionIdRef.current,
    })) {
      return;
    }

    timeoutSubmittedQuestionIdRef.current = question?.id ?? null;
    onSubmitAnswer(writingAnswer.trim());
  }, [isSubmittingAnswer, onSubmitAnswer, question, remainingTimeSeconds, writingAnswer]);

  if (!question) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>문제</Text>
      </ScrollView>
    );
  }

  const questionDisplay = getQuestionDisplayParts(question);

  function submitSelectedAnswer() {
    if (!canSubmit) {
      return;
    }

    if (isWritingQuestion) {
      onSubmitAnswer(writingAnswer.trim());
      return;
    }

    if (selectedChoiceId) {
      onSubmitAnswer(selectedChoiceId);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
      >
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <LevelAreaBadge level={level} areaLabel={QUESTION_AREA_LABELS[question.area]} rate={rate} />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>문제</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.progress}>{progressText}</Text>
          {isTranslationQuestion && remainingTimeSeconds !== null ? (
            <View style={[
              styles.timerPill,
              remainingTimeSeconds <= 10 ? styles.timerPillUrgent : null,
            ]}>
              <Text style={[
                styles.timerText,
                remainingTimeSeconds <= 10 ? styles.timerTextUrgent : null,
              ]}>
                {formatTimeLimitLabel(remainingTimeSeconds)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.prompt}>{questionDisplay.promptText}</Text>
        {questionDisplay.sourceText ? (
          <View style={styles.readBlock}>
            <Text style={styles.sourceLabel}>{questionDisplay.sourceLabel}</Text>
            <Text style={styles.questionText}>{questionDisplay.sourceText}</Text>
          </View>
        ) : null}

        {isWritingQuestion ? (
          <View style={styles.answerPanel}>
            <TextInput
              accessibilityLabel={getWritingAnswerAccessibilityLabel(question)}
              editable={!hasTimedTranslationExpired && !isSubmittingAnswer}
              multiline
              onChangeText={setWritingAnswer}
              placeholder={getWritingAnswerPlaceholder(question)}
              placeholderTextColor={studyColors.placeholder}
              style={styles.writingInput}
              textAlignVertical="top"
              value={writingAnswer}
            />
          </View>
        ) : (
          <View
            accessibilityLabel="답안 선택지"
            accessibilityRole="radiogroup"
            style={styles.choices}
          >
            {choices.map((choice, index) => (
              <Pressable
                key={choice.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedChoiceId === choice.id }}
                aria-checked={selectedChoiceId === choice.id}
                onPress={() => setSelectedChoiceId(choice.id)}
                style={[
                  styles.choice,
                  selectedChoiceId === choice.id ? styles.selectedChoice : null,
                ]}
              >
                <View style={styles.choiceContent}>
                  <View style={styles.choiceLabel}>
                    <Text style={styles.choiceLabelText}>{getChoiceLabel(index)}</Text>
                  </View>
                  <Text style={styles.choiceText}>{choice.text}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={submitSelectedAnswer}
          style={[styles.submitButton, !canSubmit ? styles.disabledButton : null]}
        >
          <Text style={styles.submitButtonText}>{isSubmittingAnswer ? '채점 중...' : '제출'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: studyColors.canvas,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: studySpacing.screenX,
    paddingTop: studySpacing.screenTop,
    paddingBottom: 12,
  },
  header: {
    marginBottom: 30,
    position: 'relative',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 52,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  title: {
    color: studyColors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progress: {
    color: studyColors.mutedText,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  timerPill: {
    alignSelf: 'flex-start',
    backgroundColor: studyColors.primarySoft,
    borderRadius: studyRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timerPillUrgent: {
    backgroundColor: studyColors.accentSoft,
  },
  timerText: {
    color: studyColors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  timerTextUrgent: {
    color: studyColors.dangerText,
  },
  prompt: {
    color: studyColors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 16,
  },
  readBlock: {
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderLeftColor: studyColors.primary,
    borderLeftWidth: 4,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  sourceLabel: {
    color: studyColors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  questionText: {
    color: studyColors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
  },
  choices: {
    gap: 10,
  },
  choice: {
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 2,
    padding: 16,
  },
  selectedChoice: {
    borderColor: studyColors.primary,
  },
  choiceText: {
    color: studyColors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  choiceContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  choiceLabel: {
    alignItems: 'center',
    backgroundColor: studyColors.primarySoft,
    borderRadius: studyRadius.sm,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  choiceLabelText: {
    color: studyColors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  answerPanel: {
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    padding: 4,
  },
  writingInput: {
    backgroundColor: studyColors.surface,
    borderWidth: 0,
    color: studyColors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    minHeight: 150,
    padding: 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: studyColors.primary,
    borderRadius: studyRadius.sm,
    paddingVertical: 15,
  },
  footer: {
    backgroundColor: studyColors.canvas,
    borderTopColor: studyColors.border,
    borderTopWidth: 1,
    padding: 20,
    paddingTop: 12,
  },
  disabledButton: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: studyColors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
});
