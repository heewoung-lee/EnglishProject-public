import { StyleSheet, Text, View } from 'react-native';

import { studyColors, studyRadius } from '../theme/studyDesign';
import type { LearnerLevel } from '../types/learning';

type LevelAreaBadgeProps = {
  level: LearnerLevel;
  areaLabel: string;
  rate?: number;
};

export const LEVEL_BADGE_TONES: Record<
  LearnerLevel,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  A1: {
    backgroundColor: studyColors.primarySoft,
    borderColor: studyColors.border,
    textColor: studyColors.primary,
  },
  A2: {
    backgroundColor: studyColors.canvasAlt,
    borderColor: studyColors.border,
    textColor: studyColors.primary,
  },
  B1: {
    backgroundColor: studyColors.accentSoft,
    borderColor: studyColors.border,
    textColor: studyColors.dangerText,
  },
  B2: {
    backgroundColor: studyColors.accentSoft,
    borderColor: studyColors.border,
    textColor: studyColors.dangerText,
  },
};

export const LEVEL_DISPLAY_NAMES: Record<LearnerLevel, string> = {
  A1: '입문',
  A2: '초급',
  B1: '중급',
  B2: '중상급',
};

export function getLevelDisplayName(level: LearnerLevel) {
  return LEVEL_DISPLAY_NAMES[level];
}

export function formatLevelTransitionLabel(fromLevel: LearnerLevel, toLevel: LearnerLevel) {
  return `${getLevelDisplayName(fromLevel)} -> ${getLevelDisplayName(toLevel)}`;
}

export function LevelAreaBadge({ level, areaLabel, rate }: LevelAreaBadgeProps) {
  const tone = LEVEL_BADGE_TONES[level];
  const levelDisplayName = getLevelDisplayName(level);
  const accessibilityLabel = rate === undefined
    ? `${levelDisplayName} 단계 ${areaLabel}`
    : `${levelDisplayName} 단계 ${areaLabel} Rate ${rate}`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
    >
      <View
        style={[
          styles.badgeBase,
          styles.levelBadge,
          {
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
          },
        ]}
      >
        <Text style={[styles.levelText, { color: tone.textColor }]}>{levelDisplayName}</Text>
      </View>
      <View style={[styles.badgeBase, styles.areaBadge]}>
        <Text style={styles.areaText}>{areaLabel}</Text>
      </View>
      {rate !== undefined ? (
        <View style={[styles.badgeBase, styles.rateBadge]}>
          <Text style={styles.rateText}>Rate {rate}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    minHeight: 30,
  },
  badgeBase: {
    alignItems: 'center',
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  levelBadge: {
    minWidth: 58,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  areaBadge: {
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    minWidth: 42,
  },
  areaText: {
    color: studyColors.textSoft,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  rateBadge: {
    backgroundColor: studyColors.primarySoft,
    borderColor: studyColors.border,
    minWidth: 72,
  },
  rateText: {
    color: studyColors.primary,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
});
