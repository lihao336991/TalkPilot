import React from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInLeft, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { NovelCard } from '@/shared/types/novelCard';

type FeedCardProps = {
  book: NovelCard;
  cardHeight: number;
  bottomOffset: number;
  onRead: (book: NovelCard) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const serifFontFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const sansFontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' });
const sideActions: Array<{ icon: keyof typeof Feather.glyphMap; label: string }> = [
  { icon: 'compass', label: 'Explore' },
  { icon: 'message-square', label: '1.2k' },
  { icon: 'book-open', label: 'Listen' },
];

export function FeedCard({ book, cardHeight, bottomOffset, onRead }: FeedCardProps) {
  const scale = useSharedValue(1);
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.max(220, width - 144);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height: cardHeight,
          paddingBottom: bottomOffset + 28,
        },
      ]}>
      <View style={styles.backgroundLayer}>
        <Image source={{ uri: book.coverUrl }} style={styles.coverImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(21,22,25,0.08)', 'rgba(21,22,25,0.58)', 'rgba(21,22,25,0.98)']}
          locations={[0.08, 0.56, 1]}
          style={styles.gradientOverlay}
        />
      </View>

      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        <Animated.View entering={FadeInLeft.delay(200)} style={styles.copyBlock}>
          <Text style={styles.eyebrow}>Featured Story</Text>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.snippet} numberOfLines={3}>
            "{book.description}"
          </Text>
        </Animated.View>

        <View style={styles.metaRow}>
          <AnimatedPressable
            onPress={() => onRead(book)}
            onPressIn={() => {
              scale.value = withSpring(0.95);
            }}
            onPressOut={() => {
              scale.value = withSpring(1);
            }}
            style={[styles.primaryButton, animatedStyle]}>
            <Text style={styles.primaryButtonText}>Start Reading</Text>
            <Feather name="chevron-right" size={18} color="#1A1A1A" />
          </AnimatedPressable>
          <View style={styles.authorBlock}>
            <Text style={styles.authorLabel}>Author</Text>
            <Text style={styles.authorName}>{book.author}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sideActions, { bottom: bottomOffset + 32 }]}>
        {sideActions.map((action) => (
          <View key={action.label} style={styles.sideActionItem}>
            <Pressable style={styles.sideActionButton}>
              <View style={styles.sideActionOverlay}>
                <Feather name={action.icon} size={22} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.sideActionLabel}>{action.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    zIndex: 20,
    gap: 18,
  },
  copyBlock: {
    gap: 10,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: sansFontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: serifFontFamily,
    fontSize: 44,
    lineHeight: 52,
  },
  snippet: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: serifFontFamily,
    fontSize: 20,
    fontStyle: 'italic',
    lineHeight: 30,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#1A1A1A',
    fontFamily: sansFontFamily,
    fontSize: 14,
    fontWeight: '700',
  },
  authorBlock: {
    gap: 4,
  },
  authorLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'SpaceMono',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  authorName: {
    color: '#FFFFFF',
    fontFamily: sansFontFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  sideActions: {
    position: 'absolute',
    right: 24,
    zIndex: 30,
    gap: 22,
  },
  sideActionItem: {
    alignItems: 'center',
    gap: 6,
  },
  sideActionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  sideActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(24,24,28,0.32)',
    justifyContent: 'center',
  },
  sideActionLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontFamily: sansFontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
