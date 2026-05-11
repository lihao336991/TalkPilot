import { voiceEnrollmentService } from "@/features/live/services/VoiceEnrollmentService";
import { useOnboardingState } from "@/features/onboarding/hooks/useOnboardingState";
import { AiDataConsentModal } from "@/features/privacy/components/AiDataConsentModal";
import { useAiConsentState } from "@/features/privacy/useAiConsentState";
import { deleteAccount } from "@/shared/api/supabase";
import { useAlert } from "@/shared/components";
import {
    type LearningLanguage,
    type UiLocale,
    SUPPORTED_LEARNING_LANGUAGES,
    SUPPORTED_UI_LOCALES,
    getLanguageSelfName,
    languageTagsMatch,
    useAppLanguage,
} from "@/shared/i18n";
import { useAuthStore } from "@/shared/store/authStore";
import {
    palette,
    radii,
    shadows,
    spacing,
    typography,
} from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
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
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionRow,
        selected && styles.optionRowSelected,
        disabled && styles.optionRowDisabled,
      ]}
    >
      <Text
        style={[styles.optionLabel, selected && styles.optionLabelSelected]}
      >
        {label}
      </Text>
      {selected ? (
        <Feather name="check" size={16} color={palette.textAccent} />
      ) : null}
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

function NavigationRow({
  title,
  description,
  onPress,
  destructive = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  description: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.navigationRow,
        destructive && styles.navigationRowDestructive,
        disabled && styles.navigationRowDisabled,
      ]}
    >
      <View style={styles.navigationCopy}>
        <Text
          style={[
            styles.navigationTitle,
            destructive && styles.navigationTitleDestructive,
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.navigationDescription,
            destructive && styles.navigationDescriptionDestructive,
          ]}
        >
          {description}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={destructive ? palette.danger : palette.textAccent}
        />
      ) : (
        <Feather
          name={destructive ? "trash-2" : "chevron-right"}
          size={18}
          color={destructive ? palette.danger : palette.textSecondary}
        />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const authMode = useAuthStore((s) => s.authMode);
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
  const { hasAccepted: hasAcceptedAiConsent, accept: acceptAiConsent } =
    useAiConsentState();
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [hasEnrollment, setHasEnrollment] = React.useState(false);
  const [enrollmentAvailability, setEnrollmentAvailability] = React.useState<
    "missing" | "legacy_pcm_only" | "ready"
  >("missing");
  const [isEnrollmentLoading, setIsEnrollmentLoading] = React.useState(true);
  const [isPlayingEnrollment, setIsPlayingEnrollment] = React.useState(false);
  const [isEnrollmentBusy, setIsEnrollmentBusy] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [showAiConsentModal, setShowAiConsentModal] = React.useState(false);
  const [isSavingAiConsent, setIsSavingAiConsent] = React.useState(false);

  const currentAppLanguageName = getLanguageSelfName(uiLocale);
  const isAuthenticated = authMode === "authenticated";

  const openLegalFromConsent = React.useCallback(
    (path: "/privacy" | "/terms") => {
      setShowAiConsentModal(false);
      setIsSavingAiConsent(false);
      setTimeout(() => {
        router.push(path);
      }, 0);
    },
    [router],
  );

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
      const availability =
        await voiceEnrollmentService.getEnrollmentAvailability();
      setEnrollmentAvailability(availability);
      setHasEnrollment(availability !== "missing");
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
        showAlert({
          title: t("settings.voiceEnrollment.unavailableTitle"),
          message: t("settings.voiceEnrollment.unavailableBody"),
        });
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
      showAlert({
        title: t("settings.voiceEnrollment.playbackErrorTitle"),
        message: t("settings.voiceEnrollment.playbackErrorBody"),
      });
    } finally {
      setIsEnrollmentBusy(false);
    }
  }, [hasEnrollment, isEnrollmentBusy, stopEnrollmentPlayback, t]);

  const handleResetEnrollment = React.useCallback(() => {
    if (isEnrollmentBusy) {
      return;
    }

    showAlert({
      title: t("settings.voiceEnrollment.resetConfirmTitle"),
      message: t("settings.voiceEnrollment.resetConfirmBody"),
      buttons: [
        {
          text: t("common.actions.cancel"),
          variant: "cancel",
        },
        {
          text: t("settings.voiceEnrollment.resetAction"),
          variant: "destructive",
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
    });
  }, [isEnrollmentBusy, stopEnrollmentPlayback, t]);

  const performDeleteAccount = React.useCallback(async () => {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      showAlert({
        title: t("settings.account.deleteSuccessTitle"),
        message: t("settings.account.deleteSuccessMessage"),
        buttons: [
          {
            text: t("common.actions.gotIt"),
            onPress: () => {
              router.replace("/(tabs)/profile");
            },
          },
        ],
      });
    } catch (error) {
      console.error("[Settings] Failed to delete account:", error);
      showAlert({
        title: t("settings.account.deleteFailedTitle"),
        message:
          error instanceof Error && error.message
            ? error.message
            : t("settings.account.deleteFailedMessage"),
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }, [isDeletingAccount, router, showAlert, t]);

  const showFinalDeleteConfirmation = React.useCallback(() => {
    // Defer the second confirmation until the current alert finishes dismissing.
    setTimeout(() => {
      showAlert({
        title: t("settings.account.deleteFinalTitle"),
        message: t("settings.account.deleteFinalMessage"),
        buttons: [
          {
            text: t("common.actions.cancel"),
            variant: "cancel",
          },
          {
            text: t("common.actions.deleteAccount"),
            variant: "destructive",
            onPress: () => {
              void performDeleteAccount();
            },
          },
        ],
      });
    }, 0);
  }, [performDeleteAccount, showAlert, t]);

  const handleDeleteAccount = React.useCallback(() => {
    if (!isAuthenticated || isDeletingAccount) {
      return;
    }

    showAlert({
      title: t("settings.account.deleteConfirmTitle"),
      message: t("settings.account.deleteConfirmMessage"),
      buttons: [
        {
          text: t("common.actions.cancel"),
          variant: "cancel",
        },
        {
          text: t("common.actions.continue"),
          onPress: () => {
            showFinalDeleteConfirmation();
          },
        },
      ],
    });
  }, [isAuthenticated, isDeletingAccount, showAlert, showFinalDeleteConfirmation, t]);

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
          <Text style={styles.sectionTitle}>
            {t("settings.section.appLanguage")}
          </Text>
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

          {SUPPORTED_UI_LOCALES.map((locale) => {
            const conflictsWithLearningLanguage = languageTagsMatch(
              locale,
              learningLanguage,
            );

            return (
              <LanguageOption
                key={locale}
                label={getLanguageSelfName(locale)}
                selected={!followSystemUiLocale && uiLocale === locale}
                disabled={conflictsWithLearningLanguage}
                onPress={() => {
                  void setUiLocale(locale as UiLocale);
                }}
              />
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t("settings.section.learningLanguage")}
          </Text>
          <Text style={styles.sectionDescription}>
            {t("settings.learningLanguage.description")}
          </Text>

          {SUPPORTED_LEARNING_LANGUAGES.map((language) => {
            const conflictsWithNativeLanguage = languageTagsMatch(
              language,
              uiLocale,
            );

            return (
              <LanguageOption
                key={language}
                label={getLanguageSelfName(language)}
                selected={learningLanguage === language}
                disabled={conflictsWithNativeLanguage}
                onPress={() => {
                  setLearningLanguage(language as LearningLanguage);
                }}
              />
            );
          })}

          <View style={styles.notice}>
            <Feather name="info" size={14} color={palette.textSecondary} />
            <Text style={styles.noticeText}>
              {t("settings.learningLanguage.supportNote")}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t("settings.voiceEnrollment.title")}
          </Text>
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
                  : enrollmentAvailability === "ready"
                    ? t("settings.voiceEnrollment.enhancedReady")
                    : enrollmentAvailability === "legacy_pcm_only"
                      ? t("settings.voiceEnrollment.legacyOnly")
                      : t("settings.voiceEnrollment.notSaved")}
              </Text>
            </View>
            {isEnrollmentLoading || isEnrollmentBusy ? (
              <ActivityIndicator size="small" color={palette.textAccent} />
            ) : null}
          </View>

          <Text style={styles.followSystemHint}>
            {enrollmentAvailability === "ready"
              ? t("settings.voiceEnrollment.savedHint")
              : enrollmentAvailability === "legacy_pcm_only"
                ? t("settings.voiceEnrollment.legacyHint")
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
                (!hasEnrollment || isEnrollmentBusy) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Feather
                name={isPlayingEnrollment ? "volume-2" : "play"}
                size={16}
                color={
                  hasEnrollment && !isEnrollmentBusy
                    ? palette.textAccent
                    : palette.textTertiary
                }
              />
              <Text
                style={[
                  styles.secondaryActionText,
                  (!hasEnrollment || isEnrollmentBusy) &&
                    styles.actionTextDisabled,
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
                (!hasEnrollment || isEnrollmentBusy) &&
                  styles.actionButtonDisabled,
              ]}
            >
              <Feather
                name="rotate-ccw"
                size={16}
                color={
                  hasEnrollment && !isEnrollmentBusy
                    ? palette.danger
                    : palette.textTertiary
                }
              />
              <Text
                style={[
                  styles.dangerActionText,
                  (!hasEnrollment || isEnrollmentBusy) &&
                    styles.actionTextDisabled,
                ]}
              >
                {t("settings.voiceEnrollment.resetAction")}
              </Text>
            </Pressable>
          </View>
        </View>

        {isAuthenticated ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t("settings.section.account")}
            </Text>
            <Text style={styles.sectionDescription}>
              {t("settings.account.description")}
            </Text>

            <NavigationRow
              title={t("settings.account.deleteTitle")}
              description={t("settings.account.deleteDescription")}
              onPress={handleDeleteAccount}
              destructive
              disabled={isDeletingAccount}
              loading={isDeletingAccount}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("settings.section.legal")}</Text>
          <Text style={styles.sectionDescription}>
            {t("settings.legal.description")}
          </Text>

          <NavigationRow
            title={t("settings.legal.aiConsentTitle")}
            description={t(
              hasAcceptedAiConsent
                ? "settings.legal.aiConsentAcceptedDescription"
                : "settings.legal.aiConsentPendingDescription",
            )}
            onPress={() => {
              setShowAiConsentModal(true);
            }}
          />

          <NavigationRow
            title={t("settings.legal.privacyTitle")}
            description={t("settings.legal.privacyDescription")}
            onPress={() => {
              router.push("/privacy");
            }}
          />

          <NavigationRow
            title={t("settings.legal.termsTitle")}
            description={t("settings.legal.termsDescription")}
            onPress={() => {
              router.push("/terms");
            }}
          />
        </View>

        {__DEV__ ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t("settings.section.debug")}
            </Text>
            <Text style={styles.sectionDescription}>
              {t("settings.debug.description")}
            </Text>

            <NavigationRow
              title={t("settings.debug.devHomeTitle")}
              description={t("settings.debug.devHomeDescription")}
              onPress={() => {
                router.push("/(dev)/test");
              }}
            />

            <NavigationRow
              title={t("settings.debug.voiceprintDebugTitle")}
              description={t("settings.debug.voiceprintDebugDescription")}
              onPress={() => {
                router.push("/(dev)/voiceprint");
              }}
            />

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

      <AiDataConsentModal
        visible={showAiConsentModal}
        hasAccepted={hasAcceptedAiConsent}
        isSaving={isSavingAiConsent}
        onAgree={() => {
          void (async () => {
            if (isSavingAiConsent) {
              return;
            }

            setIsSavingAiConsent(true);
            try {
              await acceptAiConsent();
              setShowAiConsentModal(false);
            } finally {
              setIsSavingAiConsent(false);
            }
          })();
        }}
        onClose={() => {
          setShowAiConsentModal(false);
          setIsSavingAiConsent(false);
        }}
        onOpenPrivacy={() => {
          openLegalFromConsent("/privacy");
        }}
        onOpenTerms={() => {
          openLegalFromConsent("/terms");
        }}
      />
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
  navigationRow: {
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
  navigationRowDestructive: {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerLight,
  },
  navigationRowDisabled: {
    opacity: 0.6,
  },
  navigationCopy: {
    flex: 1,
    gap: 4,
  },
  navigationTitle: {
    ...typography.bodyMd,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  navigationTitleDestructive: {
    color: palette.danger,
  },
  navigationDescription: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  navigationDescriptionDestructive: {
    color: palette.danger,
    opacity: 0.9,
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
  optionRowDisabled: {
    opacity: 0.42,
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
