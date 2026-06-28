import { scenarios as defaultScenarios } from '../data/scenarios';
import type { Scenario } from '../types/conversation';
import type { LocalLearningState, RecentConversationResult, RecentResult } from '../types/learning';
import { getNextLevel } from './rateService';

export type LearningActivity =
  | { kind: 'practice' }
  | { kind: 'conversation'; scenario: Scenario }
  | { kind: 'promotionExam' };

const PASSED_CONVERSATION_SCORE = 70;
const PRACTICE_ONLY_CONVERSATION_CADENCE = 3;
const LOW_CONVERSATION_SCORE = 70;
const BALANCED_ACTIVITY_WINDOW = 10;
const MAX_CONVERSATIONS_IN_BALANCED_WINDOW = 2;

export function selectNextLearningActivity(
  state: LocalLearningState,
  sourceScenarios: Scenario[] = defaultScenarios,
): LearningActivity {
  if (state.promotionReady && getNextLevel(state.currentLevel)) {
    return { kind: 'promotionExam' };
  }

  const levelScenarios = sourceScenarios.filter((scenario) => scenario.level === state.currentLevel);

  if (levelScenarios.length === 0) {
    return { kind: 'practice' };
  }

  if (!shouldSelectConversation(state, levelScenarios)) {
    return { kind: 'practice' };
  }

  return {
    kind: 'conversation',
    scenario: selectConversationScenario(levelScenarios, state.recentConversationResults),
  };
}

function shouldSelectConversation(
  state: LocalLearningState,
  levelScenarios: Scenario[],
): boolean {
  if (hasReachedRecentConversationBalanceLimit(state)) {
    return false;
  }

  const latestConversationResult = getLatestConversationResult(
    state.recentConversationResults,
    state.currentLevel,
  );

  if (latestConversationResult?.score < LOW_CONVERSATION_SCORE) {
    return true;
  }

  if (allLevelScenariosWereRecentlyPassed(levelScenarios, state.recentConversationResults)) {
    return false;
  }

  const latestPracticeResult = getLatestPracticeResult(state.recentResults);

  if (latestPracticeResult?.weakAreas.includes('conversation')) {
    return true;
  }

  const latestActivities = [
    ...state.recentResults.map((result) => ({
      kind: 'practice' as const,
      solvedAt: result.solvedAt,
    })),
    ...state.recentConversationResults.map((result) => ({
      kind: 'conversation' as const,
      solvedAt: result.solvedAt,
    })),
  ].sort((left, right) => Date.parse(right.solvedAt) - Date.parse(left.solvedAt));

  const latestThreeActivities = latestActivities.slice(0, PRACTICE_ONLY_CONVERSATION_CADENCE);

  return (
    latestThreeActivities.length >= PRACTICE_ONLY_CONVERSATION_CADENCE &&
    latestThreeActivities.every((activity) => activity.kind === 'practice')
  );
}

function hasReachedRecentConversationBalanceLimit(state: LocalLearningState) {
  const latestLevelActivities = getLatestLevelActivities(state).slice(
    0,
    BALANCED_ACTIVITY_WINDOW,
  );
  const recentConversationCount = latestLevelActivities.filter(
    (activity) => activity.kind === 'conversation',
  ).length;

  return recentConversationCount >= MAX_CONVERSATIONS_IN_BALANCED_WINDOW;
}

function getLatestLevelActivities(state: LocalLearningState) {
  return [
    ...state.recentResults
      .filter((result) => result.level === state.currentLevel)
      .map((result) => ({
        kind: 'practice' as const,
        solvedAt: result.solvedAt,
      })),
    ...state.recentConversationResults
      .filter((result) => result.level === state.currentLevel)
      .map((result) => ({
        kind: 'conversation' as const,
        solvedAt: result.solvedAt,
      })),
  ].sort((left, right) => Date.parse(right.solvedAt) - Date.parse(left.solvedAt));
}

function selectConversationScenario(
  levelScenarios: Scenario[],
  recentConversationResults: RecentConversationResult[],
): Scenario {
  const latestConversationResult = [...recentConversationResults]
    .reverse()
    .find((result) => result.level === levelScenarios[0]?.level);
  const recommendedScenario = latestConversationResult?.recommendedScenarioIds
    .map((scenarioId) => levelScenarios.find((scenario) => scenario.id === scenarioId))
    .find((scenario): scenario is Scenario =>
      scenario ? !isRecentlyPassed(scenario.id, recentConversationResults) : false,
    );

  if (recommendedScenario) {
    return recommendedScenario;
  }

  const freshScenario = levelScenarios.find(
    (scenario) => !isRecentlyPassed(scenario.id, recentConversationResults),
  );

  if (freshScenario) {
    return freshScenario;
  }

  const weakestRecentResult = [...recentConversationResults]
    .filter((result) => levelScenarios.some((scenario) => scenario.id === result.scenarioId))
    .sort((left, right) => left.score - right.score)[0];

  return (
    levelScenarios.find((scenario) => scenario.id === weakestRecentResult?.scenarioId) ??
    levelScenarios[0]
  );
}

function isRecentlyPassed(
  scenarioId: string,
  recentConversationResults: RecentConversationResult[],
): boolean {
  const latestScenarioResult = [...recentConversationResults]
    .reverse()
    .find((result) => result.scenarioId === scenarioId);

  return Boolean(latestScenarioResult && latestScenarioResult.score >= PASSED_CONVERSATION_SCORE);
}

function allLevelScenariosWereRecentlyPassed(
  levelScenarios: Scenario[],
  recentConversationResults: RecentConversationResult[],
) {
  return levelScenarios.every((scenario) =>
    isRecentlyPassed(scenario.id, recentConversationResults),
  );
}

function getLatestPracticeResult(results: RecentResult[]) {
  return [...results].sort((left, right) => Date.parse(right.solvedAt) - Date.parse(left.solvedAt))[0];
}

function getLatestConversationResult(
  results: RecentConversationResult[],
  level: LocalLearningState['currentLevel'],
) {
  return [...results]
    .filter((result) => result.level === level)
    .sort((left, right) => Date.parse(right.solvedAt) - Date.parse(left.solvedAt))[0];
}
