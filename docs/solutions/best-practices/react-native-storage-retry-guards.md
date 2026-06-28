---
title: React Native storage retries need synchronous guards
date: 2026-06-08
category: docs/solutions/best-practices
module: React Native storage retry UI
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - "Handling local storage save or load failures from UI screens"
  - "Retrying a failed async write while preserving user progress in memory"
  - "Reviewing React state-based guards around async submit handlers"
tags: [react-native, async-storage, retry-flow, stale-state, review-learning]
---

# React Native storage retries need synchronous guards

## Context
The local learning flow added retryable error handling for `AsyncStorage` read and write failures. The first implementation used React state such as `isStorageRetrying` to disable retries, but code review found that fast repeated taps can happen before React commits the state update.

That leaves a stale async save or retry able to complete later and re-apply older UI state. For a learning app, that can mean a previous result overwrites the latest local progress.

## Guidance
Use a synchronous `useRef` guard for async UI boundaries that must be single-flight. For writes that persist state, pair the guard with a request id or equivalent freshness check before applying the result back to React state.

The useful shape is:

```tsx
const saveInFlightRef = useRef(false);
const latestSaveRequestIdRef = useRef(0);

async function persistSave(payload: PendingSave) {
  if (saveInFlightRef.current) {
    return;
  }

  const requestId = latestSaveRequestIdRef.current + 1;
  latestSaveRequestIdRef.current = requestId;
  saveInFlightRef.current = true;

  try {
    const persistedState = await saveLearningState(payload.nextState);

    if (latestSaveRequestIdRef.current !== requestId) {
      return;
    }

    setLearningState(persistedState);
    setMode(payload.successMode);
  } catch {
    if (latestSaveRequestIdRef.current !== requestId) {
      return;
    }

    setPendingSave(payload);
    setMode('storageError');
  } finally {
    saveInFlightRef.current = false;
  }
}
```

Keep React state for rendering, such as showing disabled buttons or retry labels. Do not rely on it as the only in-flight lock for submit, save, or retry handlers.

## Why This Matters
React state updates are asynchronous and are not a mutex. A user can trigger a second submit or retry before state-driven disabled UI takes effect. If both operations write local state, the slower operation can finish last and make the app look like progress moved backward.

The ref guard closes the synchronous tap window. The freshness check prevents an older async completion from applying UI state after a newer request has superseded it.

## When to Apply
- Use it when an async handler writes durable user progress.
- Use it when a retry button repeats the exact same pending save.
- Use it when a result screen must only appear after the persisted state has been confirmed.
- Re-check it during code review whenever a component uses React state as the only duplicate-submit guard.

## Examples
Before:

```tsx
if (isRetrying) {
  return;
}

setIsRetrying(true);
await saveLearningState(nextState);
setLearningState(nextState);
```

After:

```tsx
if (retryInFlightRef.current) {
  return;
}

retryInFlightRef.current = true;

try {
  const persistedState = await saveLearningState(nextState);
  setLearningState(persistedState);
} finally {
  retryInFlightRef.current = false;
}
```

## Related
- app/App.tsx
- app/src/services/learningStorage.ts
