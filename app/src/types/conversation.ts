import type { LearnerLevel } from './learning';
import type { EvaluationSource } from './evaluation';

export type SkillTag =
  | 'polite_requests'
  | 'articles'
  | 'prepositions'
  | 'verb_tense'
  | 'question_comprehension'
  | 'vocabulary_range'
  | 'clarification'
  | 'numbers_dates'
  | 'natural_phrasing'
  | 'task_completion';

export type Scenario = {
  id: string;
  level: LearnerLevel;
  area: 'conversation';
  titleKo: string;
  titleEn: string;
  situationKo: string;
  descriptionKo: string;
  aiRole: string;
  userRole: string;
  userGoalKo: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  maxUserTurns: number;
  targetExpressions: string[];
  targetSkills: SkillTag[];
  openingMessage: string;
  completionMessage: string;
  repairPolicy: RepairPolicy;
  successCriteria: string[];
  requiredSlots: ConversationSlot[];
};

export type ConversationSlot = {
  key: string;
  label: string;
  prompt: string;
  matchKeywords: string[];
  required?: boolean;
};

export type RepairPolicy = {
  unclear: string;
  offTopic: string;
  correction: string;
  koreanOnly: string;
};

export type ConversationTurnType = 'progress' | 'no_progress' | 'off_topic' | 'unclear';

export type ConversationEngineEndReason =
  | 'goal_completed'
  | 'max_turns'
  | 'too_many_failures'
  | 'no_progress'
  | null;

export type ConversationEngineStatus = 'active' | 'completed' | 'ended';

export type TurnInterpretation = {
  isUnderstandable: boolean;
  isOnTopic: boolean;
  turnType: ConversationTurnType;
  filledSlotKeys: string[];
  correctedSentence: string | null;
  detectedIssueTags: SkillTag[];
  shortReasonKo: string | null;
  confidence: number;
};

export type ConversationEngineState = {
  filledSlotKeys: string[];
  skippedSlotKeys?: string[];
  pendingSlotKey: string | null;
  lastPromptKey: string | null;
  lastAssistantActionKey: string | null;
  lastTurnType: ConversationTurnType | null;
  repeatedPromptCount: number;
  noProgressCount: number;
  offTopicCount: number;
  unclearCount: number;
  userTurnCount: number;
  status: ConversationEngineStatus;
  endReason: ConversationEngineEndReason;
};

export type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  analysis?: UserMessageAnalysis;
};

export type ConversationSession = {
  id: string;
  mode: 'conversation';
  level: LearnerLevel;
  scenario: Scenario;
  messages: ConversationMessage[];
  failureCount: number;
  engineState: ConversationEngineState;
};

export type UserMessageAnalysis = {
  isRelevant: boolean;
  isUnderstandable: boolean;
  detectedIssues: SkillTag[];
  correctedSentence?: string;
  shortReasonKo?: string;
};

export type CorrectedExample = {
  original: string;
  corrected: string;
  explanationKo: string;
  tags: SkillTag[];
};

export type EndReason = ConversationEngineEndReason;

export type ConversationResult = {
  totalScore: number;
  evaluationSource: EvaluationSource;
  categoryScores: {
    taskCompletion: number;
    clarity: number;
    grammar: number;
    vocabulary: number;
    naturalness: number;
  };
  summaryKo: string;
  strengthsKo: string[];
  weaknessesKo: string[];
  correctedExamples: CorrectedExample[];
  weaknessTags: SkillTag[];
  recommendedScenarioIds: string[];
};

export type ActorResponse = {
  message: ConversationMessage;
  userAnalysis: UserMessageAnalysis;
  communicationFailed: boolean;
  shouldEndSession: boolean;
  endReason: EndReason;
  engineState: ConversationEngineState;
};

export type ActorApiResponse = {
  message: string;
  isUserUnderstandable: boolean;
  isUserRelevant: boolean;
  shouldEndSession: boolean;
  endReason: EndReason;
  detectedIssueTags: SkillTag[];
  correctedSentence: string | null;
  shortReasonKo: string | null;
  engineState?: ConversationEngineState;
};

export type ConversationScenarioPackSchemaVersion = 1;

export type ConversationScenarioPackManifestEntry = {
  level: LearnerLevel;
  version: number;
  path: string;
  scenarioCount: number;
};

export type ConversationScenarioPackManifest = {
  schemaVersion: ConversationScenarioPackSchemaVersion;
  publishedAt: string;
  packs: ConversationScenarioPackManifestEntry[];
};

export type LevelConversationScenarioPack = {
  schemaVersion: ConversationScenarioPackSchemaVersion;
  level: LearnerLevel;
  version: number;
  publishedAt: string;
  scenarios: Scenario[];
};

export type CachedConversationScenarioPack<Level extends LearnerLevel = LearnerLevel> = {
  level: Level;
  version: number;
  publishedAt: string;
  scenarios: Scenario[];
  cachedAt: string;
};

export type CachedConversationScenarioPackState = {
  schemaVersion: ConversationScenarioPackSchemaVersion;
  manifestPublishedAt: string;
  packs: {
    [Level in LearnerLevel]?: CachedConversationScenarioPack<Level>;
  };
};

export type ConversationScenarioSourceOrigin = 'bundled' | 'cache' | 'remote';

export type ConversationScenarioSource = {
  origin: ConversationScenarioSourceOrigin;
  scenarios: Scenario[];
  cachedState: CachedConversationScenarioPackState | null;
};

export type { LearnerLevel };
