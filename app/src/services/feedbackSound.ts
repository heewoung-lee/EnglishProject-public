import { useCallback, useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import type { FeedbackSoundCue } from './feedbackMotion';

const setProgressSound = require('../../assets/sounds/set-progress.wav');
const setPerfectSound = require('../../assets/sounds/set-perfect.wav');
const promotionReadySound = require('../../assets/sounds/promotion-ready.wav');
const promotionPassedSound = require('../../assets/sounds/promotion-passed.wav');
const promotionRetrySound = require('../../assets/sounds/promotion-retry.wav');

type FeedbackPlayer = {
  seekTo: (seconds: number) => void;
  play: () => void;
};

export function useFeedbackSounds(enabled = true): (cue: FeedbackSoundCue) => void {
  const setProgressPlayer = useAudioPlayer(setProgressSound) as FeedbackPlayer;
  const setPerfectPlayer = useAudioPlayer(setPerfectSound) as FeedbackPlayer;
  const promotionReadyPlayer = useAudioPlayer(promotionReadySound) as FeedbackPlayer;
  const promotionPassedPlayer = useAudioPlayer(promotionPassedSound) as FeedbackPlayer;
  const promotionRetryPlayer = useAudioPlayer(promotionRetrySound) as FeedbackPlayer;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch((error) => {
      console.warn('Failed to configure feedback audio mode.', error);
    });
  }, []);

  return useCallback((cue: FeedbackSoundCue) => {
    if (!enabled) {
      return;
    }

    if (Platform.OS === 'web') {
      return;
    }

    const players: Record<FeedbackSoundCue, FeedbackPlayer> = {
      setProgress: setProgressPlayer,
      setPerfect: setPerfectPlayer,
      promotionReady: promotionReadyPlayer,
      promotionPassed: promotionPassedPlayer,
      promotionRetry: promotionRetryPlayer,
    };
    const player = players[cue];

    try {
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn('Failed to play feedback sound.', error);
    }
  }, [
    enabled,
    promotionPassedPlayer,
    promotionReadyPlayer,
    promotionRetryPlayer,
    setPerfectPlayer,
    setProgressPlayer,
  ]);
}
