import React, { useLayoutEffect } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReaderStore } from '@/features/reader/store/readerStore';
import type { Page } from '@/shared/utils/paginator';

export function HorizontalFlipReader() {
  const {
    pages,
    currentPageIndex,
    settings,
    toggleOverlay,
    currentChapter,
    chapterList,
    ensureChapterPaginated,
    getFlatWindow,
    moveByDelta,
    isOverlayVisible,
  } = useReaderStore();

  const screenWidth = Dimensions.get('window').width;
  const stripTranslateX = useSharedValue(-screenWidth);
  const isAnimating = useSharedValue(false);
  const boundaryProbe = useSharedValue(0);
  const currentChapterIndex = currentChapter?.chapterIndex ?? 0;
  const { pages: flatPages, baseOffset } = getFlatWindow();
  const globalIndex = baseOffset + currentPageIndex;
  const prevPage = flatPages[globalIndex - 1];
  const currentPage = flatPages[globalIndex];
  const nextPage = flatPages[globalIndex + 1];
  const hasPrevPage = !!prevPage || currentChapterIndex > 0 || currentPageIndex > 0;
  const hasNextPage = !!nextPage || currentChapterIndex < chapterList.length - 1 || currentPageIndex < pages.length - 1;

  useLayoutEffect(() => {
    stripTranslateX.value = -screenWidth;
    isAnimating.value = false;
    void Promise.all([ensureChapterPaginated(currentChapterIndex - 1), ensureChapterPaginated(currentChapterIndex + 1)]);
  }, [currentChapterIndex, currentPageIndex, ensureChapterPaginated, screenWidth, stripTranslateX, isAnimating]);

  const applyPageMove = (delta: number) => {
    void moveByDelta(delta);
  };

  const threshold = screenWidth * 0.14;
  const dragMultiplier = 1.2;
  const edgeDragMultiplier = 0.5;

  const panGesture = Gesture.Pan()
    .enabled(!isOverlayVisible)
    .onUpdate((event) => {
      if (isAnimating.value) return;

      if (boundaryProbe.value === 0 && event.translationX < -screenWidth * 0.3 && !nextPage) {
        boundaryProbe.value = 1;
        if (currentChapterIndex < chapterList.length - 1) {
          runOnJS(ensureChapterPaginated)(currentChapterIndex + 1);
        }
      }

      if (boundaryProbe.value === 0 && event.translationX > screenWidth * 0.3 && !prevPage) {
        boundaryProbe.value = 1;
        if (currentChapterIndex > 0) {
          runOnJS(ensureChapterPaginated)(currentChapterIndex - 1);
        }
      }

      if (!hasPrevPage && event.translationX > 0) {
        stripTranslateX.value = -screenWidth + Math.min(event.translationX * edgeDragMultiplier, screenWidth * 0.2);
      } else if (!hasNextPage && event.translationX < 0) {
        stripTranslateX.value = -screenWidth + Math.max(event.translationX * edgeDragMultiplier, -screenWidth * 0.2);
      } else {
        stripTranslateX.value = -screenWidth + event.translationX * dragMultiplier;
      }
    })
    .onEnd((event) => {
      if (isAnimating.value) return;

      boundaryProbe.value = 0;

      if (event.translationX < -threshold && hasNextPage) {
        isAnimating.value = true;
        stripTranslateX.value = withTiming(-screenWidth * 2, { duration: 250 }, () => {
          runOnJS(applyPageMove)(1);
        });
      } else if (event.translationX > threshold && hasPrevPage) {
        isAnimating.value = true;
        stripTranslateX.value = withTiming(0, { duration: 250 }, () => {
          runOnJS(applyPageMove)(-1);
        });
      } else {
        stripTranslateX.value = withSpring(-screenWidth);
      }
    });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    if (isAnimating.value) return;
    const zone = event.x / screenWidth;
    if (zone < 0.33) {
      if (hasPrevPage) {
        isAnimating.value = true;
        stripTranslateX.value = withTiming(0, { duration: 220 }, () => {
          runOnJS(applyPageMove)(-1);
        });
      }
    } else if (zone > 0.66) {
      if (hasNextPage) {
        isAnimating.value = true;
        stripTranslateX.value = withTiming(-screenWidth * 2, { duration: 220 }, () => {
          runOnJS(applyPageMove)(1);
        });
      }
    } else {
      runOnJS(toggleOverlay)();
    }
  });

  const gesture = Gesture.Race(panGesture, tapGesture);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: stripTranslateX.value }],
  }));

  if (!currentPage) {
    return null;
  }

  const renderPage = (page: Page | undefined, slotIndex: number) => {
    return (
      <View
        style={[
          styles.pageContainer,
          {
            width: screenWidth,
            left: screenWidth * slotIndex,
            backgroundColor: settings.theme.backgroundColor,
          },
        ]}>
        <Text
          style={{
            color: settings.theme.textColor,
            fontSize: settings.fontSize,
            lineHeight: settings.fontSize * settings.lineHeight,
            fontFamily: settings.fontFamily,
          }}>
          {page?.content ?? ''}
        </Text>
        <View style={styles.footer}>
          <Text style={{ color: settings.theme.textColor, opacity: 0.5, fontSize: 12 }}>{page ? `${page.pageIndex + 1}` : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, { backgroundColor: settings.theme.backgroundColor }]}>
        <Animated.View style={[styles.strip, { width: screenWidth * 3 }, stripStyle]}>
          {renderPage(prevPage, 0)}
          {renderPage(currentPage, 1)}
          {renderPage(nextPage, 2)}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  strip: {
    flex: 1,
  },
  pageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
