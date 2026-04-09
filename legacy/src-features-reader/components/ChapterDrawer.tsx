import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReaderStore } from '@/features/reader/store/readerStore';

type ChapterDrawerProps = {
  onClose: () => void;
};

export function ChapterDrawer({ onClose }: ChapterDrawerProps) {
  const { currentChapter, currentBook, chapterList, loadChapter } = useReaderStore();
  const insets = useSafeAreaInsets();

  const handleSelect = (index: number) => {
    if (currentBook) {
      loadChapter(String(currentBook.id), index);
      onClose();
    }
  };

  return (
    <Animated.View entering={SlideInLeft.springify()} exiting={SlideOutLeft} style={styles.container}>
      <View style={[styles.drawer, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.header}>目录</Text>
              <Text style={styles.subheader} numberOfLines={1}>
                {currentBook?.title}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={18} color="#2A251D" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {chapterList.map((chapter, index) => (
              <Pressable
                key={chapter.id}
                style={[
                  styles.chapterItem,
                  currentChapter?.chapterIndex === index && styles.chapterItemActive,
                ]}
                onPress={() => handleSelect(index)}>
                <Text style={styles.chapterIndex}>{String(chapter.chapterNo).padStart(3, '0')}</Text>
                <Text
                  style={[
                    styles.chapterText,
                    currentChapter?.chapterIndex === index && styles.activeText,
                  ]}>
                  {chapter.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
      <Pressable style={styles.mask} onPress={onClose} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    flexDirection: 'row',
  },
  drawer: {
    width: '82%',
    backgroundColor: '#F6EDDD',
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2A251D',
  },
  subheader: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(42,37,29,0.6)',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,37,29,0.08)',
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 8,
  },
  chapterItemActive: {
    backgroundColor: '#E8D6B3',
  },
  chapterIndex: {
    width: 34,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(42,37,29,0.42)',
  },
  chapterText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(42,37,29,0.76)',
    lineHeight: 22,
  },
  activeText: {
    color: '#2A251D',
    fontWeight: '700',
  },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
});
