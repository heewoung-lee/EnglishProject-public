import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { getBannerAdUnitId } from '../services/adConfig';
import { studyColors, studyRadius } from '../theme/studyDesign';

export function AdBanner() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const unitId = getBannerAdUnitId(Platform.OS);

  if (!unitId || hasFailed) {
    return null;
  }

  return (
    <View
      accessibilityLabel="광고"
      style={[styles.container, !isLoaded && styles.hiddenUntilLoaded]}
    >
      <BannerAd
        onAdFailedToLoad={() => setHasFailed(true)}
        onAdLoaded={() => setIsLoaded(true)}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        size={BannerAdSize.BANNER}
        unitId={unitId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: studyColors.surface,
    borderColor: studyColors.border,
    borderRadius: studyRadius.sm,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  hiddenUntilLoaded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 50,
    paddingVertical: 0,
  },
});
