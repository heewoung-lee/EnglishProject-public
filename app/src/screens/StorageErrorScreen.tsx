import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStorageErrorCopy } from '../services/storageErrorCopy';
import type { StorageErrorOperation } from '../types/learning';

const STORAGE_ERROR_KICKER = '저장소 오류';
const STORAGE_ERROR_RETRYING_TEXT = '다시 시도 중...';

type StorageErrorScreenProps = {
  operation: StorageErrorOperation;
  isRetrying: boolean;
  onRetry: () => void;
};

export function StorageErrorScreen({
  operation,
  isRetrying,
  onRetry,
}: StorageErrorScreenProps) {
  const copy = getStorageErrorCopy(operation);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.kicker}>{STORAGE_ERROR_KICKER}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.description}>{copy.description}</Text>

        <Pressable
          accessibilityRole="button"
          disabled={isRetrying}
          onPress={onRetry}
          style={[styles.retryButton, isRetrying ? styles.disabledButton : null]}
        >
          {isRetrying ? (
            <View style={styles.retryingContent}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.retryButtonText}>{STORAGE_ERROR_RETRYING_TEXT}</Text>
            </View>
          ) : (
            <Text style={styles.retryButtonText}>{copy.retryButtonLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f6f8f5',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 420,
    width: '100%',
  },
  kicker: {
    color: '#24715f',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    color: '#202624',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 36,
    textAlign: 'center',
  },
  description: {
    color: '#4d5752',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#24715f',
    borderRadius: 8,
    marginTop: 28,
    paddingVertical: 15,
  },
  disabledButton: {
    opacity: 0.6,
  },
  retryingContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
