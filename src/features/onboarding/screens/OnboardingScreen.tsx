import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type Slide = {
  id: string;
  accentColor: string;
  bgGradient: readonly [string, string, string];
  progressColor: string;
  ctaTextColor: string;
  variant: "speak" | "reply" | "review";
};

const SLIDES: Slide[] = [
  {
    id: "speak",
    accentColor: "#D2F45C",
    bgGradient: ["#000000", "#000000", "#000000"],
    progressColor: "#D2F45C",
    ctaTextColor: "#0A0A0A",
    variant: "speak",
  },
  {
    id: "reply",
    accentColor: "#FFAE57",
    bgGradient: ["#000000", "#000000", "#000000"],
    progressColor: "#FFAE57",
    ctaTextColor: "#0A0A0A",
    variant: "reply",
  },
  {
    id: "review",
    accentColor: "#58A6FF",
    bgGradient: ["#000000", "#000000", "#000000"],
    progressColor: "#58A6FF",
    ctaTextColor: "#06111E",
    variant: "review",
  },
];

function PaginationDot({
  index,
  activeIndex,
  activeColor,
}: {
  index: number;
  activeIndex: number;
  activeColor: string;
}) {
  const isActive = index === activeIndex;
  const width = withSpring(isActive ? 10 : 8, { damping: 15, stiffness: 200 });
  const animStyle = useAnimatedStyle(() => ({
    width,
    backgroundColor: isActive ? activeColor : "rgba(255,255,255,0.18)",
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: `${color}44`, backgroundColor: `${color}12` },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SpeakArtwork({
  accentColor,
  activeIndex,
}: {
  accentColor: string;
  activeIndex: number;
}) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const mic = useSharedValue(0);
  const bubbleL = useSharedValue(0);
  const bubbleR = useSharedValue(0);
  const spark = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (activeIndex === 0) {
      ring1.value = withDelay(
        0,
        withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      );
      ring2.value = withDelay(
        30,
        withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      );
      ring3.value = withDelay(
        60,
        withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      );
      mic.value = withDelay(
        70,
        withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
      );
      bubbleL.value = withDelay(
        120,
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
      );
      bubbleR.value = withDelay(
        180,
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
      );
      spark.value = withDelay(220, withTiming(1, { duration: 160 }));
      pulse.value = withDelay(
        180,
        withSequence(
          withTiming(1, {
            duration: 140,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 140,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
      );
    } else {
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      mic.value = 0;
      bubbleL.value = 0;
      bubbleR.value = 0;
      spark.value = 0;
      pulse.value = 0;
    }
  }, [activeIndex]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1.value,
    transform: [{ scale: interpolate(ring1.value, [0, 1], [0.4, 1]) }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2.value,
    transform: [{ scale: interpolate(ring2.value, [0, 1], [0.4, 1]) }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3.value,
    transform: [{ scale: interpolate(ring3.value, [0, 1], [0.4, 1]) }],
  }));
  const micStyle = useAnimatedStyle(() => ({
    opacity: mic.value,
    transform: [{ scale: mic.value }],
  }));
  const micGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mic.value, [0, 1], [0, 0.22]),
  }));
  const bubbleLStyle = useAnimatedStyle(() => ({
    opacity: bubbleL.value,
    transform: [{ translateX: interpolate(bubbleL.value, [0, 1], [-50, 0]) }],
  }));
  const bubbleRStyle = useAnimatedStyle(() => ({
    opacity: bubbleR.value,
    transform: [{ translateX: interpolate(bubbleR.value, [0, 1], [50, 0]) }],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: spark.value * (0.6 + interpolate(pulse.value, [0, 1], [0, 0.4])),
  }));
  const ringPulse = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + interpolate(pulse.value, [0, 1], [0, 0.025]) }],
  }));

  return (
    <View style={styles.artworkArea}>
      <Animated.View
        style={[
          styles.micRing,
          styles.micRingOuter,
          { borderColor: `${accentColor}12` },
          ring1Style,
          ringPulse,
        ]}
      />
      <Animated.View
        style={[
          styles.micRing,
          styles.micRingMid,
          { borderColor: `${accentColor}20` },
          ring2Style,
          ringPulse,
        ]}
      />
      <Animated.View
        style={[
          styles.micRing,
          styles.micRingInner,
          { borderColor: `${accentColor}32` },
          ring3Style,
          ringPulse,
        ]}
      />
      <Animated.View
        style={[styles.sideBubble, styles.leftBubble, bubbleLStyle]}
      >
        <Text style={styles.sideBubbleText}>Hello!</Text>
      </Animated.View>
      <Animated.View
        style={[styles.sideBubble, styles.rightBubble, bubbleRStyle]}
      >
        <Text style={styles.sideBubbleText}>Hi there!</Text>
      </Animated.View>
      <Animated.View
        style={[styles.micCore, { shadowColor: accentColor }, micStyle]}
      >
        <AnimatedLinearGradient
          colors={["rgba(210,244,92,0.12)", "rgba(210,244,92,0.02)"]}
          style={[styles.micGlow, micGlowStyle]}
        />
        <Feather name="mic" size={52} color={accentColor} />
      </Animated.View>
      <Animated.View
        style={[
          styles.spark,
          styles.sparkLeft,
          { backgroundColor: accentColor },
          sparkStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.spark,
          styles.sparkRight,
          { backgroundColor: accentColor },
          sparkStyle,
        ]}
      />
    </View>
  );
}

