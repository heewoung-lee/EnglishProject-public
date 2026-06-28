# Agent Operating Instructions

These instructions apply repository-wide.

## Required Work Loop

Every agent must run the same decision loop for every user request:

1. Skill gate
   - Before acting, check whether the user's request names or matches an available skill.
   - If a skill applies, use it before taking task actions.
   - When available, start from `superpowers:using-superpowers` before any response or action so the agent does not skip skill routing.
   - If no skill applies, state that only when useful and continue normally.

2. Work loop
   - For implementation plans, use `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
   - For bugs, failures, or unexpected behavior, use `superpowers:systematic-debugging`.
   - For substantial feature work, keep the task broken into explicit steps and revise when the result does not match the user goal.

3. Verification gate
   - Before claiming work is complete, fixed, passing, ready, or safe to ship, use `superpowers:verification-before-completion`.
   - Run fresh verification commands in the current session and read the output before making any success claim.
   - If verification cannot be run, say exactly what was not verified and why.

4. Review gate
   - Compare the result against the user's stated goal and the product logic.
   - If the implementation passes tests but does not fit the product goal, revise instead of shipping.

5. Compound gate
   - If the work reveals a durable project lesson that will save future time, use `ce-compound` when available.
   - Store solution knowledge under `docs/solutions/`, organized by category with YAML frontmatter such as `module`, `tags`, and `problem_type`.
   - Search `docs/solutions/` when implementing, debugging, or making decisions in an area that may already have documented learnings.
   - Do not create learning docs for one-off or obvious facts.

## Project Verification Commands

Choose the smallest command set that proves the claim being made.

- App type check: `npm --prefix app run typecheck`
- App tests: `npm --prefix app test`
- Content validation: `npm --prefix app run content:validate`
- Server syntax check: `npm --prefix server run check`
- Server tests: `npm --prefix server test`
- Root type check shortcut: `npm run typecheck`
- Android release build, when APK or native build output is affected: `npm --prefix app run build:android:release`

## Project Context

- `app/` contains the Expo React Native client.
- `server/` contains the Firebase Functions API server.
- `public/` contains Firebase Hosting assets and learning content packs.
- `docs/` contains product, design, QA, and planning documents.
- `docs/solutions/` contains documented solutions to past problems, best practices, workflow patterns, and other durable learnings.
- `.codex/ralph-loop/STATE.md`, when present locally, describes the top-level Ralph loop state.

## Safety Rules

- Do not revert or overwrite unrelated user changes.
- Keep edits scoped to the requested task.
- Do not commit secrets or real API keys.
- Prefer updating existing project patterns over introducing new structure.
