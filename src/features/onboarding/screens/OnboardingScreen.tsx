import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Slide 数据 ───────────────────────────────────────────────────────────────
// 设计素材需求见每个 slide 的 illustrationNote 字段

type Slide = {
  id: string;
  accentColor: string;
  bgGradient: readonly [string, string, string];
  eyebrow: string;
  headline: string;
  body: string;
  iconName: keyof typeof Feather.glyphMap;
  // 设计素材说明（给设计师看）
  illustrationNote: string;
};

const SLIDES: Slide[] = [
  {
    id: "realtime",
    accentColor: "#D2F45C",
    bgGradient: ["#0A0A0A", "#111A00", "#0A0A0A"],
    eyebrow: "REAL-TIME",
    headline: "Your AI co-pilot\nin every conversation",
    body: "TalkPilot listens as you speak and gives you instant feedback — grammar, vocabulary, and natural expression, all in the moment.",
    iconName: "mic",
    illustrationNote:
      "【设计素材需求 1/4】深色背景上，一个手机屏幕展示实时对话气泡流，左侧气泡（对方）右侧气泡（自己），自己的气泡上有绿色/黄色评分光晕。整体风格：暗黑科技感，主色 #D2F45C 荧光绿点缀。尺寸建议 600×500px PNG，透明背景。",
  },
  {
    id: "review",
    accentColor: "#8EC5FF",
    bgGradient: ["#050A14", "#0A1628", "#050A14"],
    eyebrow: "INSTANT REVIEW",
    headline: "Know exactly what\nto fix, right now",
    body: "Every sentence you speak gets scored. Tap any bubble to see what went wrong, the corrected version, and a better way to say it.",
    iconName: "check-circle",
    illustrationNote:
      "【设计素材需求 2/4】展示一个对话气泡被点击后弹出 Review 卡片的场景。卡片上有：评分颜色（黄色=minor issue）、原句划线、修正句、简短解释。风格：蓝色调，卡片有轻微毛玻璃质感。尺寸建议 600×500px PNG，透明背景。",
  },
  {
    id: "suggest",
    accentColor: "#FF9F6B",
    bgGradient: ["#140800", "#1A0E00", "#140800"],
    eyebrow: "AI SUGGESTIONS",
    headline: "Never get stuck\nfor words again",
    body: "When you don't know what to say next, TalkPilot generates a natural reply suggestion based on the full conversation context.",
    iconName: "zap",
    illustrationNote:
      "【设计素材需求 3/4】展示底部弹出的 Suggestion 面板，上面有一条建议回复文字，旁边有「Use this」按钮。背景是模糊的对话界面。风格：暖橙色调，有轻微发光效果。尺寸建议 600×500px PNG，透明背景。",
  },
  {
    id: "getstarted",
    accentColor: "#D2F45C",
    bgGradient: ["#0A0A0A", "#0F1400", "#0A0A0A"],
    eyebrow: "LET'S GO",
    headline: "Start your first\nconversation",
    body: "Tap the mic, start talking. TalkPilot works in the background — no setup, no interruptions. Just speak naturally.",
    iconName: "play-circle",
    illustrationNote:
      "【设计素材需求 4/4】一个大号脉冲动画麦克风按钮居中，周围有声波扩散圆环（3层，由内到外透明度递减）。背景纯黑。风格：极简，主色 #D2F45C。尺寸建议 600×500px PNG，透明背景。",
  },
];

// ─── Dot 指示器 ───────────────────────────────────────────────────────────────

