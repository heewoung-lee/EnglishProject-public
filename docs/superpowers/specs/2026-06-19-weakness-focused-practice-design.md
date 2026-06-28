# Weakness-Focused Practice Design

## Goal

Train the learner mostly on their weak points while keeping enough variety to avoid repetitive drilling.

## Product Rule

Practice sessions use a 70/30 mix:

- 70% weakness-focused questions.
- 30% maintenance or fresh questions.

Because the current practice set has 3 questions, this becomes:

- 2 weakness-focused questions.
- 1 maintenance or fresh question.

Promotion exams remain balanced assessments and do not use weakness-heavy selection.

## Weakness Signals

The app should use local learner state first:

- `recentResults.weakAreas`
- `recentResults.weakSkillTags`
- `questionStats`
- `skillStats`

Weakness is inferred when:

- a skill or question has low recent score,
- a skill or question has low accuracy,
- a recent session marked an area or skill as weak.

## Selection Behavior

For practice sessions:

1. Build the current-level question queue.
2. Exclude recently correct questions when enough fresh questions exist.
3. Rank fresh questions by weak skill tags first, then weak areas.
4. Select about 70% from weak-matching questions.
5. Select the remaining questions from fresh non-weak questions.
6. If there are not enough fresh questions, allow previously incorrect questions before correct ones.

## Non-Goals

- No server-side learner profile yet.
- No new remote database schema.
- No UI dashboard in this first pass.
- No change to promotion exam selection.

## Verification

- Unit tests prove local `skillStats` can drive selection even without recent weak results.
- Unit tests prove a 3-question practice set contains 2 weak questions and 1 balance question when enough questions exist.
- Existing no-repeat and incorrect-review behavior must keep passing.
