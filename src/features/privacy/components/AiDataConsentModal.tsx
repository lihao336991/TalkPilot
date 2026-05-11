import { palette, radii, shadows, spacing, typography } from "@/shared/theme/tokens";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AiDataConsentModalProps = {
  visible: boolean;
  hasAccepted: boolean;
  isSaving?: boolean;
  onAgree: () => void;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
};

function BulletRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIconWrap}>
        <Feather name={icon} size={16} color={palette.textAccent} />
      </View>
      <View style={styles.bulletCopy}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
    </View>
  );
}

export function AiDataConsentModal({
  visible,
  hasAccepted,
  isSaving = false,
  onAgree,
  onClose,
  onOpenPrivacy,
  onOpenTerms,
}: AiDataConsentModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <Feather name="shield" size={14} color={palette.textAccent} />
              <Text style={styles.headerBadgeText}>
                {t("privacyConsent.badge")}
              </Text>
            </View>
            <Text style={styles.title}>{t("privacyConsent.title")}</Text>
            <Text style={styles.subtitle}>{t("privacyConsent.subtitle")}</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <BulletRow
              icon="mic"
              title={t("privacyConsent.sections.what.title")}
              body={t("privacyConsent.sections.what.body")}
            />
            <BulletRow
              icon="server"
              title={t("privacyConsent.sections.who.title")}
              body={t("privacyConsent.sections.who.body")}
            />
            <BulletRow
              icon="zap"
              title={t("privacyConsent.sections.why.title")}
              body={t("privacyConsent.sections.why.body")}
            />

            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{t("privacyConsent.note")}</Text>
            </View>

            <View style={styles.linkRow}>
              <Pressable onPress={onOpenPrivacy} style={styles.linkButton}>
                <Text style={styles.linkButtonText}>
                  {t("privacyConsent.actions.openPrivacy")}
                </Text>
              </Pressable>
              <Pressable onPress={onOpenTerms} style={styles.linkButton}>
                <Text style={styles.linkButtonText}>
                  {t("privacyConsent.actions.openTerms")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {!hasAccepted ? (
              <Pressable onPress={onClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>
                  {t("common.actions.cancel")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={hasAccepted ? onClose : onAgree}
              disabled={isSaving}
              style={[
                styles.primaryButton,
                isSaving && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {hasAccepted
                  ? t("common.actions.gotIt")
                  : t("privacyConsent.actions.agree")}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: palette.overlayDark,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    maxHeight: "84%",
    borderRadius: radii.xl,
    backgroundColor: palette.bgCardSolid,
    borderWidth: 1,
    borderColor: palette.accentBorder,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.cardLg,
  },
  header: {
    gap: spacing.sm,
  },
  headerBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.accentMuted,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  headerBadgeText: {
    ...typography.labelMd,
    color: palette.textAccent,
  },
  title: {
    ...typography.displaySm,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  bulletIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentMuted,
  },
  bulletCopy: {
    flex: 1,
    gap: 4,
  },
  bulletTitle: {
    ...typography.bodyMd,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  bulletBody: {
    ...typography.bodySm,
    color: palette.textSecondary,
    lineHeight: 20,
  },
  noteCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  noteText: {
    ...typography.caption,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  linkButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.accentBorderStrong,
    backgroundColor: palette.accentMuted,
    paddingHorizontal: spacing.md,
  },
  linkButtonText: {
    ...typography.labelLg,
    color: palette.textAccent,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bgGhostButton,
    borderWidth: 1,
    borderColor: palette.accentBorder,
  },
  secondaryButtonText: {
    ...typography.labelLg,
    color: palette.textSecondary,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.labelLg,
    color: palette.textOnAccent,
  },
});
