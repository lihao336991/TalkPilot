/// <reference path="./editor-shims.d.ts" />

type GoogleTranslateResponse = {
  data?: {
    translations?: Array<{
      translatedText?: string;
    }>;
  };
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      message?: string;
    }>;
  };
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _;
    });
}

export function normalizeGoogleTranslateLanguageTag(languageTag: string): string {
  const trimmed = languageTag.trim();
  if (!trimmed) {
    return "en";
  }

  const normalized = trimmed.replace("_", "-");
  const lower = normalized.toLowerCase();

  if (lower === "zh-cn" || lower === "zh-hans") {
    return "zh-CN";
  }

  if (lower === "pt-br" || lower === "pt-pt") {
    return "pt";
  }

  return normalized.split("-")[0] || normalized;
}

export async function translateWithGoogle(args: {
  text: string;
  targetLanguage: string;
}): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("Missing GOOGLE_TRANSLATE_API_KEY");
  }

  const sourceText = args.text.trim();
  if (!sourceText) {
    throw new Error("Missing source text");
  }

  const target = normalizeGoogleTranslateLanguageTag(args.targetLanguage);
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: sourceText,
        target,
        format: "text",
      }),
    },
  );

  const rawText = await response.text();
  let parsedBody: GoogleTranslateResponse | string = rawText;
  try {
    parsedBody = JSON.parse(rawText) as GoogleTranslateResponse;
  } catch {
    parsedBody = rawText;
  }

  if (!response.ok) {
    const body =
      typeof parsedBody === "string" ? parsedBody : JSON.stringify(parsedBody);
    throw new Error(
      `Google Translate request failed with HTTP ${response.status}: ${body}`,
    );
  }

  const translatedText =
    typeof parsedBody === "string"
      ? parsedBody.trim()
      : parsedBody.data?.translations?.[0]?.translatedText?.trim() ?? "";

  const decoded = decodeHtmlEntities(translatedText).trim();
  if (!decoded) {
    throw new Error("Failed to translate text");
  }

  return decoded;
}
