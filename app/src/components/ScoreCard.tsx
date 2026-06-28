import { StyleSheet, Text, View } from 'react-native';

type ScoreCardProps = {
  label: string;
  score: number;
  max: number;
};

export function ScoreCard({ label, score, max }: ScoreCardProps) {
  const ratio = Math.max(0, Math.min(1, score / max));

  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {score}/{max}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    marginBottom: 14,
  },
  labelGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#303633',
    fontSize: 14,
    fontWeight: '700',
  },
  value: {
    color: '#606a65',
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    backgroundColor: '#e1e6e0',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#db6f4b',
    borderRadius: 999,
    height: '100%',
  },
});

