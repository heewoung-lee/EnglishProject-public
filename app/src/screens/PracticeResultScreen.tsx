import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { QUESTION_AREA_LABELS } from '../constants/learningConfig';
import { AdBanner } from '../components/AdBanner';
import { QuestionExplanationCard } from '../components/QuestionExplanationCard';
import { getPracticeResultFeedback } from '../services/feedbackMotion';
import { useFeedbackSounds } from '../services/feedbackSound';
import { studyColors, studyRadius, studySpacing } from '../theme/studyDesign';
import type { PracticeSessionResult } from '../types/learning';

const RESULT_SOUND_DELAY_MS = 120;

type PracticeResultScreenProps = {
  result: PracticeSessionResult;
  canStartPromotion: boolean;
  onNextPractice: () => void;
  onStartPromotionExam: () => void;
};

export function PracticeResultScreen({
  result,
  canStartPromotion,
  onNextPractice,
  onStartPromotionExam,
}: PracticeResultScreenProps) {
  const isPromotionReady = result.promotionReady && canStartPromotion;
  const actionLabel = isPromotionReady ? '승급 시험 시작' : '다음 문제';
  const action = isPromotionReady ? onStartPromotionExam : onNextPractice;
  const feedback = useMemo(
    () => getPracticeResultFeedback(result),
    [result.correctCount, result.promotionReady, result.totalCount],
  );
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(feedback.heroScaleFrom)).current;
  const rateProgress = useRef(new Animated.Value(0)).current;
  const playFeedbackSound = useFeedbackSounds();
  const playFeedbackSoundRef = useRef(playFeedbackSound);
  const [displayedRate, setDisplayedRate] = useState(result.previousRate);
  const weakAreaText = result.weakAreas.length > 0
    ? result.weakAreas.map((area) => QUESTION_AREA_LABELS[area]).join(', ')
    : '없음';

  useEffect(() => {
    playFeedbackSoundRef.current = playFeedbackSound;
  }, [playFeedbackSound]);

  useEffect(() => {
    heroOpacity.setValue(0);
    heroScale.setValue(feedback.heroScaleFrom);
    rateProgress.setValue(0);
    setDisplayedRate(result.previousRate);
    const soundTimeoutId = setTimeout(() => {
      playFeedbackSoundRef.current(feedback.soundCue);
    }, RESULT_SOUND_DELAY_MS);

    const listenerId = rateProgress.addListener(({ value }) => {
      const nextValue = result.previousRate + (result.nextRate - result.previousRate) * value;
      setDisplayedRate(Math.round(nextValue));
    });

    Animated.parallel([
      Animated.timing(heroOpacity, {
        duration: feedback.heroFadeDurationMs,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        damping: 12,
        mass: 0.9,
        stiffness: 130,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(rateProgress, {
        duration: feedback.rateCountDurationMs,
        toValue: 1,
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      clearTimeout(soundTimeoutId);
      rateProgress.removeListener(listenerId);
    };
  }, [
    feedback,
    heroOpacity,
    heroScale,
    rateProgress,
    result.nextRate,
    result.previousRate,
    result.sessionId,
  ]);

  return (
    <Animated.ScrollView contentContainerStyle={styles.container}>
      <Animated.View
        style={[
          styles.resultHero,
          {
            opacity: heroOpacity,
            transform: [{ scale: heroScale }],
          },
        ]}
      >
        <Text style={styles.kicker}>결과</Text>
        <Text style={styles.rate}>Rate {displayedRate}</Text>
        <Text style={styles.summary}>
          {`이번 세트에서 ${result.totalCount}문제 중 ${result.correctCount}문제를 맞혔습니다.`}
        </Text>
        <Text style={styles.weakArea}>{`보완 영역: ${weakAreaText}`}</Text>

        {isPromotionReady ? (
          <View style={styles.promotionBox}>
            <Text style={styles.promotionText}>승급 시험에 도전할 수 있습니다.</Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>해설</Text>
        {result.explanations.map((item, index) => (
          <QuestionExplanationCard key={item.questionId} item={item} index={index} />
        ))}
      </View>

      <AdBanner />

      <Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{actionLabel}</Text>
      </Pressable>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: studyColors.canvas,
    flexGrow: 1,
    paddingHorizontal: studySpacing.screenX,
    paddingTop: studySpacing.screenTop,
    paddingBottom: 28,
  },
  resultHero: {
    marginBottom: studySpacing.sectionGap,
  },
  kicker: {
    color: studyColors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  rate: {
    color: studyColors.accent,
    fontSize: 58,
    fontWeight: '900',
    lineHeight: 68,
    marginTop: 10,
  },
  summary: {
    color: studyColors.textSoft,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  weakArea: {
    color: studyColors.mutedText,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 18,
  },
  promotionBox: {
    backgroundColor: studyColors.primarySoft,
    borderRadius: studyRadius.sm,
    marginBottom: 16,
    padding: 14,
  },
  promotionText: {
    color: studyColors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: studyColors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: studyColors.primary,
    borderRadius: studyRadius.sm,
    marginTop: 24,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: studyColors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
});
