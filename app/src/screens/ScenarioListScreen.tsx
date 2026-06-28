import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { skillLabels } from '../data/skillLabels';
import type { Scenario } from '../types/conversation';

type ScenarioListScreenProps = {
  scenarios: Scenario[];
  onSelectScenario: (scenario: Scenario) => void;
};

export function ScenarioListScreen({ scenarios, onSelectScenario }: ScenarioListScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>English Coach</Text>
        <Text style={styles.title}>오늘의 회화 연습</Text>
        <Text style={styles.subtitle}>상황을 고르고 영어로 대화를 시작하세요.</Text>
      </View>

      <View style={styles.summaryBand}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>3</Text>
          <Text style={styles.summaryLabel}>시나리오</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>8</Text>
          <Text style={styles.summaryLabel}>최대 턴</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>100</Text>
          <Text style={styles.summaryLabel}>점수</Text>
        </View>
      </View>

      <View style={styles.list}>
        {scenarios.map((scenario) => (
          <Pressable
            key={scenario.id}
            accessibilityRole="button"
            onPress={() => onSelectScenario(scenario)}
            style={({ pressed }) => [styles.scenario, pressed ? styles.pressed : null]}
          >
            <View style={styles.scenarioHeader}>
              <View>
                <Text style={styles.scenarioTitle}>{scenario.titleKo}</Text>
                <Text style={styles.scenarioSubtitle}>{scenario.titleEn}</Text>
              </View>
              <Text style={styles.level}>초급</Text>
            </View>
            <Text style={styles.description}>{scenario.descriptionKo}</Text>
            <Text style={styles.goal}>{scenario.userGoalKo}</Text>
            <View style={styles.tags}>
              {scenario.targetSkills.slice(0, 3).map((tag) => (
                <Text key={tag} style={styles.tag}>
                  {skillLabels[tag]}
                </Text>
              ))}
            </View>
          </Pressable>
        ))}
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
    gap: 6,
    marginBottom: 18,
    paddingTop: 8,
  },
  kicker: {
    color: '#176b5d',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: '#222826',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: '#5d6662',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryBand: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    paddingVertical: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  summaryValue: {
    color: '#db6f4b',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#626b66',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryDivider: {
    backgroundColor: '#dde2dc',
    height: 36,
    width: 1,
  },
  list: {
    gap: 12,
  },
  scenario: {
    backgroundColor: '#ffffff',
    borderColor: '#dde2dc',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.995 }],
  },
  scenarioHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  scenarioTitle: {
    color: '#232927',
    fontSize: 19,
    fontWeight: '900',
  },
  scenarioSubtitle: {
    color: '#6a736f',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  level: {
    backgroundColor: '#e5f0eb',
    borderRadius: 8,
    color: '#176b5d',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  description: {
    color: '#414945',
    fontSize: 15,
    lineHeight: 21,
  },
  goal: {
    backgroundColor: '#f3f4ee',
    borderRadius: 8,
    color: '#454b47',
    fontSize: 14,
    lineHeight: 20,
    padding: 11,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f7e6dd',
    borderRadius: 8,
    color: '#733c2d',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
});

