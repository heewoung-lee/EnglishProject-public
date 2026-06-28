# Mobile Study Design Refresh

## Visual Thesis

The app should feel like a calm daily study workspace: off-white canvas, deep teal primary actions, sage surfaces, and warm coral only for timer pressure, score emphasis, or incorrect feedback.

## Scope

This pass applies the approved mockup direction to the three most-used learning surfaces:

- Practice question screen
- Practice result and explanation screen
- Conversation practice screen

Promotion and secondary result screens can inherit these tokens in a later pass, but this pass keeps the implementation focused.

## Layout Rules

- Keep submit and chat composer controls fixed outside scrollable content.
- Align `Rate` pills and settings space consistently with the current header model.
- Use 8px radius across controls, cards, and chips.
- Avoid nested cards. Use cards only for actual interactive answers, feedback items, or input panels.
- Separate reading passages from answer inputs with a subtle surface block.

## UI Details

- Practice questions use a compact meta row for progress and timed translation countdowns.
- Timed translation passages sit in a `readBlock`; text answers sit in an `answerPanel`.
- Result screens use a `resultHero` for rate/summary and scannable `explanationCard` feedback.
- Conversation screens use a `headerShell`, `goalPanel`, and sticky `composer`.

## Verification

- Source guard tests ensure the key screen structure and shared token import remain in place.
- Existing mobile guardrail tests continue to protect keyboard-safe footers and chat scrolling.
- Full app tests, typecheck, and local APK build verify integration.
