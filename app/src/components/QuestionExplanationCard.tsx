import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { skillLabels } from '../data/skillLabels';
import { getRevealDelayMs } from '../services/feedbackMotion';
import { studyColors, studyRadius } from '../theme/studyDesign';
import type { QuestionExplanation } from '../types/learning';

type QuestionExplanationCardProps = {
  item: QuestionExplanation;
  index: number;
};

export function QuestionExplanationCard({ item, index }: QuestionExplanationCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const writingScoreLabel = item.area === 'reading' ? '독해 점수' : '영작 점수';

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(10);

    Animated.parallel([
      Animated.timing(opacity, {
        delay: getRevealDelayMs(index),
        duration: 240,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        delay: getRevealDelayMs(index),
        duration: 240,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, item.questionId, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.explanationCard,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.explanationPrompt}>{item.promptKo}</Text>
      {item.questionText ? (
        <Text style={styles.questionTextLine}>{`지문: ${item.questionText}`}</Text>
      ) : null}
      <Text style={item.isCorrect ? styles.correctLine : styles.incorrectLine}>
        {item.isCorrect ? '정답' : '오답'}
      </Text>

      {item.kind === 'writing' ? (
        <>
          <Text style={styles.selectedLine}>{`내 답안: ${item.writingAnswer ?? ''}`}</Text>
          <Text style={styles.explanationLine}>{`교정 답안: ${item.correctedAnswer ?? item.sampleAnswer ?? ''}`}</Text>
          <Text style={styles.explanationBody}>{item.writingFeedbackKo ?? item.explanationKo}</Text>
          {typeof item.writingScore === 'number' ? (
            <Text style={styles.scoreLine}>{`${writingScoreLabel}: ${item.writingScore}`}</Text>
          ) : null}
          {item.writingRubric ? (
            <View style={styles.rubricGrid}>
              <RubricLine label="과제" score={item.writingRubric.taskCompletion} max={35} />
              <RubricLine label="의미" score={item.writingRubric.meaning} max={30} />
              <RubricLine label="문법" score={item.writingRubric.grammar} max={20} />
              <RubricLine label="자연스러움" score={item.writingRubric.naturalness} max={15} />
            </View>
          ) : null}
          {item.writingScoreReasonsKo?.length ? (
            <View style={styles.reasonList}>
              {item.writingScoreReasonsKo.map((reason) => (
                <Text key={reason} style={styles.reasonText}>{`- ${reason}`}</Text>
              ))}
            </View>
          ) : null}
          {item.writingSkillTags?.length ? (
            <Text style={styles.skillTagText}>
              {`세부 약점: ${item.writingSkillTags.map((tag) => skillLabels[tag]).join(', ')}`}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.explanationLine}>{`정답: ${item.correctChoiceText}`}</Text>
          {item.selectedChoiceText ? (
            <Text style={styles.selectedLine}>{`선택: ${item.selectedChoiceText}`}</Text>
          ) : null}
          <Text style={styles.explanationBody}>{item.explanationKo}</Text>
        </>
      )}

      {item.weakPointLabel ? (
        <Text style={styles.weakPoint}>{`약점: ${item.weakPointLabel}`}</Text>
      ) : null}
    </Animated.View>
  );
}

function RubricLine({ label, score, max }: { label: string; score: number; max: number }) {
  return (
    <View style={styles.rubricLine}>
      <Text style={styles.rubricLabel}>{label}</Text>
      <Text style={styles.rubricScore}>{`${score}/${max}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  explanationCard: {
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  explanationPrompt: {
    color: studyColors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  questionTextLine: {
    color: studyColors.textSoft,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  correctLine: {
    color: studyColors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  incorrectLine: {
    color: studyColors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  explanationLine: {
    color: studyColors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedLine: {
    color: studyColors.mutedText,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreLine: {
    color: studyColors.textSoft,
    fontSize: 13,
    fontWeight: '900',
  },
  rubricGrid: {
    alignSelf: 'flex-start',
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
    maxWidth: '100%',
    padding: 8,
  },
  rubricLine: {
    alignItems: 'center',
    backgroundColor: studyColors.canvas,
    borderColor: studyColors.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minWidth: 118,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  rubricLabel: {
    color: studyColors.mutedText,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  rubricScore: {
    color: studyColors.textSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 16,
    minWidth: 34,
    textAlign: 'right',
  },
  reasonList: {
    gap: 3,
  },
  reasonText: {
    color: studyColors.textSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  skillTagText: {
    color: studyColors.warningText,
    fontSize: 13,
    fontWeight: '900',
  },
  explanationBody: {
    color: studyColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  weakPoint: {
    color: studyColors.dangerText,
    fontSize: 13,
    fontWeight: '900',
  },
});
