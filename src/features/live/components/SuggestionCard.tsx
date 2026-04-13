import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type SuggestionStyle = "formal" | "casual" | "simple";

type Props = {
  suggestion: {
    style: SuggestionStyle;
    text: string;
  };
  onPress?: () => void;
};

export default function SuggestionCard({ suggestion, onPress }: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.bubble} onPress={onPress}>
        <Text style={styles.label}>{suggestion.style}</Text>
        <Text style={styles.text}>{suggestion.text}</Text>
      </Pressable>
      <View style={styles.tailShadow} />
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: 292,
    paddingBottom: 10,
    paddingLeft: 10,
  },
  bubble: {
    borderRadius: 24,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    gap: 6,
    shadowColor: "#151619",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(21,22,25,0.4)",
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1A1A1A",
  },
  tailShadow: {
    position: "absolute",
    left: 12,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(21,22,25,0.06)",
    transform: [{ rotate: "45deg" }],
  },
  tail: {
    position: "absolute",
    left: 10,
    bottom: 6,
    width: 16,
    height: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },
});
