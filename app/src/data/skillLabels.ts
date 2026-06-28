import type { SkillTag } from '../types/conversation';

export const skillLabels: Record<SkillTag, string> = {
  polite_requests: '공손한 요청',
  articles: '관사',
  prepositions: '전치사',
  verb_tense: '시제',
  question_comprehension: '질문 이해',
  vocabulary_range: '어휘',
  clarification: '다시 묻기',
  numbers_dates: '숫자와 날짜',
  natural_phrasing: '자연스러운 표현',
  task_completion: '핵심 의미 전달',
};