function ReplyArtwork({
  t,
  accentColor,
  index,
  scrollX,
  activeIndex,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  accentColor: string;
  index: number;
  scrollX: SharedValue<number>;
  activeIndex: number;
}) {
  const previousX = (index - 1) * SCREEN_WIDTH;
  const currentX = index * SCREEN_WIDTH;
  const nextX = (index + 1) * SCREEN_WIDTH;
  const suggestEnter = useSharedValue(0);
  const suggestSweep = useSharedValue(-1);

  useEffect(() => {
    if (activeIndex === index) {
      suggestEnter.value = 0;
      suggestEnter.value = withDelay(
        30,
        withTiming(1, {
          duration: 320,
          easing: Easing.out(Easing.cubic),
        }),
      );
      suggestSweep.value = -1;
      suggestSweep.value = withDelay(
        380,
        withTiming(1, {
          duration: 680,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      suggestEnter.value = 0;
      suggestSweep.value = -1;
    }
  }, [activeIndex, index, suggestEnter, suggestSweep]);

  const ambientGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.56, currentX, nextX],
      [0, 0.05, 0.22, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [previousX, currentX - SCREEN_WIDTH * 0.56, currentX, nextX],
          [0.88, 0.94, 1, 0.98],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const sourceCardAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0.2, 0.55, 1, 0.25],
      Extrapolation.CLAMP,
    ),
  }));

  const sourceGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0.02, 0.05, 0.12, 0.05],
      Extrapolation.CLAMP,
    ),
  }));

  const sourceCardChromeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0, 0.22, 1, 0.24],
      Extrapolation.CLAMP,
    );

    return {
      shadowOpacity: 0.01 + progress * 0.04,
      shadowRadius: 6 + progress * 6,
      shadowOffset: {
        width: 0,
        height: 4 + progress * 4,
      },
      borderColor: interpolateColor(
        progress,
        [0, 1],
        ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.12)"],
      ),
    };
  });

  const connectorAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0, 0.1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const suggestionCardAnimStyle = useAnimatedStyle(() => ({
    opacity: suggestEnter.value,
    transform: [
      {
        translateY: interpolate(suggestEnter.value, [0, 1], [-34, 0]),
      },
      {
        scale: interpolate(suggestEnter.value, [0, 1], [0.94, 1]),
      },
    ],
  }));

  const suggestionGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(suggestEnter.value, [0, 1], [0.06, 0.24]),
  }));

  const suggestionCardChromeStyle = useAnimatedStyle(() => {
    const progress = suggestEnter.value;

    return {
      shadowOpacity: 0.08 + progress * 0.18,
      shadowRadius: 18 + progress * 12,
      shadowOffset: {
        width: 0,
        height: 10 + progress * 10,
      },
      borderColor: interpolateColor(
        progress,
        [0, 1],
        ["rgba(255,174,87,0.22)", "rgba(255,174,87,0.64)"],
      ),
    };
  });

  const suggestionSweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      suggestSweep.value,
      [-1, -0.4, 0, 0.4, 1],
      [0, 0.12, 0.18, 0.12, 0],
    ),
    transform: [
      {
        translateX: interpolate(suggestSweep.value, [-1, 1], [-180, 260]),
      },
      { rotate: "-16deg" },
    ],
  }));

  return (
    <View style={styles.replyArtwork}>
      <Animated.View
        style={[styles.replyAmbientOrb, ambientGlowStyle]}
        pointerEvents="none"
      >
        <AnimatedLinearGradient
          colors={["rgba(255,174,87,0.18)", "rgba(255,174,87,0.02)"]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.replyAmbientGradient}
        />
      </Animated.View>

      <Animated.View
        style={[styles.messageCard, sourceCardAnimStyle, sourceCardChromeStyle]}
      >
        <AnimatedLinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0.01)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardTintOverlay, sourceGlowStyle]}
        />
        <View style={styles.messageHeader}>
          <View style={styles.messageHeaderCopy}>
            <Text style={[styles.personLabel, { color: accentColor }]}>
              {t("onboarding.slides.reply.sourceLabel")}
            </Text>
          </View>
          <Text style={styles.personTime}>10:34</Text>
        </View>
        <View style={styles.messageBody}>
          <Text style={styles.messageText}>
            {t("onboarding.slides.reply.sourceTextLine1")}
          </Text>
          <Text style={styles.messageText2}>
            {t("onboarding.slides.reply.sourceTextLine2")}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.replyConnector, connectorAnimStyle]}>
        <Feather name="arrow-down" size={18} color={`${accentColor}B5`} />
      </Animated.View>

      <Animated.View
        style={[
          styles.suggestionCard,
          suggestionCardAnimStyle,
          suggestionCardChromeStyle,
          { shadowColor: accentColor },
        ]}
      >
        <AnimatedLinearGradient
          pointerEvents="none"
          colors={["rgba(255,174,87,0.20)", "rgba(255,174,87,0.03)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardTintOverlay, suggestionGlowStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.highlightSweep, suggestionSweepStyle]}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.highlightSweepGradient}
          />
        </Animated.View>
        <Text style={[styles.suggestionEyebrow, { color: accentColor }]}>
          {t("onboarding.slides.reply.suggestionLabel")}
        </Text>
        <Text style={[styles.suggestionLine, , { color: accentColor }]}>
          {t("onboarding.slides.reply.suggestionLine1")}
        </Text>
        <Text style={styles.suggestionLine2}>
          {t("onboarding.slides.reply.suggestionLine2")}
        </Text>
      </Animated.View>
    </View>
  );
}

