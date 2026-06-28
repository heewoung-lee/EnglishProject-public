import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScoreCard } from '../components/ScoreCard';
import { WeaknessTag } from '../components/WeaknessTag';
import { skillLabels } from '../data/skillLabels';
import type { ConversationResult, Scenario } from '../types/conversation';

type ResultScreenProps = {
  scenario: Scenario;
  result: ConversationResult;
  onRetry: () => void;
  onChooseScenario: () => void;
};

export function ResultScreen({ scenario, result, onRetry, onChooseScenario }: ResultScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{scenario.titleKo}</Text>
        <Text style={styles.title}>연습 결과</Text>
      </View>

      <View style={styles.scoreBand}>
        <Text style={styles.score}>{result.totalScore}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>

      <Text style={styles.summary}>{result.summaryKo}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>세부 점수</Text>
        <ScoreCard label="목표 달성도" score={result.categoryScores.taskCompletion} max={30} />
        <ScoreCard label="의미 전달력" score={result.categoryScores.clarity} max={25} />
        <ScoreCard label="문법 정확도" score={result.categoryScores.grammar} max={20} />
        <ScoreCard label="어휘 적절성" score={result.categoryScores.vocabulary} max={15} />
        <ScoreCard label="자연스러운 흐름" score={result.categoryScores.naturalness} max={10} />
      </View>

      {result.strengthsKo.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>잘한 점</Text>
          {result.strengthsKo.map((strength) => (
            <Text key={strength} style={styles.listItem}>
              {strength}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>보완할 점</Text>
        {result.weaknessesKo.map((weakness) => (
          <Text key={weakness} style={styles.listItem}>
            {weakness}
          </Text>
        ))}
      </View>

      {result.correctedExamples.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>수정 예시</Text>
          {result.correctedExamples.map((example) => (
            <View key={`${example.original}-${example.corrected}`} style={styles.example}>
              <Text style={styles.original}>{example.original}</Text>
              <Text style={styles.corrected}>{example.corrected}</Text>
              <Text style={styles.explanation}>{example.explanationKo}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>약점 태그</Text>
        <View style={styles.tags}>
          {result.weaknessTags.map((tag) => (
            <WeaknessTag key={tag} label={skillLabels[tag]} />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>다시 연습</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onChooseScenario} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>상황 선택</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 34,
  },
  header: {
    gap: 5,
    paddingTop: 8,
  },
  kicker: {
    color: '#176b5d',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#222826',
    fontSize: 30,
    fontWeight: '900',
  },
  scoreBand: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginTop: 22,
  },
  score: {
    color: '#db6f4b',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  scoreMax: {
    color: '#6c746f',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    marginLeft: 4,
  },
  summary: {
    color: '#3f4743',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#222826',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  listItem: {
    color: '#454d49',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  example: {
    backgroundColor: '#f7f8f5',
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
    padding: 12,
  },
  original: {
    color: '#8f3f2b',
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'line-through',
  },
  corrected: {
    color: '#176b5d',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  explanation: {
    color: '#5f6863',
    fontSize: 13,
    lineHeight: 19,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#176b5d',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cfd6cf',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#303633',
    fontSize: 16,
    fontWeight: '900',
  },
});
