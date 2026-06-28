import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  StyleSheet,
} from 'react-native';

import { AppSettingsMenu } from './src/components/AppSettingsMenu';
import { RECENT_RESULT_RETENTION_COUNT } from './src/constants/learningConfig';
import { ConversationResultScreen } from './src/screens/ConversationResultScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { PracticeQuestionScreen } from './src/screens/PracticeQuestionScreen';
import { PracticeResultScreen } from './src/screens/PracticeResultScreen';
import { PromotionExamScreen } from './src/screens/PromotionExamScreen';
import { PromotionResultScreen } from './src/screens/PromotionResultScreen';
import { StorageErrorScreen } from './src/screens/StorageErrorScreen';
import {
  buildConversationPracticeResult,
  createConversationSession,
} from './src/services/conversationSessionService';
import { getConversationEngineFailureCount } from './src/services/conversationEngine';
import {
  loadConversationScenarioSource,
  refreshConversationScenarioCache,
} from './src/services/conversationScenarioService';
import { evaluateConversationWithAi } from './src/services/evaluationService';
import { exitApplication, resetLevelProgress } from './src/services/appSettingsActions';
import { getSettingsMenuTopOffset } from './src/services/appSettingsMenuLayout';
import { selectNextLearningActivity } from './src/services/learningActivitySelector';
import { loadLearningState, resetLearningState, saveLearningState } from './src/services/learningStorage';
import {
  loadQuestionPackSource,
  refreshQuestionPackCache,
} from './src/services/questionPackService';
import { getNextLevel } from './src/services/rateService';
import {
  applySessionProficiencyStats,
  buildPracticeResult,
  buildPromotionExamResult,
  createPracticeSession,
  createPromotionExamSession,
  isSessionComplete,
  submitAnswer,
} from './src/services/sessionService';
import { getAndroidSafeAreaTopPadding } from './src/services/safeAreaService';
import { evaluateWritingAnswer } from './src/services/writingEvaluationService';
import type {
  ConversationEngineState,
  ConversationMessage,
  ConversationScenarioSource,
  ConversationSession,
} from './src/types/conversation';
import type {
  ActiveSession,
  AppMode,
  ConversationPracticeResult,
  LocalLearningState,
  PracticeSessionResult,
  PromotionExamResult,
  QuestionPackSource,
  StorageErrorOperation,
} from './src/types/learning';

type PendingStorageSave =
  | {
      operation: 'savePracticeResult';
      nextState: LocalLearningState;
      result: PracticeSessionResult;
    }
  | {
      operation: 'saveConversationResult';
      nextState: LocalLearningState;
      result: ConversationPracticeResult;
    }
  | {
      operation: 'savePromotionResult';
      nextState: LocalLearningState;
      result: PromotionExamResult;
    };

