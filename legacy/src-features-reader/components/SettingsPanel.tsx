import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlipMode, readerThemes, useReaderStore } from '@/features/reader/store/readerStore';

type SettingsPanelProps = {
  onClose: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useReaderStore();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={styles.container}>
      <Pressable style={styles.mask} onPress={onClose} />

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>阅读设置</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={18} color="#F5E8C7" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>字号</Text>
          <View style={styles.fontRow}>
            <Pressable
              style={styles.btn}
              onPress={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 2) })}>
              <Text style={styles.btnText}>A-</Text>
            </Pressable>
            <View style={styles.valueChip}>
              <Text style={styles.valueText}>{settings.fontSize}</Text>
            </View>
            <Pressable
              style={styles.btn}
              onPress={() => updateSettings({ fontSize: Math.min(30, settings.fontSize + 2) })}>
              <Text style={styles.btnText}>A+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>背景</Text>
          <View style={styles.themes}>
            {readerThemes.map((theme) => (
              <Pressable
                key={theme.name}
                style={[
                  styles.themeCircle,
                  { backgroundColor: theme.backgroundColor },
                  settings.theme.name === theme.name && styles.themeActive,
                ]}
                onPress={() => updateSettings({ theme })}>
                {settings.theme.name === theme.name && <View style={styles.themeInner} />}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>翻页</Text>
          <View style={styles.modeGroup}>
            {(['horizontal', 'vertical'] as FlipMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.modeBtn, settings.flipMode === mode && styles.modeBtnActive]}
                onPress={() => updateSettings({ flipMode: mode })}>
                <Text style={[styles.modeText, settings.flipMode === mode && styles.modeTextActive]}>
                  {mode === 'horizontal' ? '左右滑动' : '上下滚动'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.label}>行距</Text>
          <View style={styles.fontRow}>
            <Pressable
              style={styles.btn}
              onPress={() => updateSettings({ lineHeight: Math.max(1.3, +(settings.lineHeight - 0.05).toFixed(2)) })}>
              <Text style={styles.btnText}>-</Text>
            </Pressable>
            <View style={styles.valueChip}>
              <Text style={styles.valueText}>{settings.lineHeight.toFixed(2)}</Text>
            </View>
            <Pressable
              style={styles.btn}
              onPress={() => updateSettings({ lineHeight: Math.min(2.0, +(settings.lineHeight + 0.05).toFixed(2)) })}>
              <Text style={styles.btnText}>+</Text>
            </Pressable>
          </View>
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  panel: {
    backgroundColor: '#16171B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#F5E8C7',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  label: {
    color: 'rgba(245,232,199,0.72)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    minWidth: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#F5E8C7',
    fontSize: 16,
    fontWeight: '600',
  },
  valueChip: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,232,199,0.08)',
  },
  valueText: {
    color: '#F5E8C7',
    fontSize: 16,
    fontWeight: '700',
  },
  themes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  themeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeActive: {
    borderColor: '#F5E8C7',
  },
  themeInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modeGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#F5E8C7',
  },
  modeText: {
    color: 'rgba(245,232,199,0.68)',
    fontSize: 14,
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#1B1C20',
    fontWeight: '600',
  },
  sectionLast: {
    marginBottom: 0,
  },
});
