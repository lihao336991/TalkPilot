import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_UI_LOCALE } from "./config";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

const resources = {
  en: {
    translation: en,
  },
  "zh-CN": {
    translation: zhCN,
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
