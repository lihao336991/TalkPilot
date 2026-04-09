import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type TranscriptBubbleProps = {
  speaker: 'self' | 'other';
  text: string;
  isFinal: boolean;
  reviewScore?: 'green' | 'yellow' | 'red';
};

const SCORE_COLORS = {
  green: '#34C759',
  yellow: '#FF9500',
  red: '#FF3B30',
} as const;

export function TranscriptBubble({ speaker, text, isFinal, reviewScore }: TranscriptBubbleProps) {
  const isSelf = speaker === 'self';
  const opacity = React.useRef(new Animated.Value(isFinal ? 1 : 0.6)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: isFinal ? 1 : 0.6,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isFinal, opacity]);

  return (
    <View style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}>
      <Animated.View
        style={[
          styles.bubble,
          isSelf ? styles.bubbleSelf : styles.bubbleOther,
          { opacity },
        ]}>
        <Animated.Text style={[styles.text, isSelf ? styles.textSelf : styles.textOther]}>
          {text}
        </Animated.Text>
      </Animated.View>
      {reviewScore && isSelf && (
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreDot, { backgroundColor: SCORE_COLORS[reviewScore] }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  rowSelf: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleSelf: {
    backgroundColor: '#151619',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#F5F2ED',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textSelf: {
    color: '#FFFFFF',
  },
  textOther: {
    color: '#1A1A1A',
  },
  scoreContainer: {
    alignItems: 'flex-end',
    paddingRight: 8,
    marginTop: 4,
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
