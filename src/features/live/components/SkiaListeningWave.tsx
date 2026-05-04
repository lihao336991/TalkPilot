import { Canvas, RoundedRect } from "@shopify/react-native-skia";
import { palette } from "@/shared/theme/tokens";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

type SkiaListeningWaveProps = {
  level: number;
  style?: StyleProp<ViewStyle>;
  width?: number;
  height?: number;
  barCount?: number;
};

type WaveBar = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_WIDTH = 236;
const DEFAULT_HEIGHT = 76;
const DEFAULT_BAR_COUNT = 14;
const SAMPLE_INTERVAL_MS = 50;
const BAR_WIDTH = 4;
const BAR_GAP = 4;
const BAR_MIN_HEIGHT = 6;
const EMA_ATTACK = 0.62;
const EMA_RELEASE = 0.32;
const SILENCE_THRESHOLD = 0.012;
const VOLUME_POWER = 0.6;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function shapeIncomingLevel(level: number) {
  const clamped = clamp01(level);
  if (clamped < SILENCE_THRESHOLD) {
    return 0;
  }
  return Math.pow(clamped, VOLUME_POWER);
}

function buildWeights(barCount: number) {
  const weights = new Array(barCount).fill(1);
  const mid = Math.floor(barCount / 2);

  for (let index = 0; index < barCount; index += 1) {
    const normalizedDistance = mid === 0 ? 0 : Math.abs(index - mid) / mid;
    const cosineWeight = Math.cos(normalizedDistance * Math.PI * 0.5);
    weights[index] = 0.28 + cosineWeight * 0.82;
  }

  return weights;
}

function seededUnit(index: number, seed: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function SkiaListeningWave({
  level,
  style,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  barCount = DEFAULT_BAR_COUNT,
}: SkiaListeningWaveProps) {
  const latestLevelRef = useRef(shapeIncomingLevel(level));
  const [phase, setPhase] = useState(0);
  const [smoothedLevel, setSmoothedLevel] = useState(shapeIncomingLevel(level));

  useEffect(() => {
    latestLevelRef.current = shapeIncomingLevel(level);
  }, [level]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((current) => current + 0.22);
      setSmoothedLevel((current) => {
        const incoming = latestLevelRef.current;
        const alpha = incoming > current ? EMA_ATTACK : EMA_RELEASE;
        return current * (1 - alpha) + incoming * alpha;
      });
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  const weights = useMemo(() => buildWeights(barCount), [barCount]);

  const bars = useMemo<WaveBar[]>(() => {
    const totalWidth = barCount * BAR_WIDTH + (barCount - 1) * BAR_GAP;
    const startX = (width - totalWidth) / 2;
    const baselineY = height * 0.82;
    const maxHeightRange = height * 0.52 - BAR_MIN_HEIGHT;
    const ambientLevel = 0.07;

    return weights.map((weight, index) => {
      const seedA = seededUnit(index, 1.7);
      const seedB = seededUnit(index, 5.1);
      const localPhase = phase * (0.72 + seedA * 0.66);
      const jitterWave =
        Math.sin(localPhase + seedB * Math.PI * 2) * (0.55 + seedA * 0.15) +
        Math.cos(localPhase * 0.83 + index * 0.91 + seedA * 4) * 0.35;
      const jitter = 0.5 + 0.5 * clamp01((jitterWave + 1) / 2);
      const activity = Math.max(ambientLevel, smoothedLevel);
      const barHeight =
        BAR_MIN_HEIGHT +
        weight * activity * maxHeightRange * (0.42 + jitter * 0.58);
      const x = startX + index * (BAR_WIDTH + BAR_GAP);

      return {
        x,
        y: baselineY - barHeight,
        width: BAR_WIDTH,
        height: barHeight,
      };
    });
  }, [barCount, height, phase, smoothedLevel, weights, width]);

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Canvas style={styles.canvas}>
        {bars.map((bar, index) => (
          <RoundedRect
            key={`bar-${index}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            r={bar.width / 2}
            opacity={0.56}
            color={palette.accent}
          />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  canvas: {
    flex: 1,
  },
});
