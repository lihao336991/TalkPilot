import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getSystemUiLocale,
  type LearningLanguage,
  type UiLocale,
} from "./config";
import { i18n } from "./init";
import { useLocaleStore } from "@/shared/store/localeStore";

export function useI18nBootstrap() {
  const hasHydrated = useLocaleStore((state) => state.hasHydrated);
  const followSystemUiLocale = useLocaleStore(
    (state) => state.followSystemUiLocale,
  );
  const uiLocale = useLocaleStore((state) => state.uiLocale);
  const setSystemUiLocale = useLocaleStore((state) => state.setSystemUiLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const systemUiLocale = getSystemUiLocale();
    const effectiveLocale = followSystemUiLocale ? systemUiLocale : uiLocale;

    if (followSystemUiLocale && uiLocale !== systemUiLocale) {
      setSystemUiLocale(systemUiLocale);
    }

    let cancelled = false;
    setReady(false);

    async function syncLanguage() {
      try {
        if (i18n.language !== effectiveLocale) {
          await i18n.changeLanguage(effectiveLocale);
        }
      } catch (error) {
        console.error("[I18n] Failed to change language:", error);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void syncLanguage();

    return () => {
      cancelled = true;
    };
  }, [followSystemUiLocale, hasHydrated, setSystemUiLocale, uiLocale]);

  return ready;
}

export function useAppLanguage() {
  const { t } = useTranslation();
  const uiLocale = useLocaleStore((state) => state.uiLocale);
  const followSystemUiLocale = useLocaleStore(
    (state) => state.followSystemUiLocale,
  );
  const setStoredUiLocale = useLocaleStore((state) => state.setUiLocale);
  const setStoredSystemUiLocale = useLocaleStore(
    (state) => state.setSystemUiLocale,
  );
  const setFollowSystemUiLocale = useLocaleStore(
    (state) => state.setFollowSystemUiLocale,
  );
  const learningLanguage = useLocaleStore((state) => state.learningLanguage);
  const setStoredLearningLanguage = useLocaleStore(
    (state) => state.setLearningLanguage,
  );

  const setUiLocale = useCallback(
    async (locale: UiLocale) => {
      setStoredUiLocale(locale);
      await i18n.changeLanguage(locale);
    },
    [setStoredUiLocale],
  );

  const followSystem = useCallback(async () => {
    const systemLocale = getSystemUiLocale();
    setFollowSystemUiLocale(true);
    setStoredSystemUiLocale(systemLocale);
    await i18n.changeLanguage(systemLocale);
  }, [setFollowSystemUiLocale, setStoredSystemUiLocale]);

  const setLearningLanguage = useCallback(
    (language: LearningLanguage) => {
      setStoredLearningLanguage(language);
    },
    [setStoredLearningLanguage],
  );

  return useMemo(
    () => ({
      t,
      nativeLanguage: uiLocale,
      uiLocale,
      learningLanguage,
      followSystemUiLocale,
      setUiLocale,
      setLearningLanguage,
      followSystem,
    }),
    [
      followSystem,
      followSystemUiLocale,
      learningLanguage,
      setLearningLanguage,
      setUiLocale,
      t,
      uiLocale,
    ],
  );
}
