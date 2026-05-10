/**
 * TalkPilot Design Tokens
 * Single source of truth for all colors, spacing, radii, shadows, and typography.
 * To retheme the app, only edit this file.
 */

import type { TextStyle, ViewStyle } from "react-native";

// ─── Color Palette ────────────────────────────────────────────────────────────

export const palette = {
  // Accent — Deeper Lime Green
  accent: "#C2EA45",
  accentDark: "#86AE00",
  accentDeep: "#0A1400",
  accentMuted: "rgba(194,234,69,0.12)",
  accentMutedMid: "rgba(194,234,69,0.18)",
  accentMutedStrong: "rgba(194,234,69,0.3)",
  accentBorder: "rgba(134,174,0,0.2)",
  accentBorderStrong: "rgba(134,174,0,0.3)",
  accentGradientEnd: "#A9D400",

  // Background
  bgBase: "#F3F7EE",
  bgCard: "rgba(255,255,255,0.75)",
  bgCardSolid: "rgba(255,255,255,0.95)",
  bgTabBar: "rgba(243,247,238,0.95)",
  bgInput: "rgba(194,234,69,0.06)",
  bgGhostButton: "rgba(194,234,69,0.1)",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  textAccent: "#86AE00",
  textOnAccent: "#0A1400",

  // Danger
  danger: "#DC2626",
  dangerLight: "rgba(220,38,38,0.07)",
  dangerBorder: "rgba(220,38,38,0.15)",
  dangerGradientStart: "#EF4444",

  // Disabled
  disabledBg: "#E5E7EB",
  disabledBgEnd: "#D1D5DB",
  disabledText: "#9CA3AF",

  // Neutral
  neutralBorder: "rgba(0,0,0,0.07)",
  neutralTrack: "rgba(0,0,0,0.07)",

  // Overlay
  overlayDark: "rgba(15,23,42,0.45)",
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows: Record<string, ViewStyle> = {
  card: {
    shadowColor: "#86AE00",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardSm: {
    shadowColor: "#86AE00",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardLg: {
    shadowColor: "#86AE00",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mic: {
    shadowColor: "#C2EA45",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  tabBar: {
    shadowColor: "#86AE00",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  usageCard: {
    shadowColor: "#C2EA45",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  pill: 999,
  circle: 9999,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography: Record<string, TextStyle> = {
  displayLg: { fontSize: 34, fontWeight: "800", lineHeight: 40 },
  displayMd: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  displaySm: { fontSize: 20, fontWeight: "800" },
  bodyLg: { fontSize: 16, lineHeight: 24 },
  bodyMd: { fontSize: 15, lineHeight: 22 },
  bodySm: { fontSize: 14 },
  labelLg: { fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  labelMd: { fontSize: 12, fontWeight: "700" },
  labelSm: { fontSize: 11, fontWeight: "700" },
  caption: { fontSize: 11, fontWeight: "600" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  tabLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  timer: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
};
