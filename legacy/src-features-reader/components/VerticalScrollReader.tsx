import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useReaderStore } from '@/features/reader/store/readerStore';

export function VerticalScrollReader() {
  const { pages, settings, toggleOverlay, currentPageIndex, setCurrentPage, currentChapter } = useReaderStore();
  const scrollRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const restoredChapterIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentChapter || !pages.length) {
      return;
    }

    if (restoredChapterIdRef.current === currentChapter.id) {
      return;
    }

    restoredChapterIdRef.current = currentChapter.id;
    const offsetY = Math.max(0, currentPageIndex) * screenHeight;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: offsetY, animated: false });
    });
  }, [currentChapter, currentPageIndex, pages.length, screenHeight]);

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const zone = event.x / screenWidth;
    if (zone >= 0.33 && zone <= 0.66) {
      runOnJS(toggleOverlay)();
    }
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const newIndex = Math.max(0, Math.min(pages.length - 1, Math.floor(offsetY / screenHeight)));
    setCurrentPage(newIndex);
  };

  if (!pages.length) {
    return null;
  }

  return (
    <GestureDetector gesture={tapGesture}>
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.pageContainer}>
          <Text
            style={{
              color: settings.theme.textColor,
              fontSize: settings.fontSize,
              lineHeight: settings.fontSize * settings.lineHeight,
              fontFamily: settings.fontFamily,
            }}>
            {currentChapter?.title}
          </Text>
          <Text
            style={[
              styles.contentText,
              {
                color: settings.theme.textColor,
                fontSize: settings.fontSize,
                lineHeight: settings.fontSize * settings.lineHeight,
                fontFamily: settings.fontFamily,
              },
            ]}>
            {currentChapter?.content}
          </Text>
        </View>
      </ScrollView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 64,
  },
  pageContainer: {
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  contentText: {
    marginTop: 20,
  },
});
