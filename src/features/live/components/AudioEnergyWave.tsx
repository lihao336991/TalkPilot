import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type AudioEnergyWaveProps = {
  level: number;
  color?: string;
  barCount?: number;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  barRadius?: number;
  gap?: number;
  idleOpacity?: number;
  calmness?: number;
  tailFade?: number;
  glowColor?: string;
  glowIntensity?: number;
  mirror?: boolean;
  centerLineColor?: string;
  centerLineCount?: number;
  centerLineSpacing?: number;
  centerLineThickness?: number;
  centerLineOpacity?: number;
  spikeBoost?: number;
  style?: ViewStyle;
};

type AudioEnergyBarProps = {
  index: number;
  count: number;
  color: string;
  width: number;
  minHeight: number;
  maxHeight: number;
  barRadius: number;
  level: SharedValue<number>;
  phaseFast: SharedValue<number>;
  phaseSlow: SharedValue<number>;
  idleOpacity: number;
  calmness: number;
  tailFade: number;
  glowColor?: string;
  glowIntensity: number;
  mirror: boolean;
  spikeBoost: number;
};

function AudioEnergyBar({
  index,
  count,
  color,
  width,
  minHeight,
  maxHeight,
  barRadius,
  level,
  phaseFast,
  phaseSlow,
  idleOpacity,
  calmness,
  tailFade,
  glowColor,
  glowIntensity,
  mirror,
  spikeBoost,
}: AudioEnergyBarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const normalizedIndex = count <= 1 ? 0 : index / (count - 1);
    const distanceFromCenter = Math.abs(normalizedIndex - 0.5) * 2;
    const centerWeight = 1 - distanceFromCenter;
    const energy = Math.max(0, Math.min(1, level.value));
    const visualEnergy = Math.max(energy, Math.min(0.22, energy * 2.6));
    const centerBoost = 0.72 + centerWeight * spikeBoost;
    const clusterA = Math.max(0, Math.sin(phaseFast.value * 1.05 + index * 0.72));
    const clusterB = Math.max(0, Math.sin(phaseFast.value * 1.92 + index * 1.36 + 0.8));
    const clusterC = Math.max(0, Math.sin(phaseFast.value * 2.7 + index * 0.38 + 1.7));
    const breathing = 0.88 + 0.12 * Math.sin(phaseSlow.value + index * 0.08);
    const ridge = 0.22 + centerWeight * 0.32;
    const spikeMix =
      clusterA * (0.24 + centerWeight * 0.16) +
      clusterB * (0.34 + centerWeight * 0.18) +
      clusterC * (0.16 + (1 - centerWeight) * 0.1);
    const irregularity =
      0.86 +
      0.14 * Math.sin(index * 1.73) +
      0.08 * Math.cos(index * 0.47);
    const waveMotion = ridge + spikeMix * breathing * irregularity;
    const floor = minHeight + (maxHeight - minHeight) * 0.04 * (0.5 + centerWeight * 0.5);
    const spikeHeight =
      floor + (maxHeight - floor) * visualEnergy * centerBoost * waveMotion;
    const edgeFade = 1 - Math.pow(distanceFromCenter, 1.25) * tailFade;
    const totalHeight = mirror ? spikeHeight * 2 : spikeHeight;

    return {
      height: totalHeight,
      opacity:
        (idleOpacity + (1 - idleOpacity) * (0.2 + visualEnergy * 0.8)) *
        edgeFade,
      backgroundColor: color,
      width,
      borderRadius: barRadius,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const normalizedIndex = count <= 1 ? 0 : index / (count - 1);
    const distanceFromCenter = Math.abs(normalizedIndex - 0.5) * 2;
    const centerWeight = 1 - distanceFromCenter;
    const energy = Math.max(0, Math.min(1, level.value));
    const visualEnergy = Math.max(energy, Math.min(0.22, energy * 2.6));
    const edgeFade = 1 - Math.pow(distanceFromCenter, 1.18) * tailFade;
    const glowPulseA = Math.max(0, Math.sin(phaseFast.value * 1.18 + index * 0.66));
    const glowPulseB = Math.max(0, Math.sin(phaseFast.value * 2.2 + index * 1.12 + 0.5));
    const glowMix = glowPulseA * (0.24 + centerWeight * 0.1) + glowPulseB * 0.34;
    const spikeHeight =
      minHeight +
      (maxHeight - minHeight) *
        (0.12 + visualEnergy * (0.44 + centerWeight * 0.28 + glowMix * 0.3));
    const totalHeight = mirror ? spikeHeight * 2 : spikeHeight;

    return {
      height: totalHeight,
      opacity: glowIntensity * (0.18 + visualEnergy * 0.72) * edgeFade,
      width: width + 6,
      borderRadius: barRadius,
      backgroundColor: glowColor ?? color,
      transform: [{ scaleY: 1.16 }],
    };
  });

  return (
    <View style={styles.barSlot}>
      {glowColor ? <Animated.View pointerEvents="none" style={[styles.glowBar, glowStyle]} /> : null}
      <Animated.View style={animatedStyle} />
    </View>
  );
}

