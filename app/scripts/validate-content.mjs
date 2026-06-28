#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const QUESTION_AREAS = ['reading', 'conversation', 'grammar'];
const QUESTION_KINDS = ['choice', 'writing'];
const ANSWER_LANGUAGES = ['en', 'ko'];
const READING_DIFFICULTIES = ['easy', 'medium', 'hard'];
const MIN_QUESTION_COUNT = 18;
const MIN_WRITING_QUESTION_COUNT = 4;
const MIN_PROMOTION_ELIGIBLE_COUNT = 5;
const SCENARIO_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const SKILL_TAGS = [
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
const GENERIC_SLOT_KEYWORDS = new Set([
  'pay',
  'to',
  'issue',
  'problem',
  'delay',
  'because',
  'however',
  'sorry',
  "sorry i can't",
  "i can't",
  'i cannot',
  'reduced',
  'increased',
  'neutral',
  'facts',
  'role',
]);

const HANGUL_PATTERN = /[\uAC00-\uD7A3]/;
const REPLACEMENT_CHARACTER_PATTERN = /\uFFFD/;
const EXPLICIT_ENGLISH_WRITING_PROMPT_PATTERN = /^다음 문장을 영어로 쓰세요: [^"\r\n]+$/u;

function parseArgs(argv) {
  const options = {
    json: false,
    root: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--root') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('--root requires a path value.');
      }

      options.root = resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidDateString(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isSafePackPath(value) {
  return (
    isNonEmptyString(value) &&
    value.startsWith('packs/') &&
    value.endsWith('.json') &&
    !value.includes('..') &&
    !value.includes('://')
  );
}

function readJson(path, errors, label) {
  if (!existsSync(path)) {
    errors.push(`${label}: file does not exist at ${path}`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function validateNoStalePackFiles(errors, baseDir, entries, context) {
  const publishedPaths = new Set(entries.map((entry) => entry.path));
  const packsDir = join(baseDir, 'packs');

  if (!existsSync(packsDir)) {
    return;
  }

  readdirSync(packsDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .forEach((fileName) => {
      const packPath = `packs/${fileName}`;

      if (!publishedPaths.has(packPath)) {
        addError(errors, context, `stale pack file is not listed in manifest: ${packPath}`);
      }
    });
}

function addError(errors, context, message) {
  errors.push(`${context}: ${message}`);
}

function validateKoreanField(errors, context, value) {
  if (!isNonEmptyString(value)) {
    addError(errors, context, 'must be a non-empty string');
    return;
  }

  if (!HANGUL_PATTERN.test(value)) {
    addError(errors, context, 'must contain Korean text');
  }

  if (REPLACEMENT_CHARACTER_PATTERN.test(value)) {
    addError(errors, context, 'contains a replacement character');
  }
}

function validateString(errors, context, value) {
  if (!isNonEmptyString(value)) {
    addError(errors, context, 'must be a non-empty string');
  }
}

function validateStringList(errors, context, value) {
  if (!Array.isArray(value) || value.length === 0) {
    addError(errors, context, 'must be a non-empty string list');
    return;
  }

  value.forEach((item, index) => {
    validateString(errors, `${context}[${index}]`, item);
  });
}

function validateOptionalStringList(errors, context, value) {
  if (value === undefined) {
    return;
  }

  validateStringList(errors, context, value);
}

function validateRepairPolicy(errors, value, context) {
  if (!isRecord(value)) {
    addError(errors, context, 'must be an object');
    return;
  }

  validateString(errors, `${context}.unclear`, value.unclear);
  validateString(errors, `${context}.offTopic`, value.offTopic);
  validateString(errors, `${context}.correction`, value.correction);
  validateString(errors, `${context}.koreanOnly`, value.koreanOnly);
}

function validateManifest(errors, manifest, expectedCountField, context) {
  if (!isRecord(manifest)) {
    addError(errors, context, 'manifest must be an object');
    return [];
  }

  if (manifest.schemaVersion !== 1) {
    addError(errors, `${context}.schemaVersion`, 'must be 1');
  }

  if (!isValidDateString(manifest.publishedAt)) {
    addError(errors, `${context}.publishedAt`, 'must be a valid date string');
  }

  if (!Array.isArray(manifest.packs) || manifest.packs.length === 0) {
    addError(errors, `${context}.packs`, 'must be a non-empty array');
    return [];
  }

  const seenLevels = new Set();

  manifest.packs.forEach((entry, index) => {
    const entryContext = `${context}.packs[${index}]`;

    if (!isRecord(entry)) {
      addError(errors, entryContext, 'must be an object');
      return;
    }

    if (!LEVELS.includes(entry.level)) {
      addError(errors, `${entryContext}.level`, `must be one of ${LEVELS.join(', ')}`);
    } else if (seenLevels.has(entry.level)) {
      addError(errors, entryContext, `duplicate manifest level ${entry.level}`);
    } else {
      seenLevels.add(entry.level);
    }

    if (!isPositiveInteger(entry.version)) {
      addError(errors, `${entryContext}.version`, 'must be a positive integer');
    }

    if (!isSafePackPath(entry.path)) {
      addError(errors, `${entryContext}.path`, 'must be a safe relative pack path');
    }

    if (!isPositiveInteger(entry[expectedCountField])) {
      addError(errors, `${entryContext}.${expectedCountField}`, 'must be a positive integer');
    }
  });

  for (const level of LEVELS) {
    if (!seenLevels.has(level)) {
      addError(errors, context, `missing manifest level ${level}`);
    }
  }

  return manifest.packs.filter(isRecord);
}

function validateChoiceQuestion(errors, question, context) {
  if (!Array.isArray(question.choices) || question.choices.length !== 3) {
    addError(errors, `${context}.choices`, 'must contain exactly 3 choices');
    return {
      choiceCount: 1,
      writingCount: 0,
    };
  }

  const choiceIds = new Set();
  const choiceTexts = new Set();

  question.choices.forEach((choice, index) => {
    const choiceContext = `${context}.choices[${index}]`;

    if (!isRecord(choice)) {
      addError(errors, choiceContext, 'must be an object');
      return;
    }

    if (!isNonEmptyString(choice.id)) {
      addError(errors, `${choiceContext}.id`, 'choice id is empty');
    } else if (choiceIds.has(choice.id)) {
      addError(errors, choiceContext, `duplicate choice id ${choice.id}`);
    } else {
      choiceIds.add(choice.id);
    }

    if (!isNonEmptyString(choice.text)) {
      addError(errors, `${choiceContext}.text`, 'choice text is empty');
    } else {
      const normalizedChoiceText = normalizeVisibleQuestionPart(choice.text);

      if (choiceTexts.has(normalizedChoiceText)) {
        addError(errors, choiceContext, `duplicate choice text "${choice.text}"`);
      } else {
        choiceTexts.add(normalizedChoiceText);
      }
    }
  });

  if (!isNonEmptyString(question.correctChoiceId)) {
    addError(errors, `${context}.correctChoiceId`, 'must be a non-empty string');
  } else if (!question.choices.some((choice) => isRecord(choice) && choice.id === question.correctChoiceId)) {
    addError(errors, `${context}.correctChoiceId`, 'must reference an existing choice');
  }

  const correctChoice = question.choices.find((choice) => {
    return isRecord(choice) && choice.id === question.correctChoiceId;
  });

  if (
    isRecord(correctChoice) &&
    typeof question.questionText === 'string' &&
    correctChoice.text.trim() === question.questionText.trim()
  ) {
    addError(errors, context, 'correct choice must not be identical to questionText');
  }

  return {
    choiceCount: 1,
    writingCount: 0,
  };
}

function validateWritingQuestion(errors, question, context) {
  if (question.choices !== undefined) {
    addError(errors, context, 'writing question must not include choices');
  }

  if (question.correctChoiceId !== undefined) {
    addError(errors, context, 'writing question must not include correctChoiceId');
  }

  validateString(errors, `${context}.sampleAnswer`, question.sampleAnswer);
  validateKoreanField(errors, `${context}.evaluationFocusKo`, question.evaluationFocusKo);

  if (question.expectedKeywords !== undefined) {
    validateStringList(errors, `${context}.expectedKeywords`, question.expectedKeywords);
  }

  validateOptionalStringList(errors, `${context}.expectedKeywordsKo`, question.expectedKeywordsKo);

  if (question.answerLanguage !== undefined && !ANSWER_LANGUAGES.includes(question.answerLanguage)) {
    addError(errors, `${context}.answerLanguage`, `must be one of ${ANSWER_LANGUAGES.join(', ')}`);
  }

  if (question.answerLanguage === 'ko') {
    if (question.area !== 'reading') {
      addError(errors, `${context}.area`, 'Korean translation questions must be reading questions');
    }

    validateString(errors, `${context}.questionText`, question.questionText);

    if (
      !Number.isInteger(question.timeLimitSeconds) ||
      question.timeLimitSeconds < 30 ||
      question.timeLimitSeconds > 90
    ) {
      addError(errors, `${context}.timeLimitSeconds`, 'must be an integer from 30 to 90');
    }

    if (!READING_DIFFICULTIES.includes(question.readingDifficulty)) {
      addError(errors, `${context}.readingDifficulty`, `must be one of ${READING_DIFFICULTIES.join(', ')}`);
    }

    if (!Array.isArray(question.expectedKeywordsKo) || question.expectedKeywordsKo.length < 3) {
      addError(errors, `${context}.expectedKeywordsKo`, 'must contain at least 3 Korean keywords');
    } else {
      question.expectedKeywordsKo.forEach((keyword, index) => {
        validateKoreanField(errors, `${context}.expectedKeywordsKo[${index}]`, keyword);
      });
    }

    validateKoreanField(errors, `${context}.sampleAnswer`, question.sampleAnswer);
  } else if (question.timeLimitSeconds !== undefined || question.readingDifficulty !== undefined) {
    addError(errors, context, 'timed reading metadata requires answerLanguage ko');
  } else if (!EXPLICIT_ENGLISH_WRITING_PROMPT_PATTERN.test(question.promptKo)) {
    addError(
      errors,
      `${context}.promptKo`,
      'English writing prompt must include an explicit Korean target sentence',
    );
  }

  return {
    choiceCount: 0,
    writingCount: 1,
  };
}

function validateQuestion(errors, question, expectedLevel, idSet, context) {
  if (!isRecord(question)) {
    addError(errors, context, 'must be an object');
    return {
      choiceCount: 0,
      writingCount: 0,
    };
  }

  if (!isNonEmptyString(question.id)) {
    addError(errors, `${context}.id`, 'must be a non-empty string');
  } else if (idSet.has(question.id)) {
    addError(errors, context, `duplicate question id ${question.id}`);
  } else {
    idSet.add(question.id);
  }

  if (question.level !== expectedLevel) {
    addError(errors, `${context}.level`, `must match pack level ${expectedLevel}`);
  }

  if (!QUESTION_AREAS.includes(question.area)) {
    addError(errors, `${context}.area`, `must be one of ${QUESTION_AREAS.join(', ')}`);
  }

  validateKoreanField(errors, `${context}.promptKo`, question.promptKo);
  validateKoreanField(errors, `${context}.explanationKo`, question.explanationKo);
  validateKoreanField(errors, `${context}.weakPointLabel`, question.weakPointLabel);

  if (question.kind === 'choice') {
    return validateChoiceQuestion(errors, question, context);
  }

  if (question.kind === 'writing') {
    return validateWritingQuestion(errors, question, context);
  }

  addError(errors, `${context}.kind`, `must be one of ${QUESTION_KINDS.join(', ')}`);

  return {
    choiceCount: 0,
    writingCount: 0,
  };
}

function normalizeVisibleQuestionPart(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

function createVisibleQuestionKey(question) {
  return [
    question.level,
    question.area,
    question.kind,
    normalizeVisibleQuestionPart(question.promptKo),
    normalizeVisibleQuestionPart(question.questionText),
  ].join('::');
}

function validateQuestionPacks(root, errors) {
  const baseDir = join(root, 'public', 'question-packs');
  const manifest = readJson(join(baseDir, 'manifest.json'), errors, 'question manifest');
  const entries = validateManifest(errors, manifest, 'questionCount', 'question manifest');
  const summaries = [];
  const allQuestionIds = new Set();

  validateNoStalePackFiles(errors, baseDir, entries, 'question packs');

  for (const entry of entries) {
    const packPath = join(baseDir, entry.path);
    const pack = readJson(packPath, errors, `question pack ${entry.path}`);
    const context = `question pack ${entry.path}`;

    if (!isRecord(pack)) {
      continue;
    }

    if (pack.schemaVersion !== 1) {
      addError(errors, `${context}.schemaVersion`, 'must be 1');
    }

    if (pack.level !== entry.level) {
      addError(errors, `${context}.level`, `must match manifest level ${entry.level}`);
    }

    if (pack.version !== entry.version) {
      addError(errors, `${context}.version`, `must match manifest version ${entry.version}`);
    }

    if (!isValidDateString(pack.publishedAt)) {
      addError(errors, `${context}.publishedAt`, 'must be a valid date string');
    }

    if (!Array.isArray(pack.questions)) {
      addError(errors, `${context}.questions`, 'must be an array');
      continue;
    }

    if (pack.questions.length !== entry.questionCount) {
      addError(
        errors,
        `${context}.questions`,
        `count ${pack.questions.length} must match manifest questionCount ${entry.questionCount}`,
      );
    }

    let choiceCount = 0;
    let writingCount = 0;
    const areaCounts = {
      reading: 0,
      conversation: 0,
      grammar: 0,
    };
    const visibleQuestionKeys = new Map();

    pack.questions.forEach((question, index) => {
      const questionContext = `${context}.questions[${index}]`;
      const result = validateQuestion(errors, question, entry.level, allQuestionIds, questionContext);
      choiceCount += result.choiceCount;
      writingCount += result.writingCount;

      if (isRecord(question) && QUESTION_AREAS.includes(question.area)) {
        areaCounts[question.area] += 1;
      }

      if (
        isRecord(question) &&
        question.level === entry.level &&
        QUESTION_AREAS.includes(question.area) &&
        QUESTION_KINDS.includes(question.kind) &&
        isNonEmptyString(question.promptKo)
      ) {
        const visibleQuestionKey = createVisibleQuestionKey(question);
        const existingQuestionId = visibleQuestionKeys.get(visibleQuestionKey);

        if (existingQuestionId) {
          addError(
            errors,
            questionContext,
            `visible duplicate of ${existingQuestionId}: same level, area, kind, promptKo, and questionText`,
          );
        } else {
          visibleQuestionKeys.set(visibleQuestionKey, question.id);
        }
      }
    });

    if (pack.questions.length < MIN_QUESTION_COUNT) {
      addError(errors, context, `must contain at least ${MIN_QUESTION_COUNT} questions`);
    }

    if (writingCount < MIN_WRITING_QUESTION_COUNT) {
      addError(errors, context, `must contain at least ${MIN_WRITING_QUESTION_COUNT} writing questions`);
    }

    if (pack.questions.length < MIN_PROMOTION_ELIGIBLE_COUNT) {
      addError(
        errors,
        context,
        `must contain at least ${MIN_PROMOTION_ELIGIBLE_COUNT} promotion-eligible questions`,
      );
    }

    if (areaCounts.reading < 1 || areaCounts.conversation < 1 || areaCounts.grammar < 1) {
      addError(errors, context, 'must contain reading, conversation, and grammar questions');
    }

    summaries.push({
      level: entry.level,
      version: entry.version,
      path: entry.path,
      count: pack.questions.length,
      choiceCount,
      writingCount,
      readingCount: areaCounts.reading,
      conversationCount: areaCounts.conversation,
      grammarCount: areaCounts.grammar,
    });
  }

  return summaries;
}

function validateSlot(errors, slot, scenario, context) {
  if (!isRecord(slot)) {
    addError(errors, context, 'must be an object');
    return;
  }

  validateString(errors, `${context}.key`, slot.key);
  validateString(errors, `${context}.label`, slot.label);
  validateString(errors, `${context}.prompt`, slot.prompt);

  if (!Array.isArray(slot.matchKeywords) || slot.matchKeywords.length === 0) {
    addError(errors, `${context}.matchKeywords`, 'must be a non-empty string list');
    return;
  }

  if (slot.required !== undefined && typeof slot.required !== 'boolean') {
    addError(errors, `${context}.required`, 'required must be a boolean');
  }

  slot.matchKeywords.forEach((keyword, index) => {
    const keywordContext = `${context}.matchKeywords[${index}]`;

    if (!isNonEmptyString(keyword)) {
      addError(errors, keywordContext, 'must be a non-empty string');
      return;
    }

    const normalized = keyword.trim().toLowerCase();

    if (GENERIC_SLOT_KEYWORDS.has(normalized)) {
      addError(errors, keywordContext, `generic slot keyword "${keyword}" in scenario ${scenario.id}`);
    }
  });
}

function validateScenario(errors, scenario, expectedLevel, idSet, context) {
  if (!isRecord(scenario)) {
    addError(errors, context, 'must be an object');
    return;
  }

  if (!isNonEmptyString(scenario.id)) {
    addError(errors, `${context}.id`, 'must be a non-empty string');
  } else if (idSet.has(scenario.id)) {
    addError(errors, context, `duplicate scenario id ${scenario.id}`);
  } else {
    idSet.add(scenario.id);
  }

  if (scenario.level !== expectedLevel) {
    addError(errors, `${context}.level`, `must match pack level ${expectedLevel}`);
  }

  if (scenario.area !== 'conversation') {
    addError(errors, `${context}.area`, 'must be conversation');
  }

  validateKoreanField(errors, `${context}.titleKo`, scenario.titleKo);
  validateKoreanField(errors, `${context}.situationKo`, scenario.situationKo);
  validateKoreanField(errors, `${context}.descriptionKo`, scenario.descriptionKo);
  validateKoreanField(errors, `${context}.userGoalKo`, scenario.userGoalKo);
  validateString(errors, `${context}.titleEn`, scenario.titleEn);
  validateString(errors, `${context}.aiRole`, scenario.aiRole);
  validateString(errors, `${context}.userRole`, scenario.userRole);

  if (!SCENARIO_DIFFICULTIES.includes(scenario.difficulty)) {
    addError(errors, `${context}.difficulty`, `must be one of ${SCENARIO_DIFFICULTIES.join(', ')}`);
  }

  if (!isPositiveInteger(scenario.maxUserTurns)) {
    addError(errors, `${context}.maxUserTurns`, 'must be a positive integer');
  }

  validateStringList(errors, `${context}.targetExpressions`, scenario.targetExpressions);

  if (!Array.isArray(scenario.targetSkills) || scenario.targetSkills.length === 0) {
    addError(errors, `${context}.targetSkills`, 'must be a non-empty skill tag list');
  } else {
    scenario.targetSkills.forEach((tag, index) => {
      if (!SKILL_TAGS.includes(tag)) {
        addError(errors, `${context}.targetSkills[${index}]`, `unknown skill tag ${String(tag)}`);
      }
    });
  }

  validateString(errors, `${context}.openingMessage`, scenario.openingMessage);
  validateString(errors, `${context}.completionMessage`, scenario.completionMessage);
  validateRepairPolicy(errors, scenario.repairPolicy, `${context}.repairPolicy`);
  validateStringList(errors, `${context}.successCriteria`, scenario.successCriteria);

  if (!Array.isArray(scenario.requiredSlots) || scenario.requiredSlots.length === 0) {
    addError(errors, `${context}.requiredSlots`, 'must be a non-empty array');
    return;
  }

  const slotKeys = new Set();

  scenario.requiredSlots.forEach((slot, index) => {
    if (isRecord(slot) && isNonEmptyString(slot.key)) {
      if (slotKeys.has(slot.key)) {
        addError(errors, `${context}.requiredSlots[${index}]`, `duplicate required slot key ${slot.key}`);
      } else {
        slotKeys.add(slot.key);
      }
    }

    validateSlot(errors, slot, scenario, `${context}.requiredSlots[${index}]`);
  });
}

function validateConversationPacks(root, errors) {
  const baseDir = join(root, 'public', 'conversation-scenarios');
  const manifest = readJson(join(baseDir, 'manifest.json'), errors, 'conversation manifest');
  const entries = validateManifest(errors, manifest, 'scenarioCount', 'conversation manifest');
  const summaries = [];
  const allScenarioIds = new Set();

  validateNoStalePackFiles(errors, baseDir, entries, 'conversation packs');

  for (const entry of entries) {
    const packPath = join(baseDir, entry.path);
    const pack = readJson(packPath, errors, `conversation pack ${entry.path}`);
    const context = `conversation pack ${entry.path}`;

    if (!isRecord(pack)) {
      continue;
    }

    if (pack.schemaVersion !== 1) {
      addError(errors, `${context}.schemaVersion`, 'must be 1');
    }

    if (pack.level !== entry.level) {
      addError(errors, `${context}.level`, `must match manifest level ${entry.level}`);
    }

    if (pack.version !== entry.version) {
      addError(errors, `${context}.version`, `must match manifest version ${entry.version}`);
    }

    if (!isValidDateString(pack.publishedAt)) {
      addError(errors, `${context}.publishedAt`, 'must be a valid date string');
    }

    if (!Array.isArray(pack.scenarios)) {
      addError(errors, `${context}.scenarios`, 'must be an array');
      continue;
    }

    if (pack.scenarios.length !== entry.scenarioCount) {
      addError(
        errors,
        `${context}.scenarios`,
        `count ${pack.scenarios.length} must match manifest scenarioCount ${entry.scenarioCount}`,
      );
    }

    let slotCount = 0;

    pack.scenarios.forEach((scenario, index) => {
      if (isRecord(scenario) && Array.isArray(scenario.requiredSlots)) {
        slotCount += scenario.requiredSlots.length;
      }

      validateScenario(errors, scenario, entry.level, allScenarioIds, `${context}.scenarios[${index}]`);
    });

    summaries.push({
      level: entry.level,
      version: entry.version,
      path: entry.path,
      count: pack.scenarios.length,
      slotCount,
    });
  }

  return summaries;
}

function buildReport(root) {
  const errors = [];
  const questionPacks = validateQuestionPacks(root, errors);
  const conversationPacks = validateConversationPacks(root, errors);

  return {
    ok: errors.length === 0,
    root,
    questionPacks,
    conversationPacks,
    totals: {
      questions: questionPacks.reduce((sum, pack) => sum + pack.count, 0),
      scenarios: conversationPacks.reduce((sum, pack) => sum + pack.count, 0),
    },
    errors,
  };
}

function printTextReport(report) {
  const lines = [];

  lines.push(report.ok ? 'Content validation passed.' : 'Content validation failed.');
  lines.push('');
  lines.push('Question packs:');

  for (const pack of report.questionPacks) {
    lines.push(
      `- ${pack.level} v${pack.version} ${pack.path}: ${pack.count} questions (${pack.choiceCount} choice, ${pack.writingCount} writing, ${pack.readingCount} reading, ${pack.conversationCount} conversation, ${pack.grammarCount} grammar)`,
    );
  }

  lines.push('');
  lines.push('Conversation scenario packs:');

  for (const pack of report.conversationPacks) {
    lines.push(`- ${pack.level} v${pack.version} ${pack.path}: ${pack.count} scenarios (${pack.slotCount} slots)`);
  }

  lines.push('');
  lines.push(`Totals: ${report.totals.questions} questions, ${report.totals.scenarios} scenarios`);

  if (report.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
  }

  console.log(lines.join('\n'));
}

function printHelp() {
  console.log(`Usage: node scripts/validate-content.mjs [--json] [--root <repo-root>]

Validates published question packs and conversation scenario packs under public/.

Options:
  --json          Print a machine-readable JSON report.
  --root <path>   Validate a different repository/content root.
  -h, --help      Show this help text.`);
}

function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const report = buildReport(options.root);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  process.exitCode = report.ok ? 0 : 1;
}

main();
