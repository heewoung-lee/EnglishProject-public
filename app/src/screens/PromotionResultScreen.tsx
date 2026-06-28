import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatLevelTransitionLabel,
  getLevelDisplayName,
} from '../components/LevelAreaBadge';
import { AdBanner } from '../components/AdBanner';
import { QuestionExplanationCard } from '../components/QuestionExplanationCard';
import { getPromotionResultFeedback } from '../services/feedbackMotion';
import { useFeedbackSounds } from '../services/feedbackSound';
import { formatPromotionScoreSummary } from '../services/promotionResultCopy';
import { studyColors, studyRadius, studySpacing } from '../theme/studyDesign';
import type { PromotionExamResult } from '../types/learning';

const RESULT_SOUND_DELAY_MS = 120;

type PromotionResultScreenProps = {
  result: PromotionExamResult;
  onContinue: () => void;
};

export function PromotionResultScreen({ result, onContinue }: PromotionResultScreenProps) {
  const feedback = useMemo(() => getPromotionResultFeedback(result), [result.passed]);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(feedback.heroScaleFrom)).current;
  const playFeedbackSound = useFeedbackSounds();
  const playFeedbackSoundRef = useRef(playFeedbackSound);

  useEffect(() => {
    playFeedbackSoundRef.current = playFeedbackSound;
  }, [playFeedbackSound]);

  useEffect(() => {
    heroOpacity.setValue(0);
    heroScale.setValue(feedback.heroScaleFrom);
    const soundTimeoutId = setTimeout(() => {
      playFeedbackSoundRef.current(feedback.soundCue);
    }, RESULT_SOUND_DELAY_MS);

    Animated.parallel([
      Animated.timing(heroOpacity, {
        duration: feedback.heroFadeDurationMs,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        damping: result.passed ? 10 : 14,
        mass: 0.9,
        stiffness: result.passed ? 140 : 110,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      clearTimeout(soundTimeoutId);
    };
  }, [feedback, heroOpacity, heroScale, result.passed, result.sessionId]);

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
        <Text style={styles.kicker}>{result.passed ? '승급 성공' : '현재 단계 유지'}</Text>
        <Text style={styles.title}>
          {result.passed && result.toLevel
            ? formatLevelTransitionLabel(result.fromLevel, result.toLevel)
            : getLevelDisplayName(result.fromLevel)}
        </Text>
        <Text style={styles.score}>{formatPromotionScoreSummary(result)}</Text>
        <Text style={styles.message}>
          {result.passed
            ? '새 단계의 문제로 다시 시작합니다.'
            : '조금 더 연습한 뒤 다시 승급 시험에 도전하세요.'}
        </Text>
      </Animated.View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>시험 해설</Text>
        {result.explanations.map((item, index) => (
          <QuestionExplanationCard key={item.questionId} item={item} index={index} />
        ))}
      </View>

      <AdBanner />

      <Pressable accessibilityRole="button" onPress={onContinue} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>
          {result.passed ? '다음 문제 시작' : '계속 연습하기'}
        </Text>
      </Pressable>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: studyColors.canvas,
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: studySpacing.screenX,
    paddingTop: studySpacing.screenTop,
    paddingBottom: 28,
  },
  resultHero: {
    alignItems: 'center',
  },
  kicker: {
    color: studyColors.primary,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    color: studyColors.text,
    fontSize: 44,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  score: {
    color: studyColors.accent,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },
  message: {
    color: studyColors.textSoft,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
  },
  section: {
    gap: 10,
    marginTop: 28,
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
    marginTop: 34,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: studyColors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
});