export function AudioEnergyWave({
  level,
  color = "rgba(32,72,17,0.78)",
  barCount = 11,
  width = 4,
  minHeight = 8,
  maxHeight = 30,
  barRadius = 999,
  gap = 4,
  idleOpacity = 0.32,
  calmness = 0.82,
  tailFade = 0.32,
  glowColor,
  glowIntensity = 0,
  mirror = false,
  centerLineColor,
  centerLineCount = 0,
  centerLineSpacing = 4,
  centerLineThickness = 1,
  centerLineOpacity = 0.22,
  spikeBoost = 0.32,
  style,
}: AudioEnergyWaveProps) {
  const levelValue = useSharedValue(Math.max(0, Math.min(1, level)));
  const phaseFast = useSharedValue(0);
  const phaseSlow = useSharedValue(0);
  const waveHeight = mirror ? maxHeight * 2 + 12 : maxHeight + 10;

  useEffect(() => {
    levelValue.value = withTiming(Math.max(0, Math.min(1, level)), {
      duration: 70,
      easing: Easing.out(Easing.quad),
    });
  }, [level, levelValue]);

  useEffect(() => {
    phaseFast.value = 0;
    phaseFast.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: 1100,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    phaseSlow.value = 0;
    phaseSlow.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: 2800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(phaseFast);
      cancelAnimation(phaseSlow);
    };
  }, [phaseFast, phaseSlow]);

  return (
    <View style={[styles.root, { height: waveHeight }, style]}>
      {centerLineCount > 0 ? (
        <View pointerEvents="none" style={styles.centerLineWrap}>
          {Array.from({ length: centerLineCount }).map((_, index) => {
            const centerIndex = (centerLineCount - 1) / 2;
            const offset = (index - centerIndex) * centerLineSpacing;
            const alpha =
              centerLineOpacity * (1 - Math.abs(index - centerIndex) / Math.max(1, centerIndex + 0.6));
            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.centerLine,
                  {
                    top: waveHeight / 2 - centerLineThickness / 2 + offset,
                    height: centerLineThickness,
                    backgroundColor: centerLineColor ?? color,
                    opacity: alpha,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
      <View style={[styles.row, { columnGap: gap, height: waveHeight }]}>
      {Array.from({ length: barCount }).map((_, index) => (
        <AudioEnergyBar
          key={index}
          index={index}
          count={barCount}
          color={color}
          width={width}
          minHeight={minHeight}
          maxHeight={maxHeight}
          barRadius={barRadius}
          level={levelValue}
          phaseFast={phaseFast}
          phaseSlow={phaseSlow}
          idleOpacity={idleOpacity}
          calmness={calmness}
          tailFade={tailFade}
          glowColor={glowColor}
          glowIntensity={glowIntensity}
          mirror={mirror}
          spikeBoost={spikeBoost}
        />
      ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  centerLineWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  centerLine: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  barSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowBar: {
    position: "absolute",
  },
});