function ReviewArtwork({
  t,
  accentColor,
  index,
  scrollX,
  activeIndex,
}: {
  t: ReturnType<typeof useTranslation>["t"];
  accentColor: string;
  index: number;
  scrollX: SharedValue<number>;
  activeIndex: number;
}) {
  const previousX = (index - 1) * SCREEN_WIDTH;
  const currentX = index * SCREEN_WIDTH;
  const nextX = (index + 1) * SCREEN_WIDTH;
  const activeEnter = useSharedValue(0);
  const reviewSweep = useSharedValue(-1);

  useEffect(() => {
    if (activeIndex === index) {
      activeEnter.value = 0;
      activeEnter.value = withDelay(
        30,
        withTiming(1, {
          duration: 340,
          easing: Easing.out(Easing.cubic),
        }),
      );
      reviewSweep.value = -1;
      reviewSweep.value = withDelay(
        400,
        withTiming(1, {
          duration: 700,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      activeEnter.value = 0;
      reviewSweep.value = -1;
    }
  }, [activeIndex, index, activeEnter, reviewSweep]);

  const ambientGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.56, currentX, nextX],
      [0, 0.05, 0.18, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [previousX, currentX - SCREEN_WIDTH * 0.56, currentX, nextX],
          [0.88, 0.94, 1, 0.98],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const reviewMutedCardAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0.2, 0.55, 1, 0.25],
      Extrapolation.CLAMP,
    ),
  }));

  const reviewArrowAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0, 0.1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const reviewActiveCardAnimStyle = useAnimatedStyle(() => ({
    opacity: activeEnter.value,
    transform: [
      {
        translateY: interpolate(activeEnter.value, [0, 1], [-36, 0]),
      },
      {
        scale: interpolate(activeEnter.value, [0, 1], [0.94, 1]),
      },
    ],
  }));

  const reviewGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(activeEnter.value, [0, 1], [0.05, 0.15]),
  }));

  const reviewMutedChromeStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [previousX, currentX - SCREEN_WIDTH * 0.42, currentX, nextX],
      [0, 0.22, 1, 0.24],
      Extrapolation.CLAMP,
    );

    return {
      shadowOpacity: 0.01 + progress * 0.04,
      shadowRadius: 6 + progress * 6,
      shadowOffset: {
        width: 0,
        height: 4 + progress * 4,
      },
      borderColor: interpolateColor(
        progress,
        [0, 1],
        ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.12)"],
      ),
    };
  });

  const reviewActiveChromeStyle = useAnimatedStyle(() => {
    const progress = activeEnter.value;

    return {
      shadowOpacity: 0.08 + progress * 0.18,
      shadowRadius: 18 + progress * 12,
      shadowOffset: {
        width: 0,
        height: 10 + progress * 10,
      },
      borderColor: interpolateColor(
        progress,
        [0, 1],
        ["rgba(88,166,255,0.18)", "rgba(88,166,255,0.46)"],
      ),
    };
  });

  const reviewSweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      reviewSweep.value,
      [-1, -0.4, 0, 0.4, 1],
      [0, 0.12, 0.18, 0.12, 0],
    ),
    transform: [
      {
        translateX: interpolate(reviewSweep.value, [-1, 1], [-180, 260]),
      },
      { rotate: "-16deg" },
    ],
  }));

  return (
    <View style={styles.reviewArtwork}>
      <Animated.View
        style={[styles.reviewAmbientOrb, ambientGlowStyle]}
        pointerEvents="none"
      >
        <AnimatedLinearGradient
          colors={["rgba(88,166,255,0.16)", "rgba(88,166,255,0.02)"]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.85, y: 0.9 }}
          style={styles.replyAmbientGradient}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.reviewCardMuted,
          reviewMutedCardAnimStyle,
          reviewMutedChromeStyle,
        ]}
      >
        <Text style={styles.reviewLabelMuted}>
          {t("onboarding.slides.review.originalLabel")}
        </Text>
        <Text style={styles.reviewSentenceMuted}>
          {t("onboarding.slides.review.originalText")}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.reviewArrow, reviewArrowAnimStyle]}>
        <Feather name="arrow-down" size={18} color={`${accentColor}B5`} />
      </Animated.View>

      <Animated.View
        style={[
          styles.reviewCardActive,
          reviewActiveCardAnimStyle,
          reviewActiveChromeStyle,
          { shadowColor: accentColor },
        ]}
      >
        <AnimatedLinearGradient
          pointerEvents="none"
          colors={["rgba(88,166,255,0.12)", "rgba(88,166,255,0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardTintOverlay, reviewGlowStyle]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.highlightSweep, reviewSweepStyle]}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.highlightSweepGradient}
          />
        </Animated.View>
        <Text style={[styles.reviewLabelActive, { color: accentColor }]}>
          {t("onboarding.slides.review.improvedLabel")}
        </Text>
        <Text style={[styles.reviewSentenceActive, { color: accentColor }]}>
          {t("onboarding.slides.review.improvedText")}
        </Text>
        <Feather
          name="volume-2"
          size={18}
          color={accentColor}
          style={styles.reviewIcon}
        />
      </Animated.View>
    </View>
  );
}

