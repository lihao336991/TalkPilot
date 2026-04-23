import { getLanguageDisplayName } from '@/shared/locale/deviceLanguage';
import { useTranslation } from "react-i18next";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  sourceText: string;
  sourceLanguage?: string;
  translatedText: string;
  hint?: string | null;
  status: "recording" | "processing" | "ready";
};

export default function NativeAssistCard({
  sourceText,
  sourceLanguage,
  translatedText,
  hint,
  status,
}: Props) {
  const { i18n, t } = useTranslation();
  const languageLabel = sourceLanguage
    ? getLanguageDisplayName(sourceLanguage, i18n.language === "zh-CN" ? "zh-CN" : "en")
    : t("common.labels.native");

  const statusText =
    status === "recording"
      ? t("live.nativeAssist.listening")
      : status === "processing"
        ? t("live.nativeAssist.generating")
        : t("live.nativeAssist.ready");

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{statusText}</Text>
      {sourceText ? (
        <View style={styles.section}>
          <Text style={styles.label}>
            {t("live.nativeAssist.original", { language: languageLabel })}
          </Text>
          <Text style={styles.sourceText}>{sourceText}</Text>
        </View>
      ) : null}
      {translatedText ? (
        <View style={styles.section}>
          <Text style={styles.label}>{t("live.nativeAssist.suggestedReply")}</Text>
          <Text style={styles.enText}>{translatedText}</Text>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(21,22,25,0.08)",
    gap: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B5F66",
  },
  section: {
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(21,22,25,0.42)",
  },
  sourceText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
  enText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#151619",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(21,22,25,0.62)",
  },
});
