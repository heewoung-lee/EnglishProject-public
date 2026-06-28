import { PROMOTION_PASS_SCORE } from '../constants/learningConfig';
import type {
  ActiveSession,
  LearningQuestion,
  LocalLearningState,
  PracticeSessionResult,
  ProficiencyStat,
  PromotionExamResult,
  QuestionArea,
  QuestionExplanation,
  SubmitAnswerInput,
  SubmittedAnswer,
  WritingEvaluationResult,
} from '../types/learning';
import { selectPracticeQuestions, selectPromotionExamQuestions } from './questionSelector';
import { getWeakSkillTagsForQuestion } from './questionSkillTagService';
import {
  calculateExamScore,
  calculateNextRate,
  calculatePromotionResult,
  isPromotionReady,
} from './rateService';

function createSessionId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function isChoiceAnswer(answer: SubmittedAnswer | undefined): answer is SubmittedAnswer & { selectedChoiceId: string } {
  return Boolean(answer && 'selectedChoiceId' in answer);
}

function isWritingAnswer(answer: SubmittedAnswer | undefined): answer is SubmittedAnswer & {
  writingAnswer: string;
  writingEvaluation: WritingEvaluationResult;
} {
  return Boolean(answer && 'writingAnswer' in answer && 'writingEvaluation' in answer);
}

function normalizeProficiencyScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function mergeProficiencyStat(
  currentStat: ProficiencyStat | undefined,
  score: number,
  isCorrect: boolean,
  completedAt: string,
): ProficiencyStat {
  return {
    attempts: (currentStat?.attempts ?? 0) + 1,
    correctCount: (currentStat?.correctCount ?? 0) + (isCorrect ? 1 : 0),
    lastScore: normalizeProficiencyScore(score),
    lastPracticedAt: completedAt,
  };
}

function isAnsweredQuestionCorrect(
  question: LearningQuestion,
  answer: SubmittedAnswer | undefined,
): boolean {
  if (question.kind === 'writing') {
    return isWritingAnswer(answer) && answer.writingEvaluation.isCorrect;
  }

  return isChoiceAnswer(answer) && answer.selectedChoiceId === question.correctChoiceId;
}

function getAnsweredQuestionScore(
  question: LearningQuestion,
  answer: SubmittedAnswer | undefined,
): number {
  if (question.kind === 'writing') {
    return isWritingAnswer(answer) ? answer.writingEvaluation.score : 0;
  }

  return isAnsweredQuestionCorrect(question, answer) ? 100 : 0;
}

type SessionCreationOptions = {
  random?: () => number;
};

function shuffleChoiceAnswers(question: LearningQuestion, random: () => number): LearningQuestion {
  if (question.kind !== 'choice') {
    return question;
  }

  let choices = [...question.choices];

  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }

  if (
    choices.length > 1 &&
    choices.every((choice, index) => choice.id === question.choices[index]?.id)
  ) {
    choices = [...choices.slice(1), choices[0]];
  }

  return {
    ...question,
    choices,
  };
}

function shuffleSessionChoiceAnswers(
  questions: LearningQuestion[],
  random: () => number,
): LearningQuestion[] {
  return questions.map((question) => shuffleChoiceAnswers(question, random));
}

function isQuestionCorrect(session: ActiveSession, questionId: string): boolean {
  const question = session.questions.find((item) => item.id === questionId);
  const answer = session.answers.find((item) => item.questionId === questionId);

  if (!question) {
    return false;
  }

  return isAnsweredQuestionCorrect(question, answer);
}

function getCorrectQuestionIds(session: ActiveSession): string[] {
  return session.questions
    .filter((question) => isQuestionCorrect(session, question.id))
    .map((question) => question.id);
}

