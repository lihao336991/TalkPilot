import { getLocales } from 'expo-localization';

const DEEPGRAM_LANGUAGE_MAP: Record<string, string> = {
  en: 'en',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt-BR',
  ru: 'ru',
  nl: 'nl',
  hi: 'hi',
  id: 'id',
  tr: 'tr',
  pl: 'pl',
  sv: 'sv',
  da: 'da',
  fi: 'fi',
  no: 'no',
  uk: 'uk',
  th: 'th',
  vi: 'vi',
  ar: 'ar',
};

const FALLBACK_LANGUAGE = 'en';

const LANGUAGE_NAME_MAP: Record<
  'en' | 'zh-CN',
  Record<string, string>
> = {
  en: {
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    nl: 'Dutch',
    hi: 'Hindi',
    id: 'Indonesian',
    tr: 'Turkish',
    pl: 'Polish',
    sv: 'Swedish',
    da: 'Danish',
    fi: 'Finnish',
    no: 'Norwegian',
    uk: 'Ukrainian',
    th: 'Thai',
    vi: 'Vietnamese',
    ar: 'Arabic',
    en: 'English',
  },
  'zh-CN': {
    zh: '中文',
    ja: '日语',
    ko: '韩语',
    es: '西班牙语',
    fr: '法语',
    de: '德语',
    it: '意大利语',
    pt: '葡萄牙语',
    ru: '俄语',
    nl: '荷兰语',
    hi: '印地语',
    id: '印尼语',
    tr: '土耳其语',
    pl: '波兰语',
    sv: '瑞典语',
    da: '丹麦语',
    fi: '芬兰语',
    no: '挪威语',
    uk: '乌克兰语',
    th: '泰语',
    vi: '越南语',
    ar: '阿拉伯语',
    en: '英语',
  },
};

export function getDeviceLanguageTag(): string {
  try {
    const locales = getLocales();
    const tag = locales[0]?.languageTag;
    if (tag && tag !== 'en' && !tag.startsWith('en-')) {
      return tag;
    }

    const code = locales[0]?.languageCode;
    if (code && code !== 'en') {
      return code;
    }
  } catch {}

  return FALLBACK_LANGUAGE;
}

export function getDeepgramLanguageForTag(tag: string): string {
  const primary = tag.split('-')[0].toLowerCase();

  if (DEEPGRAM_LANGUAGE_MAP[primary]) {
    return DEEPGRAM_LANGUAGE_MAP[primary];
  }

  const fullTag = tag.replace('_', '-');
  for (const [, deepgramCode] of Object.entries(DEEPGRAM_LANGUAGE_MAP)) {
    if (deepgramCode.toLowerCase() === fullTag.toLowerCase()) {
      return deepgramCode;
    }
  }

  return FALLBACK_LANGUAGE;
}

export function getDeepgramLanguage(): string {
  return getDeepgramLanguageForTag(getDeviceLanguageTag());
}

export function languageMatchesTag(
  detectedLanguage: string | undefined,
  expectedLanguageTag: string | undefined,
): boolean {
  if (!detectedLanguage || !expectedLanguageTag) {
    return false;
  }

  const detectedPrimary = detectedLanguage.split('-')[0]?.toLowerCase();
  const expectedPrimary = expectedLanguageTag.split('-')[0]?.toLowerCase();
  return detectedPrimary === expectedPrimary;
}

export function getLanguageDisplayName(
  tag?: string,
  uiLocale: 'en' | 'zh-CN' = 'en',
): string {
  if (!tag) {
    return uiLocale === 'zh-CN' ? '母语' : 'Native';
  }
  const primary = tag.split('-')[0].toLowerCase();

  return (
    LANGUAGE_NAME_MAP[uiLocale][primary] ??
    LANGUAGE_NAME_MAP.en[primary] ??
    (uiLocale === 'zh-CN' ? '母语' : 'Native')
  );
}
