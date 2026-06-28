import { StyleSheet, Text, View } from 'react-native';

type WeaknessTagProps = {
  label: string;
};

export function WeaknessTag({ label }: WeaknessTagProps) {
  return (
    <View style={styles.tag}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: '#f7e6dd',
    borderColor: '#efc6b5',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  label: {
    color: '#733c2d',
    fontSize: 13,
    fontWeight: '700',
  },
});

