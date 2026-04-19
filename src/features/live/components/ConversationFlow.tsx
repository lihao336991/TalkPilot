import React, { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Turn, useConversationStore } from '@/features/live/store/conversationStore';
import { TranscriptBubble } from '@/features/live/components/TranscriptBubble';

export function ConversationFlow() {
  const turns = useConversationStore((s) => s.turns);
  const currentInterimText = useConversationStore((s) => s.currentInterimText);
  const currentInterimSpeaker = useConversationStore((s) => s.currentInterimSpeaker);
  const isListening = useConversationStore((s) => s.isListening);
  const flatListRef = useRef<FlatList<Turn>>(null);

  const scrollToEnd = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const keyExtractor = useCallback((item: Turn) => item.id, []);

  const hasInterim = currentInterimText.length > 0 && currentInterimSpeaker !== null;
  const showListening = isListening && !hasInterim;
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
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
      />
      {hasInterim && (
        <View style={styles.interimContainer}>
          <TranscriptBubble
            speaker={currentInterimSpeaker!}
            text={currentInterimText}
            isFinal={false}
            showReviewIndicator={false}
          />
        </View>
      )}
      {showListening && (
        <View style={styles.listeningContainer}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>Listening...</Text>
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
  interimContainer: {
    paddingBottom: 8,
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  listeningText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(26,26,26,0.68)',
  },
});