function buildExplanations(session: ActiveSession): QuestionExplanation[] {
  return session.questions.map((question) => {
    const answer = session.answers.find((item) => item.questionId === question.id);

    if (question.kind === 'writing') {
      const writingAnswer = isWritingAnswer(answer) ? answer : null;
      const evaluation = writingAnswer?.writingEvaluation;
      const isCorrect = Boolean(evaluation?.isCorrect);

      return {
        questionId: question.id,
        kind: 'writing',
        area: question.area,
        promptKo: question.promptKo,
        questionText: question.questionText,
        selectedChoiceText: '',
        correctChoiceText: question.sampleAnswer,
        isCorrect,
        explanationKo: evaluation?.feedbackKo ?? question.explanationKo,
        weakPointLabel: isCorrect ? '' : evaluation?.weakAreaKo || question.weakPointLabel,
        writingAnswer: writingAnswer?.writingAnswer ?? '',
        correctedAnswer: evaluation?.correctedAnswer ?? question.sampleAnswer,
        writingFeedbackKo: evaluation?.feedbackKo ?? question.explanationKo,
        writingScore: evaluation?.score ?? 0,
        writingRubric: evaluation?.rubric,
        writingScoreReasonsKo: evaluation?.scoreReasonsKo,
        writingSkillTags: evaluation?.skillTags,
        evaluationSource: evaluation?.evaluationSource,
        sampleAnswer: question.sampleAnswer,
        evaluationFocusKo: question.evaluationFocusKo,
      };
    }

    const selectedChoice = question.choices.find(
      (choice) => isChoiceAnswer(answer) && choice.id === answer.selectedChoiceId,
    );
    const correctChoice = question.choices.find((choice) => choice.id === question.correctChoiceId);
    const isCorrect = isChoiceAnswer(answer) && answer.selectedChoiceId === question.correctChoiceId;

    return {
      questionId: question.id,
      kind: 'choice',
      area: question.area,
      promptKo: question.promptKo,
      questionText: question.questionText,
      selectedChoiceText: selectedChoice?.text ?? '',
      correctChoiceText: correctChoice?.text ?? '',
      isCorrect,
      explanationKo: question.explanationKo,
      weakPointLabel: isCorrect ? '' : question.weakPointLabel,
    };
  });
}

function getWeakAreas(session: ActiveSession): QuestionArea[] {
  const weakAreas = session.questions
    .filter((question) => !isQuestionCorrect(session, question.id))
    .map((question) => question.area);

  return [...new Set(weakAreas)];
}

function getWeakSkillTags(session: ActiveSession) {
  const weakSkillTags = session.questions.flatMap((question) => {
    if (isQuestionCorrect(session, question.id)) {
      return [];
    }

    const answer = session.answers.find((item) => item.questionId === question.id);
    const evaluation = isWritingAnswer(answer) ? answer.writingEvaluation : undefined;

    return getWeakSkillTagsForQuestion(question, evaluation);
  });

  return [...new Set(weakSkillTags)];
}

export function applySessionProficiencyStats(
  state: LocalLearningState,
  session: ActiveSession,
  completedAt: string,
): LocalLearningState {
  const questionStats = { ...state.questionStats };
  const skillStats = { ...state.skillStats };

  session.questions.forEach((question) => {
    const answer = session.answers.find((item) => item.questionId === question.id);
    const isCorrect = isAnsweredQuestionCorrect(question, answer);
    const score = getAnsweredQuestionScore(question, answer);

    questionStats[question.id] = mergeProficiencyStat(
      questionStats[question.id],
      score,
      isCorrect,
      completedAt,
    );

    const evaluation = isWritingAnswer(answer) ? answer.writingEvaluation : undefined;
    const skillTags = getWeakSkillTagsForQuestion(question, evaluation);

    skillTags.forEach((skillTag) => {
      skillStats[skillTag] = mergeProficiencyStat(
        skillStats[skillTag],
        score,
        isCorrect,
        completedAt,
      );
    });
  });

  return {
    ...state,
    questionStats,
    skillStats,
  };
}

