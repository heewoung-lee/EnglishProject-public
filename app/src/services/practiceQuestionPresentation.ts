import type { LearningQuestion, WritingLearningQuestion } from '../types/learning';

type TimedTranslationAutoSubmitInput = {
  isSubmittingAnswer: boolean;
  question: LearningQuestion | null | undefined;
  remainingTimeSeconds: number | null;
  submittedQuestionId: string | null;
};

type QuestionDisplayParts = {
  promptText: string;
  sourceLabel?: string;
  sourceText?: string;
};

function getQuestionSourceLabel(question: LearningQuestion): string {
  if (question.area === 'reading') {
    return '지문';
  }

  if (question.area === 'grammar') {
    return '대상 문장';
  }

  return '상황';
}

function punctuatePromptInstruction(promptText: string): string {
  return /[.!?。！？]$/.test(promptText) ? promptText : `${promptText}.`;
}

function splitPromptSourceText(promptKo: string): { promptText: string; sourceText: string } | null {
  const colonIndex = promptKo.indexOf(': ');

  if (colonIndex <= 0) {
    return null;
  }

  const promptText = promptKo.slice(0, colonIndex).trim();
  const sourceText = promptKo.slice(colonIndex + 1).trim();

  if (!promptText || !sourceText) {
    return null;
  }

  return {
    promptText: punctuatePromptInstruction(promptText),
    sourceText,
  };
}

export function isKoreanTranslationQuestion(
  question: LearningQuestion | null | undefined,
): question is WritingLearningQuestion & { answerLanguage: 'ko' } {
  return question?.kind === 'writing' && question.answerLanguage === 'ko';
}

export function getQuestionDisplayParts(question: LearningQuestion): QuestionDisplayParts {
  if (question.questionText?.trim()) {
    return {
      promptText: question.promptKo,
      sourceLabel: getQuestionSourceLabel(question),
      sourceText: question.questionText.trim(),
    };
  }

  const splitPrompt = splitPromptSourceText(question.promptKo);

  if (splitPrompt) {
    return {
      ...splitPrompt,
      sourceLabel: getQuestionSourceLabel(question),
    };
  }

  return {
    promptText: question.promptKo,
  };
}

export function getWritingAnswerPlaceholder(question: LearningQuestion): string {
  return isKoreanTranslationQuestion(question)
    ? '한글 번역을 입력하세요.'
    : '영어 문장을 입력하세요.';
}

export function getWritingAnswerAccessibilityLabel(question: LearningQuestion): string {
  return isKoreanTranslationQuestion(question) ? '한글 번역 답안' : '영작 답안';
}

export function formatTimeLimitLabel(seconds: number): string {
  return `남은 시간 ${Math.max(0, Math.ceil(seconds))}초`;
}

export function isTimedTranslationExpired(
  question: LearningQuestion | null | undefined,
  remainingTimeSeconds: number | null,
): boolean {
  return isKoreanTranslationQuestion(question) && remainingTimeSeconds === 0;
}

export function shouldAutoSubmitTimedTranslation({
  isSubmittingAnswer,
  question,
  remainingTimeSeconds,
  submittedQuestionId,
}: TimedTranslationAutoSubmitInput): boolean {
  return (
    isTimedTranslationExpired(question, remainingTimeSeconds) &&
    !isSubmittingAnswer &&
    question?.id !== submittedQuestionId
  );
}
