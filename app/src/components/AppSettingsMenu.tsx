import { Pressable, StyleSheet, Text, View } from 'react-native';

type AppSettingsMenuProps = {
  visible: boolean;
  isResettingLevel: boolean;
  topOffset: number;
  useDarkTheme?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onResetLevel: () => void;
  onExit: () => void;
};

export function AppSettingsMenu({
  visible,
  isResettingLevel,
  topOffset,
  useDarkTheme = false,
  onOpen,
  onClose,
  onResetLevel,
  onExit,
}: AppSettingsMenuProps) {
  return (
    <View pointerEvents="box-none" style={styles.host}>
      {visible ? (
        <Pressable
          accessibilityLabel="설정 메뉴 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dismissLayer}
        />
      ) : null}

      <Pressable
        accessibilityLabel="설정"
        accessibilityRole="button"
        hitSlop={8}
        onPress={visible ? onClose : onOpen}
        style={[
          styles.settingsButton,
          { top: topOffset },
          useDarkTheme ? styles.darkSettingsButton : null,
        ]}
      >
        <Text style={[styles.settingsIcon, useDarkTheme ? styles.darkSettingsIcon : null]}>⚙</Text>
      </Pressable>

      {visible ? (
        <View
          style={[
            styles.menu,
            { top: topOffset + 46 },
            useDarkTheme ? styles.darkMenu : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            disabled={isResettingLevel}
            onPress={onResetLevel}
            style={[styles.menuItem, isResettingLevel ? styles.disabledItem : null]}
          >
            <Text style={styles.resetText}>
              {isResettingLevel ? '초기화 중' : '레벨 초기화'}
            </Text>
          </Pressable>
          <View style={[styles.divider, useDarkTheme ? styles.darkDivider : null]} />
          <Pressable accessibilityRole="button" onPress={onExit} style={styles.menuItem}>
            <Text style={[styles.exitText, useDarkTheme ? styles.darkExitText : null]}>종료</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  dismissLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d7ded8',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    width: 40,
    zIndex: 4,
  },
  darkSettingsButton: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
  },
  settingsIcon: {
    color: '#176b5d',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  darkSettingsIcon: {
    color: '#d9b66b',
  },
  menu: {
    backgroundColor: '#ffffff',
    borderColor: '#d7ded8',
    borderRadius: 8,
    borderWidth: 1,
    position: 'absolute',
    right: 12,
    width: 156,
    zIndex: 3,
  },
  darkMenu: {
    backgroundColor: '#173737',
    borderColor: '#42605b',
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  disabledItem: {
    opacity: 0.5,
  },
  resetText: {
    color: '#9b4d2f',
    fontSize: 15,
    fontWeight: '900',
  },
  exitText: {
    color: '#232927',
    fontSize: 15,
    fontWeight: '900',
  },
  darkExitText: {
    color: '#ffffff',
  },
  divider: {
    backgroundColor: '#e3e8e3',
    height: 1,
  },
  darkDivider: {
    backgroundColor: '#42605b',
  },
});
