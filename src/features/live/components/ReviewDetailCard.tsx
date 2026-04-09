import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ReviewIssue = {
  type: string;
  original: string;
  corrected: string;
  explanation: string;
};

type Review = {
  overallScore: 'green' | 'yellow' | 'red';
  issues: ReviewIssue[];
  betterExpression: string | null;
  praise: string | null;
};

type Props = {
  review: Review;
  onClose: () => void;
};

const SCORE_COLORS: Record<string, string> = {
  green: '#34C759',
  yellow: '#FF9500',
  red: '#FF3B30',
};

const SCORE_LABELS: Record<string, string> = {
  green: 'Great',
  yellow: 'Okay',
  red: 'Needs Work',
};

export default function ReviewDetailCard({ review, onClose }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.scoreDot, { backgroundColor: SCORE_COLORS[review.overallScore] }]} />
            <Text style={styles.headerTitle}>{SCORE_LABELS[review.overallScore]}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Feather name="x" size={18} color="#1A1A1A" />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {review.issues.length > 0 && (
            <View style={styles.section}>
              {review.issues.map((issue, index) => (
                <View key={index} style={styles.issueItem}>
                  <View style={styles.issueTypeBadge}>
                    <Text style={styles.issueTypeText}>{issue.type}</Text>
                  </View>
                  <View style={styles.correctionRow}>
                    <Text style={styles.original}>{issue.original}</Text>
                    <Feather name="arrow-right" size={14} color="rgba(26,26,26,0.4)" />
                    <Text style={styles.corrected}>{issue.corrected}</Text>
                  </View>
                  <Text style={styles.explanation}>{issue.explanation}</Text>
                </View>
              ))}
            </View>
          )}

          {review.betterExpression !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Better Expression</Text>
              <View style={styles.expressionBox}>
                <Text style={styles.expressionText}>{review.betterExpression}</Text>
              </View>
            </View>
          )}

          {review.praise !== null && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Praise</Text>
              <Text style={styles.praiseText}>{review.praise}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(21,22,25,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  body: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  issueItem: {
    marginBottom: 16,
    gap: 6,
  },
  issueTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F5F2ED',
  },
  issueTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  correctionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  original: {
    fontSize: 15,
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  corrected: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34C759',
  },
  explanation: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(26,26,26,0.68)',
  },
  expressionBox: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F5F2ED',
  },
  expressionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
  },
  praiseText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
  },
});
