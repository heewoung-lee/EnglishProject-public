import { useEffect, useMemo, useState } from 'react';
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

import { formatLevelTransitionLabel } from '../components/LevelAreaBadge';
import { QUESTION_AREA_LABELS } from '../constants/learningConfig';
import { getChoiceLabel } from '../services/choiceLabel';
import {
  getQuestionDisplayParts,
  getWritingAnswerAccessibilityLabel,
  getWritingAnswerPlaceholder,
} from '../services/practiceQuestionPresentation';
import type { ActiveSession, LearnerLevel } from '../types/learning';

type PromotionExamScreenProps = {
  session: ActiveSession;
  fromLevel: LearnerLevel;
  toLevel: LearnerLevel;
  isSubmittingAnswer?: boolean;
  onSubmitAnswer: (answer: string) => void;
};

export function PromotionExamScreen({
  session,
  fromLevel,
  toLevel,
  isSubmittingAnswer = false,
  onSubmitAnswer,
}: PromotionExamScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [writingAnswer, setWritingAnswer] = useState('');
  const question = session.questions[session.currentQuestionIndex];
  const questionDisplay = question ? getQuestionDisplayParts(question) : null;
  const progressText = `문제 ${Math.min(session.currentQuestionIndex + 1, session.questions.length)} / ${session.questions.length}`;
  const isWritingQuestion = question?.kind === 'writing';
  const choices = useMemo(
    () => (question?.kind === 'choice' ? question.choices : []),
    [question],
  );
  const canSubmit = !isSubmittingAnswer && (
    isWritingQuestion ? writingAnswer.trim().length > 0 : Boolean(selectedChoiceId)
  );

  useEffect(() => {
    setSelectedChoiceId(null);
    setWritingAnswer('');
  }, [question?.id]);

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
        style={styles.scroll}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>승급 시험</Text>
            <Text style={styles.title}>{formatLevelTransitionLabel(fromLevel, toLevel)}</Text>
          </View>
          <Text style={styles.examBadge}>TEST</Text>
        </View>

        <Text style={styles.progress}>{progressText}</Text>
        {question ? <Text style={styles.area}>{QUESTION_AREA_LABELS[question.area]}</Text> : null}
        <Text style={styles.prompt}>{questionDisplay?.promptText}</Text>
        {questionDisplay?.sourceText ? (
          <View style={styles.sourceBlock}>
            <Text style={styles.sourceLabel}>{questionDisplay.sourceLabel}</Text>
            <Text style={styles.questionText}>{questionDisplay.sourceText}</Text>
          </View>
        ) : null}

        {isWritingQuestion && question ? (
          <View style={styles.answerPanel}>
            <TextInput
              accessibilityLabel={getWritingAnswerAccessibilityLabel(question)}
              editable={!isSubmittingAnswer}
              multiline
              onChangeText={setWritingAnswer}
              placeholder={getWritingAnswerPlaceholder(question)}
              placeholderTextColor="#90a39d"
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
          <Text style={styles.submitButtonText}>
            {isSubmittingAnswer ? '채점 중...' : '시험 제출'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102a2a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
  },
  footer: {
    backgroundColor: '#102a2a',
    borderTopColor: '#254342',
    borderTopWidth: 1,
    padding: 20,
    paddingTop: 14,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  kicker: {
    color: '#d9b66b',
    fontSize: 15,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  examBadge: {
    color: '#d9b66b',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 48,
  },
  progress: {
    color: '#b9c7c1',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  area: {
    color: '#d9b66b',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  prompt: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginBottom: 16,
  },
  sourceBlock: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
    borderLeftColor: '#d9b66b',
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  sourceLabel: {
    color: '#d9b66b',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  questionText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
  },
  choices: {
    gap: 10,
  },
  choice: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
    borderRadius: 8,
    borderWidth: 2,
    padding: 16,
  },
  selectedChoice: {
    borderColor: '#d9b66b',
  },
  choiceText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  choiceContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  choiceLabel: {
    alignItems: 'center',
    backgroundColor: '#d9b66b',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  choiceLabelText: {
    color: '#102a2a',
    fontSize: 14,
    fontWeight: '900',
  },
  answerPanel: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
    borderRadius: 8,
    borderWidth: 2,
    padding: 4,
  },
  writingInput: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    minHeight: 150,
    padding: 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#d9b66b',
    borderRadius: 8,
    paddingVertical: 15,
  },
  disabledButton: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#102a2a',
    fontSize: 16,
    fontWeight: '900',
  },
});
