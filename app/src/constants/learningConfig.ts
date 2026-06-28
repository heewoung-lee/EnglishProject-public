import type {
  LearnerLevel,
  QuestionArea,
  QuestionPackSchemaVersion,
} from '../types/learning';

export const LEARNING_STORAGE_KEY = 'englishProject.learningState.v1';

export const QUESTION_PACK_STORAGE_KEY = 'englishProject.questionPacks.v4';

export const CONVERSATION_SCENARIO_PACK_STORAGE_KEY =
  'englishProject.conversationScenarios.v1';

export const QUESTION_PACK_SCHEMA_VERSION: QuestionPackSchemaVersion = 1;

export const CONVERSATION_SCENARIO_PACK_SCHEMA_VERSION = 1;

export const REMOTE_QUESTION_PACK_BASE_URL =
  'https://englishproject-c42b2.web.app/question-packs';

export const REMOTE_CONVERSATION_SCENARIO_BASE_URL =
  'https://englishproject-c42b2.web.app/conversation-scenarios';

export const LEVEL_ORDER: LearnerLevel[] = ['A1', 'A2', 'B1', 'B2'];

export const PRACTICE_QUESTION_COUNT = 3;

export const PROMOTION_EXAM_QUESTION_COUNT = 5;

export const PROMOTION_RATE_THRESHOLD = 80;

export const PROMOTION_PASS_SCORE = 80;

export const INITIAL_RATE = 0;

export const PROMOTION_SUCCESS_RATE = 0;

export const PROMOTION_FAILURE_RATE = 70;

export const RECENT_RESULT_RETENTION_COUNT = 40;

export const QUESTION_AREA_LABELS: Record<QuestionArea, string> = {
  reading: '리딩',
  conversation: '회화',
  grammar: '문법',
};
