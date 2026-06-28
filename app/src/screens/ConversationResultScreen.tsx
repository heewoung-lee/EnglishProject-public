import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '../components/AdBanner';
import { ScoreCard } from '../components/ScoreCard';
import { WeaknessTag } from '../components/WeaknessTag';
import { skillLabels } from '../data/skillLabels';
import {
  buildConversationImprovementItems,
  type ConversationImprovementItem,
} from '../services/conversationResultFeedback';
import type { ConversationPracticeResult } from '../types/learning';

type ConversationResultScreenProps = {
  result: ConversationPracticeResult;
  canStartPromotion: boolean;
  onNextActivity: () => void;
  onStartPromotionExam: () => void;
};

export function ConversationResultScreen({
  result,
  canStartPromotion,
  onNextActivity,
  onStartPromotionExam,
}: ConversationResultScreenProps) {
  const isPromotionReady = result.promotionReady && canStartPromotion;
  const actionLabel = isPromotionReady ? '승급 시험 시작' : '다음 문제';
  const action = isPromotionReady ? onStartPromotionExam : onNextActivity;
  const improvementItems = buildConversationImprovementItems({
    correctedExamples: result.conversationResult.correctedExamples,
    messages: result.messages,
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>{result.scenario.titleKo}</Text>
      <Text style={styles.title}>회화 평가</Text>
      <Text style={styles.rate}>Rate {result.nextRate}</Text>
      <Text style={styles.score}>{`Score ${result.score}`}</Text>
      <Text style={styles.summary}>{result.conversationResult.summaryKo}</Text>

      {isPromotionReady ? (
        <View style={styles.promotionBox}>
          <Text style={styles.promotionText}>승급 시험을 볼 수 있는 레이트에 도달했습니다.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>세부 점수</Text>
        <ScoreCard label="목표 달성" score={result.conversationResult.categoryScores.taskCompletion} max={30} />
        <ScoreCard label="의미 전달" score={result.conversationResult.categoryScores.clarity} max={25} />
        <ScoreCard label="문법 정확도" score={result.conversationResult.categoryScores.grammar} max={20} />
        <ScoreCard label="어휘 적절성" score={result.conversationResult.categoryScores.vocabulary} max={15} />
        <ScoreCard label="자연스러움" score={result.conversationResult.categoryScores.naturalness} max={10} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>잘한 점</Text>
        {result.conversationResult.strengthsKo.map((strength) => (
          <Text key={strength} style={styles.listItem}>{strength}</Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>보완할 점</Text>
        {result.conversationResult.weaknessesKo.map((weakness) => (
          <Text key={weakness} style={styles.listItem}>{weakness}</Text>
        ))}
        {improvementItems.length > 0 ? (
          <View style={styles.improvementGroup}>
            <Text style={styles.subsectionTitle}>이렇게 바꿔 말해 보세요</Text>
            {improvementItems.map((item) => (
              <ImprovementExampleCard key={item.id} item={item} />
            ))}
          </View>
        ) : null}
        <View style={styles.tags}>
          {result.conversationResult.weaknessTags.map((tag) => (
            <WeaknessTag key={tag} label={skillLabels[tag]} />
          ))}
        </View>
      </View>

      <AdBanner />

      <Pressable accessibilityRole="button" onPress={action} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{actionLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

function ImprovementExampleCard({ item }: { item: ConversationImprovementItem }) {
  return (
    <View style={styles.example}>
      <Text style={styles.exampleLabel}>내 답변</Text>
      <Text style={styles.original}>{item.original}</Text>
      <Text style={styles.exampleLabel}>추천 표현</Text>
      <Text style={styles.corrected}>{item.corrected}</Text>
      <Text style={styles.explanation}>{item.explanationKo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f8f5',
    flexGrow: 1,
    padding: 20,
    paddingBottom: 34,
  },
  kicker: {
    color: '#24715f',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#202624',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    marginTop: 4,
  },
  rate: {
    color: '#d46f45',
    fontSize: 58,
    fontWeight: '900',
    lineHeight: 68,
    marginTop: 10,
  },
  score: {
    color: '#202624',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  summary: {
    color: '#3f4844',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
  },
  promotionBox: {
    backgroundColor: '#e3efe9',
    borderRadius: 8,
    marginBottom: 16,
    padding: 14,
  },
  promotionText: {
    color: '#24715f',
    fontSize: 15,
    fontWeight: '900',
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 14,
  },
  sectionTitle: {
    color: '#202624',
    fontSize: 18,
    fontWeight: '900',
  },
  listItem: {
    color: '#4d5752',
    fontSize: 15,
    lineHeight: 22,
  },
  improvementGroup: {
    gap: 8,
    marginTop: 4,
  },
  subsectionTitle: {
    color: '#202624',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  example: {
    backgroundColor: '#f7f8f5',
    borderRadius: 8,
    gap: 6,
    padding: 12,
  },
  exampleLabel: {
    color: '#6c756f',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  original: {
    color: '#8f3f2b',
    fontSize: 14,
    lineHeight: 20,
  },
  corrected: {
    color: '#176b5d',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },
  explanation: {
    color: '#5f6863',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#24715f',
    borderRadius: 8,
    marginTop: 10,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
