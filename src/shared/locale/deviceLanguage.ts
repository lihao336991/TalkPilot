import { getLocales } from 'expo-localization';

const DEEPGRAM_LANGUAGE_MAP: Record<string, string> = {
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

const FALLBACK_LANGUAGE = 'zh-CN';

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

export function getDeepgramLanguage(): string {
  const tag = getDeviceLanguageTag();
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

export function getLanguageDisplayName(tag?: string): string {
  if (!tag) return 'Native';
  const primary = tag.split('-')[0].toLowerCase();
  const nameMap: Record<string, string> = {
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
  };
  return nameMap[primary] ?? 'Native';
}
