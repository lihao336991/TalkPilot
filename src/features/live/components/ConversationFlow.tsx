import { TranscriptBubble } from "@/features/live/components/TranscriptBubble";
import {
  Turn,
  useConversationStore,
} from "@/features/live/store/conversationStore";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";

const NEAR_BOTTOM_THRESHOLD = 80;
const FOOTER_HEIGHT = Math.round(Dimensions.get("window").height * 0.5);

function getCurrentRoundAnchorIndex(turns: Turn[]): number {
  if (turns.length <= 1) return 0;

  const groups: Array<{ speaker: Turn["speaker"]; startIndex: number }> = [];
  turns.forEach((turn, idx) => {
    const last = groups[groups.length - 1];
    if (!last || last.speaker !== turn.speaker) {
      groups.push({ speaker: turn.speaker, startIndex: idx });
    }
  });

  if (groups.length <= 1) return 0;

  const currentGroupStart = groups[groups.length - 1].startIndex;
  return Math.max(currentGroupStart - 1, 0);
}

export function ConversationFlow() {
  const { t } = useTranslation();
  const turns = useConversationStore((s) => s.turns);
  const isListening = useConversationStore((s) => s.isListening);
  const flatListRef = useRef<FlatList<Turn>>(null);
  const autoFollowRef = useRef(true);
  const userDraggingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const hasMountedRef = useRef(false);
  const prevTurnCountRef = useRef(0);
  const sameSpeakerStreakRef = useRef(0);

  const roundAnchorIndex = useMemo(
    () => getCurrentRoundAnchorIndex(turns),
    [turns],
  );

  const scrollToCurrentRound = useCallback(
    (animated: boolean) => {
      if (turns.length === 0) return;
      isProgrammaticScrollRef.current = true;
      flatListRef.current?.scrollToIndex({
        index: roundAnchorIndex,
        animated,
        viewPosition: 0,
      });
      setTimeout(
        () => {
          isProgrammaticScrollRef.current = false;
        },
        animated ? 400 : 50,
      );
    },
    [roundAnchorIndex, turns.length],
  );

  const keyExtractor = useCallback((item: Turn) => item.id, []);

  const handleScrollBeginDrag = useCallback(() => {
    userDraggingRef.current = true;
    autoFollowRef.current = false;
  }, []);

  const checkNearBottom = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) return;
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceToBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceToBottom <= FOOTER_HEIGHT + NEAR_BOTTOM_THRESHOLD) {
        autoFollowRef.current = true;
      }
      userDraggingRef.current = false;
    },
    [],
  );

  const handleScrollToIndexFailed = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
      requestAnimationFrame(() => {
        scrollToCurrentRound(false);
      });
    });
  }, [scrollToCurrentRound]);

  useEffect(() => {
    if (turns.length === 0) return;

    const isNewTurn = turns.length > prevTurnCountRef.current;
    prevTurnCountRef.current = turns.length;

    if (!isNewTurn && hasMountedRef.current) return;
    if (!autoFollowRef.current && hasMountedRef.current) return;

    const animated = hasMountedRef.current;
    hasMountedRef.current = true;

    const lastTurn = turns[turns.length - 1];
    const prevTurn = turns.length >= 2 ? turns[turns.length - 2] : null;
    const isSpeakerChange = !prevTurn || prevTurn.speaker !== lastTurn.speaker;

    if (isSpeakerChange) {
      sameSpeakerStreakRef.current = 1;
    } else {
      sameSpeakerStreakRef.current += 1;
    }

    requestAnimationFrame(() => {
      if (isSpeakerChange) {
        scrollToCurrentRound(animated);
      } else if (sameSpeakerStreakRef.current >= 8) {
        isProgrammaticScrollRef.current = true;
        flatListRef.current?.scrollToIndex({
          index: turns.length - 1,
          animated: true,
          viewPosition: 1,
        });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 400);
      }
    });
  }, [scrollToCurrentRound, turns]);

  const ListFooterSpacer = useMemo(
    () => <View style={{ height: FOOTER_HEIGHT }} />,
    [],
  );

  const showListening = isListening;
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
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={checkNearBottom}
        onScrollEndDrag={checkNearBottom}
        scrollEventThrottle={16}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        ListFooterComponent={ListFooterSpacer}
      />
      {showListening && (
        <View style={styles.listeningContainer}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>
            {t("live.conversationFlow.listening")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 12,
  },
  listeningContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34C759",
  },
  listeningText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(26,26,26,0.68)",
  },
});
