import type {
  ConversationMessage,
  ConversationResult,
  Scenario,
  SkillTag,
} from './conversation';
import type { EvaluationSource } from './evaluation';

export type LearnerLevel = 'A1' | 'A2' | 'B1' | 'B2';

export type AppMode =
  | 'loading'
  | 'practice'
  | 'practiceResult'
  | 'conversation'
  | 'conversationResult'
  | 'promotionExam'
  | 'promotionResult'
  | 'storageError';

export type StorageErrorOperation =
  | 'load'
  | 'savePracticeResult'
  | 'saveConversationResult'
  | 'savePromotionResult';

export type QuestionKind = 'choice' | 'writing';

export type QuestionArea = 'reading' | 'conversation' | 'grammar';

export type AnswerLanguage = 'en' | 'ko';

export type ReadingDifficulty = 'easy' | 'medium' | 'hard';

export type QuestionChoice = {
  id: string;
  text: string;
};

type BaseLearningQuestion = {
  id: string;
  level: LearnerLevel;
  area: QuestionArea;
  kind: QuestionKind;
  promptKo: string;
  questionText?: string;
  choices?: QuestionChoice[];
  correctChoiceId?: string;
  explanationKo: string;
  weakPointLabel?: string;
  skillTags?: SkillTag[];
};

export type ChoiceLearningQuestion = BaseLearningQuestion & {
  kind: 'choice';
  choices: QuestionChoice[];
  correctChoiceId: string;
};

export type WritingLearningQuestion = BaseLearningQuestion & {
  kind: 'writing';
  sampleAnswer: string;
  evaluationFocusKo: string;
  expectedKeywords?: string[];
  answerLanguage?: AnswerLanguage;
  expectedKeywordsKo?: string[];
  readingDifficulty?: ReadingDifficulty;
  timeLimitSeconds?: number;
};

export type LearningQuestion = ChoiceLearningQuestion | WritingLearningQuestion;

export type QuestionPackSchemaVersion = 1;

export type QuestionPackManifestEntry = {
  level: LearnerLevel;
  version: number;
  path: string;
  questionCount: number;
};

export type QuestionPackManifest = {
  schemaVersion: QuestionPackSchemaVersion;
  publishedAt: string;
  packs: QuestionPackManifestEntry[];
};

export type LevelQuestionPack = {
  schemaVersion: QuestionPackSchemaVersion;
  level: LearnerLevel;
  version: number;
  publishedAt: string;
  questions: LearningQuestion[];
};

export type CachedLevelPack<Level extends LearnerLevel = LearnerLevel> = {
  level: Level;
  version: number;
  publishedAt: string;
  questions: LearningQuestion[];
  cachedAt: string;
};

export type CachedQuestionPackState = {
  schemaVersion: QuestionPackSchemaVersion;
  manifestPublishedAt: string;
  packs: {
    [Level in LearnerLevel]?: CachedLevelPack<Level>;
  };
};

export type QuestionPackSourceOrigin = 'bundled' | 'cache' | 'remote';

export type QuestionPackSource = {
  origin: QuestionPackSourceOrigin;
  questions: LearningQuestion[];
  cachedState: CachedQuestionPackState | null;
};

export type WritingEvaluationResult = {
  score: number;
  isCorrect: boolean;
  correctedAnswer: string;
  feedbackKo: string;
  weakAreaKo?: string;
  evaluationSource: EvaluationSource;
  rubric?: WritingRubricScores;
  scoreReasonsKo?: string[];
  skillTags?: SkillTag[];
};

export type WritingRubricScores = {
  taskCompletion: number;
  meaning: number;
  grammar: number;
  naturalness: number;
};

export type RecentResult = {
  questionSetId: string;
  level: LearnerLevel;
  score: number;
  rateAfter: number;
  questionIds: string[];
  correctQuestionIds?: string[];
  weakAreas: QuestionArea[];
  weakSkillTags?: SkillTag[];
  solvedAt: string;
};

export type RecentConversationResult = {
  conversationSessionId: string;
  scenarioId: string;
  level: LearnerLevel;
  score: number;
  rateAfter: number;
  weaknessTags: SkillTag[];
  recommendedScenarioIds: string[];
  solvedAt: string;
};

export type ProficiencyStat = {
  attempts: number;
  correctCount: number;
  lastScore: number;
  lastPracticedAt: string;
};

export type SkillProficiencyStats = Partial<Record<SkillTag, ProficiencyStat>>;

export type QuestionProficiencyStats = Record<string, ProficiencyStat>;

export type LocalLearningState = {
  currentLevel: LearnerLevel;
  currentRate: number;
  solvedQuestionCount: number;
  promotionReady: boolean;
  recentResults: RecentResult[];
  recentConversationResults: RecentConversationResult[];
  questionStats: QuestionProficiencyStats;
  skillStats: SkillProficiencyStats;
  updatedAt: string;
};

export type ChoiceSubmittedAnswer = {
  questionId: string;
  kind?: 'choice';
  selectedChoiceId: string;
};

export type WritingSubmittedAnswer = {
  questionId: string;
  kind?: 'writing';
  writingAnswer: string;
  writingEvaluation: WritingEvaluationResult;
};

export type SubmittedAnswer = ChoiceSubmittedAnswer | WritingSubmittedAnswer;

export type SubmitAnswerInput =
  | string
  | { selectedChoiceId: string }
  | { writingAnswer: string; writingEvaluation: WritingEvaluationResult };

export type ActiveSession = {
  id: string;
  mode: 'practice' | 'promotionExam';
  level: LearnerLevel;
  questions: LearningQuestion[];
  currentQuestionIndex: number;
  answers: SubmittedAnswer[];
};

export type ConversationPracticeResult = {
  sessionId: string;
  level: LearnerLevel;
  scenario: Scenario;
  previousRate: number;
  nextRate: number;
  score: number;
  promotionReady: boolean;
  weakAreas: QuestionArea[];
  messages: ConversationMessage[];
  conversationResult: ConversationResult;
};

export type QuestionExplanation = {
  questionId: string;
  kind: QuestionKind;
  area: QuestionArea;
  promptKo: string;
  questionText?: string;
  selectedChoiceText: string;
  correctChoiceText: string;
  isCorrect: boolean;
  explanationKo: string;
  weakPointLabel?: string;
  writingAnswer?: string;
  correctedAnswer?: string;
  writingFeedbackKo?: string;
  writingScore?: number;
  writingRubric?: WritingRubricScores;
  writingScoreReasonsKo?: string[];
  writingSkillTags?: SkillTag[];
  evaluationSource?: EvaluationSource;
  sampleAnswer?: string;
  evaluationFocusKo?: string;
};

export type PracticeSessionResult = {
  sessionId: string;
  level: LearnerLevel;
  previousRate: number;
  nextRate: number;
  correctCount: number;
  totalCount: number;
  score: number;
  promotionReady: boolean;
  questionIds: string[];
  correctQuestionIds: string[];
  weakAreas: QuestionArea[];
  weakSkillTags: SkillTag[];
  explanations: QuestionExplanation[];
};

export type PromotionExamResult = {
  sessionId: string;
  fromLevel: LearnerLevel;
  toLevel: LearnerLevel | null;
  passed: boolean;
  score: number;
  passScore: number;
  nextRate: number;
  questionIds: string[];
  correctQuestionIds: string[];
  weakAreas: QuestionArea[];
  weakSkillTags: SkillTag[];
  explanations: QuestionExplanation[];
};