function PaginationDot({
  index,
  activeIndex,
  accentColor,
}: {
  index: number;
  activeIndex: number;
  accentColor: string;
}) {
  const isActive = index === activeIndex;
  const width = withSpring(isActive ? 24 : 8, { damping: 15, stiffness: 200 });
  const animStyle = useAnimatedStyle(() => ({
    width,
    backgroundColor: isActive ? accentColor : "rgba(255,255,255,0.25)",
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

// ─── 单个 Slide ───────────────────────────────────────────────────────────────

function SlideItem({
  slide,
  scrollX,
  index,
}: {
  slide: Slide;
  scrollX: SharedValue<number>;
  index: number;
}) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollX.value,
          inputRange,
          [40, 0, -40],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          scrollX.value,
          inputRange,
          [0.7, 1, 0.7],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollX.value,
          inputRange,
          [24, 0, -24],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <LinearGradient
      colors={slide.bgGradient}
      style={styles.slide}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* 图示区域 */}
      <Animated.View style={[styles.illustrationArea, iconAnimStyle]}>
        {/* 外圈光晕 */}
        <View
          style={[
            styles.glowRing,
            styles.glowRingOuter,
            { borderColor: `${slide.accentColor}18` },
          ]}
        />
        <View
          style={[
            styles.glowRing,
            styles.glowRingMid,
            { borderColor: `${slide.accentColor}28` },
          ]}
        />
        {/* 图标容器 */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${slide.accentColor}18`, borderColor: `${slide.accentColor}40` },
          ]}
        >
          <Feather name={slide.iconName} size={52} color={slide.accentColor} />
        </View>
        {/* 装饰浮动标签 */}
        <View style={[styles.floatingTag, styles.floatingTagLeft, { borderColor: `${slide.accentColor}30` }]}>
          <View style={[styles.floatingTagDot, { backgroundColor: slide.accentColor }]} />
          <Text style={styles.floatingTagText}>AI-powered</Text>
        </View>
        <View style={[styles.floatingTag, styles.floatingTagRight, { borderColor: `${slide.accentColor}30` }]}>
          <View style={[styles.floatingTagDot, { backgroundColor: slide.accentColor }]} />
          <Text style={styles.floatingTagText}>Real-time</Text>
        </View>
      </Animated.View>

      {/* 文字区域 */}
      <Animated.View style={[styles.copyArea, textAnimStyle]}>
        <Text style={[styles.eyebrow, { color: slide.accentColor }]}>
          {slide.eyebrow}
        </Text>
        <Text style={styles.headline}>{slide.headline}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

// ─── 主屏幕 ───────────────────────────────────────────────────────────────────

type OnboardingScreenProps = {
  onComplete: () => void;
};

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);
  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];

  const ctaBgStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(currentSlide.accentColor, { duration: 400 }),
  }));

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }
    flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* 滑动区域 */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item, index }) => (
          <SlideItem slide={item} scrollX={scrollX} index={index} />
        )}
      />

      {/* 底部控制区 */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* 分页点 */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <PaginationDot
              key={i}
              index={i}
              activeIndex={activeIndex}
              accentColor={currentSlide.accentColor}
            />
          ))}
        </View>

        {/* 按钮行 */}
        <View style={styles.buttonRow}>
          {!isLast ? (
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : (
            <View style={styles.skipButton} />
          )}

          <Pressable onPress={handleNext} accessibilityRole="button">
            <Animated.View style={[styles.ctaButton, ctaBgStyle]}>
              <Text style={styles.ctaText}>
                {isLast ? "Get Started" : "Next"}
              </Text>
              <Feather
                name={isLast ? "arrow-right" : "chevron-right"}
                size={18}
                color="#050505"
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    justifyContent: "center",
    gap: 40,
  },
  illustrationArea: {
    alignItems: "center",
    justifyContent: "center",
    height: 260,
  },
  glowRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  glowRingOuter: {
    width: 240,
    height: 240,
  },
  glowRingMid: {
    width: 180,
    height: 180,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingTag: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  floatingTagLeft: {
    bottom: 20,
    left: 0,
  },
  floatingTagRight: {
    top: 20,
    right: 0,
  },
  floatingTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  floatingTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
  },
  copyArea: {
    gap: 12,
    paddingBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headline: {
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    color: "#FFFFFF",
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.62)",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
    backgroundColor: "#0A0A0A",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#050505",
  },
});
