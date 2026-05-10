import { TranscriptBubble } from "@/features/live/components/TranscriptBubble";
import {
  Turn,
  useConversationStore,
} from "@/features/live/store/conversationStore";
import React, { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";

const NEAR_BOTTOM_THRESHOLD = 80;

export function ConversationFlow() {
  const turns = useConversationStore((s) => s.turns);
  const currentStableText = useConversationStore((s) => s.currentStableText);
  const currentStableSpeaker = useConversationStore(
    (s) => s.currentStableSpeaker,
  );
  const currentInterimText = useConversationStore((s) => s.currentInterimText);
  const currentInterimSpeaker = useConversationStore(
    (s) => s.currentInterimSpeaker,
  );
  const flatListRef = useRef<FlatList<Turn>>(null);
  const autoFollowRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const hasMountedRef = useRef(false);
  const prevTurnCountRef = useRef(0);
  const prevInterimTextRef = useRef("");
  const contentHeightRef = useRef(0);

  const hasInterim = currentInterimText.trim().length > 0;
  const hasStablePreview =
    currentStableText.trim().length > 0 && currentStableSpeaker !== null;

  const scrollToBottom = useCallback((animated: boolean) => {
    isProgrammaticScrollRef.current = true;
    flatListRef.current?.scrollToEnd({ animated });
    setTimeout(
      () => {
        isProgrammaticScrollRef.current = false;
      },
      animated ? 400 : 50,
    );
  }, []);

  const keyExtractor = useCallback((item: Turn) => item.id, []);

  const handleScrollBeginDrag = useCallback(() => {
    autoFollowRef.current = false;
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) return;
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceToBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      autoFollowRef.current = distanceToBottom <= NEAR_BOTTOM_THRESHOLD;
    },
    [],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const previousHeight = contentHeightRef.current;
      contentHeightRef.current = height;

      if (previousHeight === 0 || height <= previousHeight) {
        return;
      }

      if (!autoFollowRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    },
    [scrollToBottom],
  );

  useEffect(() => {
    if (turns.length === 0 && !hasInterim) {
      hasMountedRef.current = false;
      prevTurnCountRef.current = 0;
      prevInterimTextRef.current = "";
      autoFollowRef.current = true;
      return;
    }

    const isNewTurn = turns.length > prevTurnCountRef.current;
    const interimChanged = prevInterimTextRef.current !== currentInterimText;
    prevTurnCountRef.current = turns.length;
    prevInterimTextRef.current = currentInterimText;

    if (!autoFollowRef.current && hasMountedRef.current) return;

    const animated = hasMountedRef.current && isNewTurn;
    hasMountedRef.current = true;

    requestAnimationFrame(() => {
      if (isNewTurn || interimChanged) {
        scrollToBottom(animated);
      }
    });
  }, [currentInterimText, hasInterim, scrollToBottom, turns.length]);

  const renderInterimBubble = useCallback(() => {
    if (!hasInterim || !currentInterimSpeaker) {
      return null;
    }

    const trimmedInterimText = currentInterimText.trim();
    if (!trimmedInterimText) {
      return null;
    }

    let displayText = trimmedInterimText;
    if (hasStablePreview && currentStableSpeaker === currentInterimSpeaker) {
      const trimmedStableText = currentStableText.trim();
      if (trimmedInterimText === trimmedStableText) {
        return null;
      }
      if (trimmedInterimText.startsWith(trimmedStableText)) {
        displayText = trimmedInterimText
          .slice(trimmedStableText.length)
          .trimStart();
      }
    }

    if (!displayText) {
      return null;
    }

    return (
      <TranscriptBubble
        speaker={currentInterimSpeaker}
        text={displayText}
        isFinal={false}
      />
    );
  }, [
    currentInterimSpeaker,
    currentInterimText,
    currentStableSpeaker,
    currentStableText,
    hasInterim,
    hasStablePreview,
  ]);

  const renderStablePreviewBubble = useCallback(() => {
    if (!hasStablePreview || !currentStableSpeaker) {
      return null;
    }

    return (
      <TranscriptBubble
        speaker={currentStableSpeaker}
        text={currentStableText}
        isFinal
      />
    );
  }, [currentStableSpeaker, currentStableText, hasStablePreview]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={turns}
        renderItem={({ item }) => (
          <TranscriptBubble
            speaker={item.speaker}
            text={item.text}
            isFinal={item.isFinal}
            reviewScore={item.reviewScore}
            review={item.review}
            showReviewIndicator={
              item.speaker === "self" &&
              !!item.review &&
              item.reviewScore !== "green"
            }
            isAssist={item.isAssist}
            assistSourceText={item.assistSourceText}
            translation={item.translation}
            translationStatus={item.translationStatus}
            translationDirection={item.translationDirection}
          />
        )}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.content}
        ListFooterComponent={
          <>
            {renderStablePreviewBubble()}
            {renderInterimBubble()}
          </>
        }
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 1,
  },
  list: {
    zIndex: 1,
  },
  content: {
    paddingVertical: 12,
  },
});