function SlideItem({
  slide,
  scrollX,
  index,
  topInset,
  activeIndex,
}: {
  slide: Slide;
  scrollX: SharedValue<number>;
  index: number;
  topInset: number;
  activeIndex: number;
}) {
  const { t } = useTranslation();
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const slideAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      inputRange,
      [0.42, 1, 0.42],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollX.value,
          inputRange,
          [18, 0, 18],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <LinearGradient
      colors={slide.bgGradient}
      style={[styles.slide, { paddingTop: topInset + 12 }]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <Animated.View style={[styles.card, slideAnimStyle]}>
        <View style={styles.topRow}>
          <StatusBadge
            label={t(`onboarding.slides.${slide.id}.eyebrow`)}
            color={slide.accentColor}
          />
        </View>

        <View style={styles.copyArea}>
          <Text style={styles.headline}>
            {t(`onboarding.slides.${slide.id}.headline`)}
          </Text>
          <Text style={styles.body}>
            {t(`onboarding.slides.${slide.id}.body`)}
          </Text>
        </View>

        {slide.variant === "speak" ? (
          <SpeakArtwork
            accentColor={slide.accentColor}
            activeIndex={activeIndex}
          />
        ) : null}
        {slide.variant === "reply" ? (
          <ReplyArtwork
            t={t}
            accentColor={slide.accentColor}
            index={index}
            scrollX={scrollX}
            activeIndex={activeIndex}
          />
        ) : null}
        {slide.variant === "review" ? (
          <ReviewArtwork
            t={t}
            accentColor={slide.accentColor}
            index={index}
            scrollX={scrollX}
            activeIndex={activeIndex}
          />
        ) : null}
      </Animated.View>
    </LinearGradient>
  );
}

