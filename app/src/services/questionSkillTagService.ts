import type { SkillTag } from '../types/conversation';
import type { LearningQuestion, WritingEvaluationResult } from '../types/learning';

const VALID_SKILL_TAGS: SkillTag[] = [
  'polite_requests',
  'articles',
  'prepositions',
  'verb_tense',
  'question_comprehension',
  'vocabulary_range',
  'clarification',
  'numbers_dates',
  'natural_phrasing',
  'task_completion',
];

export function normalizeQuestionSkillTags(value: unknown): SkillTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<SkillTag[]>((tags, item) => {
    if (VALID_SKILL_TAGS.includes(item as SkillTag) && !tags.includes(item as SkillTag)) {
      tags.push(item as SkillTag);
    }

    return tags;
  }, []);
}

export function getQuestionSkillTags(question: LearningQuestion): SkillTag[] {
  const explicitTags = normalizeQuestionSkillTags(question.skillTags);

  if (explicitTags.length > 0) {
    return explicitTags;
  }

  return inferSkillTagsFromText([
    question.promptKo,
    question.questionText,
    question.explanationKo,
    question.weakPointLabel,
    question.kind === 'writing' ? question.evaluationFocusKo : undefined,
  ]);
}

export function getWeakSkillTagsForQuestion(
  question: LearningQuestion,
  evaluation?: WritingEvaluationResult,
): SkillTag[] {
  const evaluationTags = normalizeQuestionSkillTags(evaluation?.skillTags);

  if (evaluationTags.length > 0) {
    return evaluationTags;
  }

  const questionTags = getQuestionSkillTags(question);

  return questionTags.length > 0 ? questionTags : ['task_completion'];
}

function inferSkillTagsFromText(parts: Array<string | undefined>): SkillTag[] {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const tags = new Set<SkillTag>();

  if (/article|관사/.test(text)) {
    tags.add('articles');
  }

  if (/preposition|전치사|위치|장소/.test(text)) {
    tags.add('prepositions');
  }

  if (/tense|시제|과거|현재|미래|완료|동사/.test(text)) {
    tags.add('verb_tense');
  }

  if (/question|의문|질문|묻|확인/.test(text)) {
    tags.add('question_comprehension');
  }

  if (/vocabulary|어휘|단어|철자|음식|food|keyword/.test(text)) {
    tags.add('vocabulary_range');
  }

  if (/could|please|정중|공손|요청|부탁/.test(text)) {
    tags.add('polite_requests');
  }

  if (/clarification|다시|반복|천천히/.test(text)) {
    tags.add('clarification');
  }

  if (/number|date|시간|날짜|숫자/.test(text)) {
    tags.add('numbers_dates');
  }

  if (/natural|자연|표현|어감|흐름/.test(text)) {
    tags.add('natural_phrasing');
  }

  if (tags.size === 0 && text.trim().length > 0) {
    tags.add('task_completion');
  }

  return [...tags];
}