export default function App() {
  const [mode, setMode] = useState<AppMode>('loading');
  const [learningState, setLearningState] = useState<LocalLearningState | null>(null);
  const [questionPackSource, setQuestionPackSource] = useState<QuestionPackSource | null>(null);
  const [conversationScenarioSource, setConversationScenarioSource] =
    useState<ConversationScenarioSource | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeConversationSession, setActiveConversationSession] =
    useState<ConversationSession | null>(null);
  const [practiceResult, setPracticeResult] = useState<PracticeSessionResult | null>(null);
  const [conversationPracticeResult, setConversationPracticeResult] =
    useState<ConversationPracticeResult | null>(null);
  const [promotionResult, setPromotionResult] = useState<PromotionExamResult | null>(null);
  const [storageErrorOperation, setStorageErrorOperation] =
    useState<StorageErrorOperation | null>(null);
  const [pendingStorageSave, setPendingStorageSave] = useState<PendingStorageSave | null>(null);
  const [isStorageRetrying, setIsStorageRetrying] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isEvaluatingConversation, setIsEvaluatingConversation] = useState(false);
  const [isSettingsMenuVisible, setIsSettingsMenuVisible] = useState(false);
  const [isResettingLevel, setIsResettingLevel] = useState(false);
  const learningStateRef = useRef<LocalLearningState | null>(null);
  const questionPackSourceRef = useRef<QuestionPackSource | null>(null);
  const conversationScenarioSourceRef = useRef<ConversationScenarioSource | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const activeConversationSessionRef = useRef<ConversationSession | null>(null);
  const answerSubmissionInFlightRef = useRef(false);
  const conversationEvaluationInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const storageRetryInFlightRef = useRef(false);
  const questionPackRefreshInFlightRef = useRef(false);
  const hasStartedRemoteSourceRefreshRef = useRef(false);
  const latestSaveRequestIdRef = useRef(0);
  const activeSaveRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    answerSubmissionInFlightRef.current = false;
    setIsSubmittingAnswer(false);
  }, [activeSession?.currentQuestionIndex, activeSession?.id, mode]);

  useEffect(() => {
    if (
      hasStartedRemoteSourceRefreshRef.current ||
      mode === 'loading' ||
      mode === 'storageError' ||
      !learningState ||
      !questionPackSource ||
      !conversationScenarioSource
    ) {
      return;
    }

    hasStartedRemoteSourceRefreshRef.current = true;
    void refreshRemoteLearningSourcesInBackground();
  }, [conversationScenarioSource, learningState, mode, questionPackSource]);

  function updateLearningState(nextState: LocalLearningState | null) {
    learningStateRef.current = nextState;
    setLearningState(nextState);
  }

  function updateQuestionPackSource(nextSource: QuestionPackSource | null) {
    questionPackSourceRef.current = nextSource;
    setQuestionPackSource(nextSource);
  }

  function updateConversationScenarioSource(nextSource: ConversationScenarioSource | null) {
    conversationScenarioSourceRef.current = nextSource;
    setConversationScenarioSource(nextSource);
  }

  function updateActiveSession(nextSession: ActiveSession | null) {
    activeSessionRef.current = nextSession;
    setActiveSession(nextSession);
  }

  function updateActiveConversationSession(nextSession: ConversationSession | null) {
    activeConversationSessionRef.current = nextSession;
    setActiveConversationSession(nextSession);
  }

  function isLatestSaveRequest(requestId: number) {
    return latestSaveRequestIdRef.current === requestId;
  }

  async function loadInitialState() {
    setMode('loading');
    setStorageErrorOperation(null);
    setIsStorageRetrying(false);

    try {
      const [
        loadedState,
        loadedQuestionPackSource,
        loadedConversationScenarioSource,
      ] = await Promise.all([
        loadLearningState(),
        loadQuestionPackSource(),
        loadConversationScenarioSource(),
      ]);

      updateLearningState(loadedState);
      updateQuestionPackSource(loadedQuestionPackSource);
      updateConversationScenarioSource(loadedConversationScenarioSource);
      setPendingStorageSave(null);
      startLearningActivity(
        loadedState,
        loadedQuestionPackSource,
        loadedConversationScenarioSource,
      );
    } catch {
      setStorageErrorOperation('load');
      setMode('storageError');
    }
  }

  function clearResults() {
    setPracticeResult(null);
    setConversationPracticeResult(null);
    setPromotionResult(null);
  }

  function startLearningActivity(
    nextState: LocalLearningState,
    source = questionPackSourceRef.current,
    scenarioSource = conversationScenarioSourceRef.current,
  ) {
    if (!source || !scenarioSource) {
      return;
    }

    const activity = selectNextLearningActivity(nextState, scenarioSource.scenarios);

    updateLearningState(nextState);
    clearResults();

    if (activity.kind === 'promotionExam') {
      const session = createPromotionExamSession(nextState, source.questions);
      updateActiveSession(session);
      updateActiveConversationSession(null);
      setMode('promotionExam');
      return;
    }

    if (activity.kind === 'conversation') {
      const session = createConversationSession(activity.scenario);
      updateActiveSession(null);
      updateActiveConversationSession(session);
      setMode('conversation');
      return;
    }

    startPracticeOnly(nextState, source);
  }

  function startPracticeOnly(
    nextState: LocalLearningState,
    source = questionPackSourceRef.current,
  ) {
    if (!source) {
      return;
    }

    const session = createPracticeSession(nextState, source.questions);

    updateLearningState(nextState);
    updateActiveSession(session);
    updateActiveConversationSession(null);
    clearResults();
    setMode('practice');
  }

  async function persistPendingStorageSave(pendingSave: PendingStorageSave) {
    if (saveInFlightRef.current) {
      return;
    }

    const requestId = latestSaveRequestIdRef.current + 1;
    latestSaveRequestIdRef.current = requestId;
    activeSaveRequestIdRef.current = requestId;
    saveInFlightRef.current = true;

    try {
      const persistedState = await saveLearningState(pendingSave.nextState);

      if (!isLatestSaveRequest(requestId)) {
        return;
      }

      updateLearningState(persistedState);
      updateActiveSession(null);
      updateActiveConversationSession(null);

      if (pendingSave.operation === 'savePracticeResult') {
        setPracticeResult(pendingSave.result);
        setConversationPracticeResult(null);
        setPromotionResult(null);
        setMode('practiceResult');
      } else if (pendingSave.operation === 'saveConversationResult') {
        setConversationPracticeResult(pendingSave.result);
        setPracticeResult(null);
        setPromotionResult(null);
        setMode('conversationResult');
      } else {
        setPromotionResult(pendingSave.result);
        setPracticeResult(null);
        setConversationPracticeResult(null);
        setMode('promotionResult');
      }

      setPendingStorageSave(null);
      setStorageErrorOperation(null);
    } catch {
      if (!isLatestSaveRequest(requestId)) {
        return;
      }

      setPendingStorageSave(pendingSave);
      setStorageErrorOperation(pendingSave.operation);
      setMode('storageError');
    } finally {
      if (activeSaveRequestIdRef.current === requestId) {
        activeSaveRequestIdRef.current = null;
        saveInFlightRef.current = false;
      }

      if (isLatestSaveRequest(requestId)) {
        setIsStorageRetrying(false);
      }
    }
  }

  async function refreshRemoteLearningSourcesInBackground() {
    if (questionPackRefreshInFlightRef.current) {
      return;
    }

    questionPackRefreshInFlightRef.current = true;

    try {
      const [refreshedQuestionPackSource, refreshedConversationScenarioSource] =
        await Promise.all([
          refreshQuestionPackCache(),
          refreshConversationScenarioCache(),
        ]);

      if (refreshedQuestionPackSource) {
        updateQuestionPackSource(refreshedQuestionPackSource);
      }

      if (refreshedConversationScenarioSource) {
        updateConversationScenarioSource(refreshedConversationScenarioSource);
      }
    } catch (error) {
      console.warn('Failed to refresh remote learning sources.', error);
    } finally {
      questionPackRefreshInFlightRef.current = false;
    }
  }

  async function savePracticeResult(
    result: PracticeSessionResult,
    nextState: LocalLearningState,
  ) {
    await persistPendingStorageSave({
      operation: 'savePracticeResult',
      nextState,
      result,
    });
  }

  async function finishPractice(session: ActiveSession) {
    const currentLearningState = learningStateRef.current;

    if (!currentLearningState) {
      return;
    }

    const completedAt = new Date().toISOString();
    const result = buildPracticeResult(currentLearningState, session);
    const stateWithStats = applySessionProficiencyStats(currentLearningState, session, completedAt);
    const nextState: LocalLearningState = {
      ...stateWithStats,
      currentRate: result.nextRate,
      solvedQuestionCount: stateWithStats.solvedQuestionCount + result.totalCount,
      promotionReady: result.promotionReady,
      recentResults: [
        ...stateWithStats.recentResults.slice(-(RECENT_RESULT_RETENTION_COUNT - 1)),
        {
          questionSetId: result.sessionId,
          level: result.level,
          score: result.score,
          rateAfter: result.nextRate,
          questionIds: result.questionIds,
          correctQuestionIds: result.correctQuestionIds,
          weakAreas: result.weakAreas,
          weakSkillTags: result.weakSkillTags,
          solvedAt: completedAt,
        },
      ],
      updatedAt: completedAt,
    };

    await savePracticeResult(result, nextState);
  }

  async function submitPracticeAnswer(answer: string) {
    if (answerSubmissionInFlightRef.current) {
      return;
    }

    const currentSession = activeSessionRef.current;

    if (!currentSession || currentSession.mode !== 'practice') {
      return;
    }

    const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];

    if (!currentQuestion) {
      return;
    }

    answerSubmissionInFlightRef.current = true;
    setIsSubmittingAnswer(true);

    try {
      const nextSession = currentQuestion.kind === 'writing'
        ? submitAnswer(currentSession, {
            writingAnswer: answer,
            writingEvaluation: await evaluateWritingAnswer({
              question: currentQuestion,
              answer,
            }),
          })
        : submitAnswer(currentSession, answer);
      updateActiveSession(nextSession);

      if (isSessionComplete(nextSession)) {
        await finishPractice(nextSession);
      }
    } catch (error) {
      answerSubmissionInFlightRef.current = false;
      setIsSubmittingAnswer(false);
      throw error;
    }
  }

  function startPromotionExam() {
    const currentLearningState = learningStateRef.current;
    const currentQuestionPackSource = questionPackSourceRef.current;

    if (
      !currentLearningState ||
      !currentQuestionPackSource ||
      !getNextLevel(currentLearningState.currentLevel)
    ) {
      return;
    }

    const session = createPromotionExamSession(
      currentLearningState,
      currentQuestionPackSource.questions,
    );
    updateActiveSession(session);
    updateActiveConversationSession(null);
    clearResults();
    setMode('promotionExam');
  }

  async function saveConversationResult(
    result: ConversationPracticeResult,
    nextState: LocalLearningState,
  ) {
    await persistPendingStorageSave({
      operation: 'saveConversationResult',
      nextState,
      result,
    });
  }

  async function finishConversation(
    messages?: ConversationMessage[],
    failureCount?: number,
    engineState?: ConversationEngineState,
  ) {
    if (conversationEvaluationInFlightRef.current) {
      return;
    }

    const currentLearningState = learningStateRef.current;
    const currentSession = activeConversationSessionRef.current;

    if (!currentLearningState || !currentSession) {
      return;
    }

    const completedEngineState = engineState ?? currentSession.engineState;
    const completedSession: ConversationSession = {
      ...currentSession,
      messages: messages ?? currentSession.messages,
      engineState: completedEngineState,
      failureCount: failureCount ?? getConversationEngineFailureCount(completedEngineState),
    };
    const completedFailureCount = getConversationEngineFailureCount(completedSession.engineState);

    conversationEvaluationInFlightRef.current = true;
    setIsEvaluatingConversation(true);
    updateActiveConversationSession(completedSession);

    try {
      const conversationResult = await evaluateConversationWithAi({
        scenario: completedSession.scenario,
        messages: completedSession.messages,
        communicationFailureCount: completedFailureCount,
        engineState: completedSession.engineState,
        endReason: completedSession.engineState.endReason,
      });
      const result = buildConversationPracticeResult(
        currentLearningState,
        completedSession,
        conversationResult,
      );
      const nextState: LocalLearningState = {
        ...currentLearningState,
        currentRate: result.nextRate,
        solvedQuestionCount: currentLearningState.solvedQuestionCount + 1,
        promotionReady: result.promotionReady,
        recentConversationResults: [
          ...currentLearningState.recentConversationResults.slice(
            -(RECENT_RESULT_RETENTION_COUNT - 1),
          ),
          {
            conversationSessionId: result.sessionId,
            scenarioId: result.scenario.id,
            level: result.level,
            score: result.score,
            rateAfter: result.nextRate,
            weaknessTags: result.conversationResult.weaknessTags,
            recommendedScenarioIds: result.conversationResult.recommendedScenarioIds,
            solvedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      await saveConversationResult(result, nextState);
    } finally {
      conversationEvaluationInFlightRef.current = false;
      setIsEvaluatingConversation(false);
    }
  }

  function changeConversationMessages(messages: ConversationMessage[]) {
    const currentSession = activeConversationSessionRef.current;

    if (!currentSession) {
      return;
    }

    updateActiveConversationSession({
      ...currentSession,
      messages,
    });
  }

  function changeConversationFailureCount(failureCount: number) {
    const currentSession = activeConversationSessionRef.current;

    if (!currentSession) {
      return;
    }

    updateActiveConversationSession({
      ...currentSession,
      failureCount,
    });
  }

  async function savePromotionResult(
    result: PromotionExamResult,
    nextState: LocalLearningState,
  ) {
    await persistPendingStorageSave({
      operation: 'savePromotionResult',
      nextState,
      result,
    });
  }

  async function finishPromotionExam(session: ActiveSession) {
    const currentLearningState = learningStateRef.current;

    if (!currentLearningState) {
      return;
    }

    const completedAt = new Date().toISOString();
    const result = buildPromotionExamResult(currentLearningState, session);
    const stateWithStats = applySessionProficiencyStats(currentLearningState, session, completedAt);
    const nextState: LocalLearningState = {
      ...stateWithStats,
      currentLevel: result.passed && result.toLevel ? result.toLevel : stateWithStats.currentLevel,
      currentRate: result.nextRate,
      promotionReady: false,
      recentResults: [
        ...stateWithStats.recentResults.slice(-(RECENT_RESULT_RETENTION_COUNT - 1)),
        {
          questionSetId: result.sessionId,
          level: result.passed && result.toLevel ? result.toLevel : stateWithStats.currentLevel,
          score: result.score,
          rateAfter: result.nextRate,
          questionIds: result.questionIds,
          correctQuestionIds: result.correctQuestionIds,
          weakAreas: result.weakAreas,
          weakSkillTags: result.weakSkillTags,
          solvedAt: completedAt,
        },
      ],
      updatedAt: completedAt,
    };

    await savePromotionResult(result, nextState);
  }

  async function submitPromotionAnswer(answer: string) {
    if (answerSubmissionInFlightRef.current) {
      return;
    }

    const currentSession = activeSessionRef.current;

    if (!currentSession || currentSession.mode !== 'promotionExam') {
      return;
    }

    const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];

    if (!currentQuestion) {
      return;
    }

    answerSubmissionInFlightRef.current = true;
    setIsSubmittingAnswer(true);

    try {
      const nextSession = currentQuestion.kind === 'writing'
        ? submitAnswer(currentSession, {
            writingAnswer: answer,
            writingEvaluation: await evaluateWritingAnswer({
              question: currentQuestion,
              answer,
            }),
          })
        : submitAnswer(currentSession, answer);
      updateActiveSession(nextSession);

      if (isSessionComplete(nextSession)) {
        await finishPromotionExam(nextSession);
      }
    } catch (error) {
      answerSubmissionInFlightRef.current = false;
      setIsSubmittingAnswer(false);
      throw error;
    }
  }

  async function retryPendingStorageSave(pendingSave: PendingStorageSave) {
    if (pendingSave.operation === 'savePracticeResult') {
      await savePracticeResult(pendingSave.result, pendingSave.nextState);
      return;
    }

    if (pendingSave.operation === 'saveConversationResult') {
      await saveConversationResult(pendingSave.result, pendingSave.nextState);
      return;
    }

    await savePromotionResult(pendingSave.result, pendingSave.nextState);
  }

  async function retryStorageOperation() {
    if (!storageErrorOperation || storageRetryInFlightRef.current) {
      return;
    }

    storageRetryInFlightRef.current = true;
    setIsStorageRetrying(true);

    try {
      if (storageErrorOperation === 'load') {
        await loadInitialState();
        return;
      }

      if (!pendingStorageSave || pendingStorageSave.operation !== storageErrorOperation) {
        return;
      }

      await retryPendingStorageSave(pendingStorageSave);
    } finally {
      storageRetryInFlightRef.current = false;
      setIsStorageRetrying(false);
    }
  }

  if (mode === 'storageError' && storageErrorOperation) {
    return (
      <SafeAreaView style={[styles.app, styles.androidSafeArea]}>
        <StorageErrorScreen
          operation={storageErrorOperation}
          isRetrying={isStorageRetrying}
          onRetry={() => {
            void retryStorageOperation();
          }}
        />
        <ExpoStatusBar style="dark" />
      </SafeAreaView>
    );
  }

  async function resetLevelFromSettings() {
    if (isResettingLevel) {
      return;
    }

    const currentQuestionPackSource = questionPackSourceRef.current;
    const currentConversationScenarioSource = conversationScenarioSourceRef.current;

    latestSaveRequestIdRef.current += 1;
    setIsSettingsMenuVisible(false);
    setIsResettingLevel(true);
    setPendingStorageSave(null);
    setStorageErrorOperation(null);

    try {
      const nextState = await resetLevelProgress(resetLearningState);

      updateActiveSession(null);
      updateActiveConversationSession(null);
      clearResults();

      if (currentQuestionPackSource && currentConversationScenarioSource) {
        startLearningActivity(
          nextState,
          currentQuestionPackSource,
          currentConversationScenarioSource,
        );
      } else {
        updateLearningState(nextState);
      }
    } catch (error) {
      console.warn('Failed to reset learning state.', error);
      Alert.alert('초기화 실패', '레벨 초기화를 다시 시도해 주세요.');
    } finally {
      setIsResettingLevel(false);
    }
  }

  function exitFromSettings() {
    setIsSettingsMenuVisible(false);
    exitApplication(BackHandler.exitApp);
  }

  function changeConversationEngineState(engineState: ConversationEngineState) {
    const currentSession = activeConversationSessionRef.current;

    if (!currentSession) {
      return;
    }

    updateActiveConversationSession({
      ...currentSession,
      engineState,
    });
  }

  if (mode === 'loading' || !learningState || !questionPackSource || !conversationScenarioSource) {
    return (
      <SafeAreaView style={[styles.loading, styles.androidSafeArea]}>
        <ActivityIndicator color="#24715f" />
        <ExpoStatusBar style="dark" />
      </SafeAreaView>
    );
  }

  const nextLevel = getNextLevel(learningState.currentLevel);
  const isPromotionExam = mode === 'promotionExam';
  const settingsMenuTopOffset = getSettingsMenuTopOffset(mode, androidSafeAreaTopPadding);

  return (
    <SafeAreaView
      style={[styles.app, styles.androidSafeArea, isPromotionExam ? styles.promotionApp : null]}
    >
      {mode === 'practice' && activeSession ? (
        <PracticeQuestionScreen
          level={learningState.currentLevel}
          rate={learningState.currentRate}
          session={activeSession}
          isSubmittingAnswer={isSubmittingAnswer}
          onSubmitAnswer={submitPracticeAnswer}
        />
      ) : null}

      {mode === 'practiceResult' && practiceResult ? (
        <PracticeResultScreen
          result={practiceResult}
          canStartPromotion={Boolean(nextLevel)}
          onNextPractice={() => startLearningActivity(learningState)}
          onStartPromotionExam={startPromotionExam}
        />
      ) : null}

      {mode === 'conversation' && activeConversationSession ? (
        <ConversationScreen
          scenario={activeConversationSession.scenario}
          rate={learningState.currentRate}
          messages={activeConversationSession.messages}
          failureCount={activeConversationSession.failureCount}
          engineState={activeConversationSession.engineState}
          userTurnCount={activeConversationSession.messages.filter((message) => message.role === 'user').length}
          onChangeFailureCount={changeConversationFailureCount}
          onChangeEngineState={changeConversationEngineState}
          onChangeMessages={changeConversationMessages}
          onFinishSession={finishConversation}
          onBack={() => startPracticeOnly(learningState)}
          isEvaluating={isEvaluatingConversation}
        />
      ) : null}

      {mode === 'conversationResult' && conversationPracticeResult ? (
        <ConversationResultScreen
          result={conversationPracticeResult}
          canStartPromotion={Boolean(nextLevel)}
          onNextActivity={() => startLearningActivity(learningState)}
          onStartPromotionExam={startPromotionExam}
        />
      ) : null}

      {mode === 'promotionExam' && activeSession && nextLevel ? (
        <PromotionExamScreen
          session={activeSession}
          fromLevel={learningState.currentLevel}
          toLevel={nextLevel}
          isSubmittingAnswer={isSubmittingAnswer}
          onSubmitAnswer={submitPromotionAnswer}
        />
      ) : null}

      {mode === 'promotionResult' && promotionResult ? (
        <PromotionResultScreen
          result={promotionResult}
          onContinue={() => startLearningActivity(learningState)}
        />
      ) : null}

      <AppSettingsMenu
        visible={isSettingsMenuVisible}
        isResettingLevel={isResettingLevel}
        topOffset={settingsMenuTopOffset}
        useDarkTheme={isPromotionExam}
        onOpen={() => setIsSettingsMenuVisible(true)}
        onClose={() => setIsSettingsMenuVisible(false)}
        onResetLevel={() => {
          void resetLevelFromSettings();
        }}
        onExit={exitFromSettings}
      />
      <ExpoStatusBar style={isPromotionExam ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

const androidSafeAreaTopPadding = getAndroidSafeAreaTopPadding(
  Platform.OS,
  NativeStatusBar.currentHeight,
);

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#f6f8f5',
  },
  androidSafeArea: {
    paddingTop: androidSafeAreaTopPadding,
  },
  promotionApp: {
    backgroundColor: '#102a2a',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: '#f6f8f5',
    flex: 1,
    justifyContent: 'center',
  },
});