export function createPracticeSession(
  state: LocalLearningState,
  sourceQuestions?: LearningQuestion[],
  options?: SessionCreationOptions,
): ActiveSession {
  return {
    id: createSessionId('practice'),
    mode: 'practice',
    level: state.currentLevel,
    questions: shuffleSessionChoiceAnswers(
      selectPracticeQuestions(
        state.currentLevel,
        state.recentResults,
        state.solvedQuestionCount,
        sourceQuestions,
        {
          questionStats: state.questionStats,
          skillStats: state.skillStats,
        },
      ),
      options?.random ?? Math.random,
    ),
    currentQuestionIndex: 0,
    answers: [],
  };
}

export function createPromotionExamSession(
  state: LocalLearningState,
  sourceQuestions?: LearningQuestion[],
  options?: SessionCreationOptions,
): ActiveSession {
  return {
    id: createSessionId('promotion'),
    mode: 'promotionExam',
    level: state.currentLevel,
    questions: shuffleSessionChoiceAnswers(
      selectPromotionExamQuestions(state.currentLevel, sourceQuestions),
      options?.random ?? Math.random,
    ),
    currentQuestionIndex: 0,
    answers: [],
  };
}

export function submitAnswer(session: ActiveSession, answerInput: SubmitAnswerInput): ActiveSession {
  const currentQuestion = session.questions[session.currentQuestionIndex];

  if (!currentQuestion) {
    return session;
  }

  let nextAnswer: SubmittedAnswer | null = null;

  if (currentQuestion.kind === 'writing') {
    if (typeof answerInput === 'string' || !('writingAnswer' in answerInput)) {
      return session;
    }

    nextAnswer = {
      questionId: currentQuestion.id,
      kind: 'writing',
      writingAnswer: answerInput.writingAnswer,
      writingEvaluation: answerInput.writingEvaluation,
    };
  } else {
    const selectedChoiceId =
      typeof answerInput === 'string' ? answerInput : 'selectedChoiceId' in answerInput ? answerInput.selectedChoiceId : null;

    if (!selectedChoiceId) {
      return session;
    }

    nextAnswer = {
      questionId: currentQuestion.id,
      kind: 'choice',
      selectedChoiceId,
    };
  }

  return {
    ...session,
    answers: [...session.answers, nextAnswer],
    currentQuestionIndex: session.currentQuestionIndex + 1,
  };
}

export function isSessionComplete(session: ActiveSession): boolean {
  return session.answers.length >= session.questions.length;
}

export function buildPracticeResult(
  state: LocalLearningState,
  session: ActiveSession,
): PracticeSessionResult {
  const correctQuestionIds = getCorrectQuestionIds(session);
  const correctCount = correctQuestionIds.length;
  const totalCount = session.questions.length;
  const nextRate = calculateNextRate(state.currentRate, correctCount, totalCount);

  return {
    sessionId: session.id,
    level: state.currentLevel,
    previousRate: state.currentRate,
    nextRate,
    correctCount,
    totalCount,
    score: calculateExamScore(correctCount, totalCount),
    promotionReady: isPromotionReady(nextRate),
    questionIds: session.questions.map((question) => question.id),
    correctQuestionIds,
    weakAreas: getWeakAreas(session),
    weakSkillTags: getWeakSkillTags(session),
    explanations: buildExplanations(session),
  };
}

export function buildPromotionExamResult(
  state: LocalLearningState,
  session: ActiveSession,
): PromotionExamResult {
  const correctQuestionIds = getCorrectQuestionIds(session);
  const correctCount = correctQuestionIds.length;
  const score = calculateExamScore(correctCount, session.questions.length);
  const promotion = calculatePromotionResult(state.currentLevel, score);

  return {
    sessionId: session.id,
    fromLevel: state.currentLevel,
    toLevel: promotion.toLevel,
    passed: promotion.passed,
    score,
    passScore: PROMOTION_PASS_SCORE,
    nextRate: promotion.nextRate,
    questionIds: session.questions.map((question) => question.id),
    correctQuestionIds,
    weakAreas: getWeakAreas(session),
    weakSkillTags: getWeakSkillTags(session),
    explanations: buildExplanations(session),
  };
}
