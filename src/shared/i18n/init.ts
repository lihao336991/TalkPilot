import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_UI_LOCALE } from "./config";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ptBR } from "./locales/pt-BR";
import { zhCN } from "./locales/zh-CN";

const resources = {
  en: {
    translation: en,
  },
  "zh-CN": {
    translation: zhCN,
  },
  es: {
    translation: es,
  },
  "pt-BR": {
    translation: ptBR,
  },
  ja: {
    translation: ja,
  },
  ko: {
    translation: ko,
  },
  fr: {
    translation: fr,
  },
  de: {
    translation: de,
  },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_UI_LOCALE,
    fallbackLng: DEFAULT_UI_LOCALE,
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
    returnNull: false,
  });
}

export { i18n, resources };
