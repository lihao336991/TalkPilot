import { getLocales } from "expo-localization";

export const SUPPORTED_UI_LOCALES = [
  "zh-CN",
  "en",
  "es",
  "pt-BR",
  "ja",
  "ko",
  "fr",
  "de",
] as const;
export const SUPPORTED_TARGET_LANGUAGES = [
  "en",
  "zh-CN",
  "es",
  "ja",
  "ko",
  "fr",
  "de",
  "pt-BR",
] as const;
export const SUPPORTED_LEARNING_LANGUAGES = SUPPORTED_TARGET_LANGUAGES;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];
export type HelpLocale = UiLocale;
export type TargetLanguage = (typeof SUPPORTED_TARGET_LANGUAGES)[number];
export type LearningLanguage = TargetLanguage;

export const DEFAULT_UI_LOCALE: UiLocale = "en";
export const DEFAULT_HELP_LOCALE: HelpLocale = DEFAULT_UI_LOCALE;
export const DEFAULT_TARGET_LANGUAGE: TargetLanguage = "en";
export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage =
  DEFAULT_TARGET_LANGUAGE;

export const LANGUAGE_SELF_NAMES: Record<LearningLanguage, string> = {
  en: "English",
  "zh-CN": "简体中文",
  es: "Español",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
};

export function isUiLocale(value: string): value is UiLocale {
  return SUPPORTED_UI_LOCALES.includes(value as UiLocale);
}

export function isTargetLanguage(value: string): value is TargetLanguage {
  return SUPPORTED_TARGET_LANGUAGES.includes(value as TargetLanguage);
}

export function normalizeLanguageTag(rawLanguage?: string | null): string | null {
  if (!rawLanguage) {
    return null;
  }

  const normalized = rawLanguage.replace("_", "-");
  const primary = normalized.split("-")[0]?.toLowerCase();

  if (primary === "zh") {
    return "zh-CN";
  }

  if (primary === "pt") {
    return "pt-BR";
  }

  return primary || null;
}

export function normalizeLearningLanguage(
  rawLanguage?: string | null,
): LearningLanguage {
  const normalized = normalizeLanguageTag(rawLanguage);
  return normalized && isTargetLanguage(normalized)
    ? normalized
    : DEFAULT_LEARNING_LANGUAGE;
}

export function languageTagsMatch(
  firstLanguage?: string | null,
  secondLanguage?: string | null,
): boolean {
  const first = normalizeLanguageTag(firstLanguage);
  const second = normalizeLanguageTag(secondLanguage);
  return Boolean(first && second && first === second);
}

export function getFallbackLearningLanguage(
  nativeLanguage: UiLocale,
): LearningLanguage {
  return SUPPORTED_LEARNING_LANGUAGES.find(
    (language) => !languageTagsMatch(language, nativeLanguage),
  ) ?? DEFAULT_LEARNING_LANGUAGE;
}

export function getFallbackUiLocale(
  learningLanguage: LearningLanguage,
): UiLocale {
  return SUPPORTED_UI_LOCALES.find(
    (language) => !languageTagsMatch(language, learningLanguage),
  ) ?? DEFAULT_UI_LOCALE;
}

export function normalizeUiLocale(rawLocale?: string | null): UiLocale {
  if (!rawLocale) {
    return DEFAULT_UI_LOCALE;
  }

  const normalized = rawLocale.replace("_", "-");
  if (isUiLocale(normalized)) {
    return normalized;
  }

  const primary = normalized.split("-")[0]?.toLowerCase();
  if (primary === "zh") {
    return "zh-CN";
  }

  if (primary === "pt") {
    return "pt-BR";
  }

  if (primary && isUiLocale(primary)) {
    return primary;
  }

  return DEFAULT_UI_LOCALE;
}

export function getSystemUiLocale(): UiLocale {
  try {
    const locales = getLocales();
    const languageTag = locales[0]?.languageTag;
    if (languageTag) {
      return normalizeUiLocale(languageTag);
    }

    const languageCode = locales[0]?.languageCode;
    if (languageCode) {
      return normalizeUiLocale(languageCode);
    }
  } catch {}

  return DEFAULT_UI_LOCALE;
}

export function getLanguageSelfName(language: LearningLanguage): string {
  return LANGUAGE_SELF_NAMES[language];
}
