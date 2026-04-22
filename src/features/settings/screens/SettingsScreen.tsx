import {
  Audio,
} from "expo-av";
import {
  type LearningLanguage,
  type UiLocale,
  SUPPORTED_LEARNING_LANGUAGES,
  SUPPORTED_UI_LOCALES,
  useAppLanguage,
} from "@/shared/i18n";
import { voiceEnrollmentService } from "@/features/live/services/VoiceEnrollmentService";
import { useOnboardingState } from "@/features/onboarding/hooks/useOnboardingState";
import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function LanguageOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionRow, selected && styles.optionRowSelected]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {label}
      </Text>
      {selected ? <Feather name="check" size={16} color={palette.textAccent} /> : null}
    </Pressable>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: "rgba(255,255,255,0.16)",
          true: palette.textAccent,
        }}
        thumbColor={value ? "#08190A" : "#F4F6F8"}
        ios_backgroundColor="rgba(255,255,255,0.16)"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    t,
    uiLocale,
    followSystemUiLocale,
    setUiLocale,
    followSystem,
    learningLanguage,
    setLearningLanguage,
  } = useAppLanguage();
  const {
    checked: onboardingStateChecked,
    forceShowOnboarding,
    setForceShowOnboarding,
  } = useOnboardingState();
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [hasEnrollment, setHasEnrollment] = React.useState(false);
  const [isEnrollmentLoading, setIsEnrollmentLoading] = React.useState(true);
  const [isPlayingEnrollment, setIsPlayingEnrollment] = React.useState(false);
  const [isEnrollmentBusy, setIsEnrollmentBusy] = React.useState(false);

  const currentAppLanguageName = t(`common.languageName.${uiLocale}`);

  const stopEnrollmentPlayback = React.useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setIsPlayingEnrollment(false);
    if (!sound) {
      return;
    }

    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
  }, []);

  const refreshEnrollmentStatus = React.useCallback(async () => {
    setIsEnrollmentLoading(true);
    try {
      setHasEnrollment(await voiceEnrollmentService.hasEnrollment());
    } finally {
      setIsEnrollmentLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshEnrollmentStatus();
    return () => {
      void stopEnrollmentPlayback();
    };
  }, [refreshEnrollmentStatus, stopEnrollmentPlayback]);

  const handlePlayEnrollment = React.useCallback(async () => {
    if (!hasEnrollment || isEnrollmentBusy) {
      return;
    }

    setIsEnrollmentBusy(true);
    try {
      await stopEnrollmentPlayback();
      const playbackUri = await voiceEnrollmentService.preparePlaybackUri();
      if (!playbackUri) {
        Alert.alert(
          t("settings.voiceEnrollment.unavailableTitle"),
          t("settings.voiceEnrollment.unavailableBody"),
        );
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setIsPlayingEnrollment(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          return;
        }
        if (status.didJustFinish) {
          void stopEnrollmentPlayback();
        }
      });
    } catch (error) {
      console.error("[Settings] Failed to play enrollment sample:", error);
      Alert.alert(
        t("settings.voiceEnrollment.playbackErrorTitle"),
        t("settings.voiceEnrollment.playbackErrorBody"),
      );
    } finally {
      setIsEnrollmentBusy(false);
    }
  }, [
    hasEnrollment,
    isEnrollmentBusy,
    stopEnrollmentPlayback,
    t,
  ]);

  const handleResetEnrollment = React.useCallback(() => {
    if (isEnrollmentBusy) {
      return;
    }

    Alert.alert(
      t("settings.voiceEnrollment.resetConfirmTitle"),
      t("settings.voiceEnrollment.resetConfirmBody"),
      [
        {
          text: t("common.actions.cancel"),
          style: "cancel",
        },
        {
          text: t("settings.voiceEnrollment.resetAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsEnrollmentBusy(true);
              try {
                await stopEnrollmentPlayback();
                await voiceEnrollmentService.clearEnrollment();
                setHasEnrollment(false);
              } finally {
                setIsEnrollmentBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [isEnrollmentBusy, stopEnrollmentPlayback, t]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel={t("common.actions.close")}
        >
          <Feather name="arrow-left" size={18} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{t("settings.title")}</Text>
          <Text style={styles.headerSubtitle}>{t("settings.subtitle")}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.section.appLanguage")}</Text>
          <Text style={styles.sectionDescription}>
            {t("settings.appLanguage.description")}
          </Text>

          <LanguageOption
            label={t("settings.appLanguage.followSystemTitle")}
            selected={followSystemUiLocale}
            onPress={() => {
              void followSystem();
            }}
          />
          <Text style={styles.followSystemHint}>
            {t("settings.appLanguage.followSystemDescription", {
              language: currentAppLanguageName,
            })}
          </Text>

          {SUPPORTED_UI_LOCALES.map((locale) => (
            <LanguageOption
              key={locale}
              label={t(`common.languageName.${locale}`)}
              selected={!followSystemUiLocale && uiLocale === locale}
              onPress={() => {
                void setUiLocale(locale as UiLocale);
              }}
            />
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.section.learningLanguage")}</Text>
          <Text style={styles.sectionDescription}>
            {t("settings.learningLanguage.description")}
          </Text>

          {SUPPORTED_LEARNING_LANGUAGES.map((language) => (
            <LanguageOption
              key={language}
              label={t(`common.languageName.${language}`)}
              selected={learningLanguage === language}
              onPress={() => {
                setLearningLanguage(language as LearningLanguage);
              }}
            />
          ))}

          <View style={styles.notice}>
            <Feather name="info" size={14} color={palette.textSecondary} />
            <Text style={styles.noticeText}>
              {t("settings.learningLanguage.supportNote")}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.voiceEnrollment.title")}</Text>
          <Text style={styles.sectionDescription}>
            {t("settings.voiceEnrollment.description")}
          </Text>

          <View style={styles.enrollmentStatusRow}>
            <View style={styles.enrollmentStatusCopy}>
              <Text style={styles.enrollmentStatusLabel}>
                {t("settings.voiceEnrollment.statusLabel")}
              </Text>
              <Text style={styles.enrollmentStatusValue}>
                {isEnrollmentLoading
                  ? t("settings.voiceEnrollment.loading")
                  : hasEnrollment
                    ? t("settings.voiceEnrollment.saved")
                    : t("settings.voiceEnrollment.notSaved")}
              </Text>
            </View>
            {isEnrollmentLoading || isEnrollmentBusy ? (
              <ActivityIndicator size="small" color={palette.textAccent} />
            ) : null}
          </View>

          <Text style={styles.followSystemHint}>
            {hasEnrollment
              ? t("settings.voiceEnrollment.savedHint")
              : t("settings.voiceEnrollment.emptyHint")}
          </Text>

          <View style={styles.enrollmentActions}>
            <Pressable
              onPress={() => {
                void handlePlayEnrollment();
              }}
              disabled={!hasEnrollment || isEnrollmentBusy}
              style={[
                styles.secondaryActionButton,
                (!hasEnrollment || isEnrollmentBusy) && styles.actionButtonDisabled,
              ]}
            >
              <Feather
                name={isPlayingEnrollment ? "volume-2" : "play"}
                size={16}
                color={hasEnrollment && !isEnrollmentBusy ? palette.textAccent : palette.textTertiary}
              />
              <Text
                style={[
                  styles.secondaryActionText,
                  (!hasEnrollment || isEnrollmentBusy) && styles.actionTextDisabled,
                ]}
              >
                {isPlayingEnrollment
                  ? t("settings.voiceEnrollment.playing")
                  : t("settings.voiceEnrollment.playAction")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleResetEnrollment}
              disabled={!hasEnrollment || isEnrollmentBusy}
              style={[
                styles.dangerActionButton,
                (!hasEnrollment || isEnrollmentBusy) && styles.actionButtonDisabled,
              ]}
            >
              <Feather
                name="rotate-ccw"
                size={16}
                color={hasEnrollment && !isEnrollmentBusy ? palette.danger : palette.textTertiary}
              />
              <Text
                style={[
                  styles.dangerActionText,
                  (!hasEnrollment || isEnrollmentBusy) && styles.actionTextDisabled,
                ]}
              >
                {t("settings.voiceEnrollment.resetAction")}
              </Text>
            </Pressable>
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("settings.section.debug")}</Text>
            <Text style={styles.sectionDescription}>
              {t("settings.debug.description")}
            </Text>

            <ToggleRow
              title={t("settings.debug.forceOnboardingTitle")}
              description={t("settings.debug.forceOnboardingDescription")}
              value={forceShowOnboarding}
              disabled={!onboardingStateChecked}
              onValueChange={(nextValue) => {
                void setForceShowOnboarding(nextValue);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentBorder,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: palette.bgCard,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodySm,
    color: palette.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    gap: spacing.sm,
    ...shadows.card,
  },
  sectionTitle: {
    ...typography.bodyLg,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  sectionDescription: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  toggleRow: {
    marginTop: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: palette.bgGhostButton,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  toggleRowDisabled: {
    opacity: 0.6,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    ...typography.bodyMd,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  toggleDescription: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  optionRow: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    backgroundColor: palette.bgGhostButton,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  optionRowSelected: {
    borderColor: palette.accentBorderStrong,
    backgroundColor: palette.accentMuted,
  },
  optionLabel: {
    ...typography.bodyMd,
    color: palette.textPrimary,
  },
  optionLabelSelected: {
    color: palette.textAccent,
    fontWeight: "700",
  },
  followSystemHint: {
    ...typography.caption,
    color: palette.textTertiary,
    marginTop: spacing.xs,
  },
  notice: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  noticeText: {
    flex: 1,
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 17,
  },
  enrollmentStatusRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  enrollmentStatusCopy: {
    flex: 1,
    gap: 2,
  },
  enrollmentStatusLabel: {
    ...typography.caption,
    color: palette.textTertiary,
  },
  enrollmentStatusValue: {
    ...typography.bodyMd,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  enrollmentActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
    backgroundColor: palette.accentMuted,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryActionText: {
    ...typography.bodySm,
    color: palette.textAccent,
    fontWeight: "700",
  },
  dangerActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dangerActionText: {
    ...typography.bodySm,
    color: palette.danger,
    fontWeight: "700",
  },
  actionButtonDisabled: {
    borderColor: palette.accentBorder,
    backgroundColor: palette.bgGhostButton,
  },
  actionTextDisabled: {
    color: palette.textTertiary,
  },
});
