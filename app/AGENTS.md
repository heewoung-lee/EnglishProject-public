# App Agent Instructions

Follow the repository-wide loop in `../AGENTS.md` first:

1. Skill gate with `superpowers:using-superpowers` when available.
2. Work loop for implementation, debugging, and review.
3. Verification gate with `superpowers:verification-before-completion` before any completion claim.
4. Review gate against the user goal and product logic.
5. Compound gate with `ce-compound` when solved work creates durable knowledge.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing Expo, React Native, native build, or app configuration code.

## App Verification

Use the smallest fresh command set that proves the change:

- `npm --prefix app run typecheck`
- `npm --prefix app test`
- `npm --prefix app run content:validate`
- `npm --prefix app run build:android:release` when APK or native Android output is affected
