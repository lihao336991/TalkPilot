import React from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useReaderStore } from '@/features/reader/store/readerStore';

type ReaderOverlayProps = {
  onOpenSettings: () => void;
  onOpenCatalog: () => void;
};

export function ReaderOverlay({ onOpenSettings, onOpenCatalog }: ReaderOverlayProps) {
  const router = useRouter();
  const { currentBook, currentChapter, toggleOverlay, pages, currentPageIndex } = useReaderStore();
  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.overlay}>
      <Pressable style={styles.backgroundMask} onPress={toggleOverlay} />

      <SafeAreaView style={styles.topBar}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="chevron-down" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.bookTitle} numberOfLines={1}>
              {currentBook?.title}
            </Text>
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {currentChapter?.title}
            </Text>
          </View>
          <View style={styles.iconButton} />
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{currentPageIndex + 1}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{pages.length}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={onOpenCatalog} style={styles.controlBtn}>
            <Feather name="list" size={20} color="#FFF" />
            <Text style={styles.controlText}>目录</Text>
          </Pressable>
          <Pressable onPress={onOpenSettings} style={styles.controlBtn}>
            <Feather name="settings" size={20} color="#FFF" />
            <Text style={styles.controlText}>设置</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backgroundMask: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bookTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  chapterTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 999,
  },
  progressText: {
    color: '#FFF',
    fontSize: 12,
    minWidth: 22,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 2,
    paddingBottom: 12,
  },
  controlBtn: {
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  controlText: {
    color: '#FFF',
    fontSize: 12,
  },
});
