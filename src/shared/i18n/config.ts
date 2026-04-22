import { getLocales } from "expo-localization";

export const SUPPORTED_UI_LOCALES = ["en", "zh-CN"] as const;
export const SUPPORTED_TARGET_LANGUAGES = [
  "en",
  "es",
  "ja",
  "ko",
  "fr",
  "de",
  "pt-BR",
  "zh-CN",
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

export function isUiLocale(value: string): value is UiLocale {
  return SUPPORTED_UI_LOCALES.includes(value as UiLocale);
}

export function isTargetLanguage(value: string): value is TargetLanguage {
  return SUPPORTED_TARGET_LANGUAGES.includes(value as TargetLanguage);
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

  if (primary === "en") {
    return "en";
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