type OnboardingScreenProps = {
  onComplete: () => void;
};

export default function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);
  const isLast = activeIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[activeIndex];
  const slideCount = SLIDES.length;

  const ctaBgStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(currentSlide.accentColor, { duration: 400 }),
  }));

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (
        viewableItems[0]?.index !== null &&
        viewableItems[0]?.index !== undefined
      ) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  function handleNext() {
    if (isLast) {
      onComplete();
      return;
    }
    flatListRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
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
          <SlideItem
            slide={item}
            scrollX={scrollX}
            index={index}
            topInset={insets.top}
            activeIndex={activeIndex}
          />
        )}
      />

      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}
      >
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>{t("common.actions.skip")}</Text>
        </Pressable>

        <View style={styles.buttonRow}>
          <View style={styles.progressGroup}>
            <Text
              style={[
                styles.progressText,
                { color: currentSlide.progressColor },
              ]}
            >
              {activeIndex + 1}
            </Text>
            <Text style={styles.progressDivider}>/ {slideCount}</Text>
          </View>

          <View style={styles.pagination}>
            {SLIDES.map((item, i) => (
              <PaginationDot
                key={item.id}
                index={i}
                activeIndex={activeIndex}
                activeColor={currentSlide.progressColor}
              />
            ))}
          </View>

          <Pressable onPress={handleNext} accessibilityRole="button">
            <Animated.View style={[styles.ctaButton, ctaBgStyle]}>
              {isLast ? (
                <Text
                  style={[styles.ctaText, { color: currentSlide.ctaTextColor }]}
                >
                  {t("common.actions.getStarted")}
                </Text>
              ) : null}
              <Feather
                name="arrow-right"
                size={22}
                color={currentSlide.ctaTextColor}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  card: {
    flex: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#050505",
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  copyArea: {
    gap: 14,
    marginTop: 34,
  },
  headline: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 38,
    color: "#FFFFFF",
  },
  body: {
    fontSize: 15,
    lineHeight: 26,
    color: "rgba(255,255,255,0.62)",
    maxWidth: 280,
  },
  artworkArea: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  micRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  micRingOuter: {
    width: 280,
    height: 280,
  },
  micRingMid: {
    width: 220,
    height: 220,
  },
  micRingInner: {
    width: 164,
    height: 164,
  },
  micCore: {
    width: 122,
    height: 122,
    borderRadius: 61,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,13,15,0.92)",
    borderWidth: 1,
    borderColor: "rgba(210,244,92,0.22)",
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  micGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 61,
  },
  sideBubble: {
    position: "absolute",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  leftBubble: {
    left: 6,
    top: 140,
  },
  rightBubble: {
    right: 8,
    top: 182,
  },
  sideBubbleText: {
    fontSize: 16,
    color: "#F4F4E8",
  },
  spark: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 999,
    opacity: 0.9,
  },
  sparkLeft: {
    left: 76,
    top: 206,
  },
  sparkRight: {
    right: 76,
    top: 150,
  },
  replyArtwork: {
    flex: 1,
    marginTop: 18,
    justifyContent: "center",
    gap: 10,
  },
  replyAmbientOrb: {
    position: "absolute",
    top: 72,
    left: -12,
    right: -12,
    height: 220,
  },
  reviewAmbientOrb: {
    position: "absolute",
    top: 52,
    left: -12,
    right: -12,
    height: 260,
  },
  replyAmbientGradient: {
    flex: 1,
    borderRadius: 28,
  },
  messageCard: {
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 100,
  },
  cardTintOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  messageHeaderCopy: {
    flex: 1,
  },
  personLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.74)",
  },
  personTime: {
    marginLeft: "auto",
    fontSize: 13,
    color: "rgba(255,255,255,0.34)",
  },
  messageBody: {
    marginTop: 12,
    gap: 2,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 28,
    color: "#FFFFFF",
  },
  messageText2: {
    fontSize: 14,
    lineHeight: 28,
    color: "rgba(255,255,255,0.74)",
  },
  replyConnector: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  suggestionCard: {
    overflow: "hidden",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,174,87,0.08)",
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    minHeight: 100,
  },
  suggestionEyebrow: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  suggestionLine: {
    fontSize: 17,
    lineHeight: 28,
    color: "#FFFFFF",
  },
  suggestionLine2: {
    fontSize: 14,
    lineHeight: 28,
    color: "rgba(255,255,255,0.74)",
  },
  suggestionMeta: {
    marginTop: 12,
    fontSize: 13,
    color: "rgba(255,255,255,0.34)",
    textAlign: "right",
  },
  reviewArtwork: {
    flex: 1,
    marginTop: 18,
    justifyContent: "center",
  },
  reviewCardMuted: {
    overflow: "hidden",
    borderRadius: 22,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reviewLabelMuted: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6EAFFF",
    marginBottom: 12,
  },
  reviewSentenceMuted: {
    paddingRight: 28,
    fontSize: 20,
    lineHeight: 30,
    color: "#FFFFFF",
  },
  reviewArrow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  reviewCardActive: {
    overflow: "hidden",
    borderRadius: 22,
    padding: 20,
    backgroundColor: "rgba(88,166,255,0.08)",
    borderWidth: 1,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  reviewLabelActive: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  reviewSentenceActive: {
    paddingRight: 28,
    fontSize: 20,
    lineHeight: 30,
  },
  reviewIcon: {
    position: "absolute",
    right: 18,
    top: 18,
  },
  highlightSweep: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 96,
  },
  highlightSweepGradient: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 18,
    backgroundColor: "#000000",
  },
  progressGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    minWidth: 40,
  },
  progressText: {
    fontSize: 22,
    fontWeight: "800",
  },
  progressDivider: {
    fontSize: 15,
    color: "rgba(255,255,255,0.42)",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.58)",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 64,
    height: 64,
    paddingHorizontal: 18,
    borderRadius: 32,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
