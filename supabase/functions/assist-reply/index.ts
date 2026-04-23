/// <reference path="../_shared/editor-shims.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { translateWithAzure } from "../_shared/azureTranslate.ts";
import { translateWithGoogle } from "../_shared/googleTranslate.ts";
import {
  buildLlmResponseHeaders,
  createLlmRuntime,
  extractJsonObject,
  withLlmDefaults,
} from "../_shared/llm.ts";

type TranslationDirection = "to_learning" | "to_native";
type TranslationProvider = "llm" | "google" | "azure";

function getTranslationProvider(): TranslationProvider {
  const raw = Deno.env.get("TRANSLATION_PROVIDER")?.trim().toLowerCase();
  if (raw === "azure") {
    return "azure";
  }
  if (raw === "google") {
    return "google";
  }

  return "llm";
}

function normalizeDirection(raw: unknown): TranslationDirection {
  if (raw === "to_native") {
    return "to_native";
  }

  return "to_learning";
}

function readLanguageTag(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function sanitizeTranslatedText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return "";
  }

  return trimmed
    .replace(/^translation\s*:\s*/i, "")
    .replace(/^translated[_\s-]*text\s*:\s*/i, "")
    .replace(/^reply\s*:\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function languageDisplayName(tag: string): string {
  const primary = tag.split("-")[0].toLowerCase();
  const map: Record<string, string> = {
    zh: "Chinese (Simplified)",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    nl: "Dutch",
    hi: "Hindi",
    id: "Indonesian",
    tr: "Turkish",
    pl: "Polish",
    sv: "Swedish",
    da: "Danish",
    fi: "Finnish",
    no: "Norwegian",
    uk: "Ukrainian",
    th: "Thai",
    vi: "Vietnamese",
    ar: "Arabic",
    en: "English",
  };
  return map[primary] ?? tag;
}

function buildPrompt(
  direction: TranslationDirection,
  sourceText: string,
  sceneHint: string,
  targetLanguageTag: string,
) {
  if (direction === "to_learning") {
    const targetName = languageDisplayName(targetLanguageTag);
    return [
      {
        role: "system" as const,
        content:
          `You are a faithful real-time translator for a live conversation. Translate the user's utterance into natural, spoken ${targetName} that a native ${targetName} speaker would actually say in this scene. Stay faithful to the speaker's intent; do not add or omit meaning. Keep it concise and conversational. Output only the translated utterance, with no JSON, no labels, and no explanation.`,
      },
      {
        role: "user" as const,
        content: `Scene hint: ${sceneHint || "general conversation"}\nOriginal text: ${sourceText}`,
      },
    ];
  }

  const targetName = languageDisplayName(targetLanguageTag);
  return [
    {
      role: "system" as const,
      content: `You are a faithful real-time translator for a live conversation. Translate the utterance into natural, spoken ${targetName}. Preserve the speaker's intent, tone, and register; do not add or omit meaning. Keep it concise. Output only the translated utterance, with no JSON, no labels, and no explanation.`,
    },
    {
      role: "user" as const,
      content: `Scene hint: ${sceneHint || "general conversation"}\nOriginal text: ${sourceText}`,
    },
  ];
}

async function translateWithLlm(args: {
  direction: TranslationDirection;
  sourceText: string;
  sceneHint: string;
  targetLanguage: string;
}) {
  const llm = createLlmRuntime();
  const responseHeaders = buildLlmResponseHeaders(llm, {
    "Content-Type": "application/json",
  });

  const translationPrompt = buildPrompt(
    args.direction,
    args.sourceText,
    args.sceneHint,
    args.targetLanguage,
  );

  const translationCompletion = await llm.client.chat.completions.create(
    withLlmDefaults(llm, {
      messages: translationPrompt,
      max_tokens: 200,
      temperature: 0.3,
    }),
  );

  const translationRaw = translationCompletion.choices[0]?.message?.content ?? "{}";
  let translatedText = "";
  try {
    const parsed = JSON.parse(extractJsonObject(translationRaw));
    translatedText =
      typeof parsed.translated_text === "string"
        ? parsed.translated_text.trim()
        : typeof parsed.translation === "string"
          ? parsed.translation.trim()
          : typeof parsed.text === "string"
            ? parsed.text.trim()
            : typeof parsed.english_reply === "string"
              ? parsed.english_reply.trim()
              : "";
    if (!translatedText) {
      translatedText = sanitizeTranslatedText(translationRaw);
    }
  } catch {
    translatedText = sanitizeTranslatedText(translationRaw);
  }

  if (!translatedText) {
    throw new Error("Failed to translate text");
  }

  return {
    translatedText,
    responseHeaders,
  };
}


serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authorization = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let transcript = "";
  let sceneHint = "";
  let ttsMode = "";
  let direction: TranslationDirection = "to_learning";
  let targetLanguage = "zh-CN";

  try {
    const payload = await req.json();
    transcript =
      typeof payload.transcript === "string"
        ? payload.transcript
        : typeof payload.source_text === "string"
          ? payload.source_text
          : "";
    sceneHint =
      typeof payload.scene_hint === "string"
        ? payload.scene_hint
        : typeof payload.sceneHint === "string"
          ? payload.sceneHint
          : "";
    ttsMode =
      typeof payload.tts_mode === "string"
        ? payload.tts_mode
        : typeof payload.ttsMode === "string"
          ? payload.ttsMode
          : "none";
    direction = normalizeDirection(
      payload.direction === "to_en" ? "to_learning" : payload.direction,
    );
    const targetLanguageFromPayload = readLanguageTag(
      payload.target_language,
      payload.targetLanguage,
    );
    const learningLanguageFromPayload = readLanguageTag(
      payload.learning_language,
      payload.learningLanguage,
    );
    const nativeLanguageFromPayload = readLanguageTag(
      payload.native_language,
      payload.nativeLanguage,
    );

    if (targetLanguageFromPayload) {
      targetLanguage = targetLanguageFromPayload;
    } else if (direction === "to_native" && nativeLanguageFromPayload) {
      targetLanguage = nativeLanguageFromPayload;
    } else if (direction === "to_learning" && learningLanguageFromPayload) {
      targetLanguage = learningLanguageFromPayload;
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sourceText = transcript.trim();

  if (!sourceText) {
    return new Response(JSON.stringify({ error: "Missing transcript" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const translationProvider = getTranslationProvider();

  try {
    const translated =
      translationProvider === "google"
        ? {
            translatedText: await translateWithGoogle({
              text: sourceText,
              targetLanguage,
            }),
            responseHeaders: new Headers({
              "Content-Type": "application/json",
            }),
          }
        : translationProvider === "azure"
          ? {
              translatedText: await translateWithAzure({
                text: sourceText,
                targetLanguage,
              }),
              responseHeaders: new Headers({
                "Content-Type": "application/json",
              }),
            }
        : await translateWithLlm({
            direction,
            sourceText,
            sceneHint,
            targetLanguage,
          });

    translated.responseHeaders.set(
      "X-Translation-Provider",
      translationProvider,
    );
    translated.responseHeaders.set(
      "Access-Control-Expose-Headers",
      [
        translated.responseHeaders.get("Access-Control-Expose-Headers"),
        "X-Translation-Provider",
      ]
        .filter(Boolean)
        .join(", "),
    );

    // Current clients send `tts_mode: none`; keep the field parsed for compatibility.
    void ttsMode;

    return new Response(
      JSON.stringify({
        source_text: sourceText,
        direction,
        target_language: targetLanguage,
        translated_text: translated.translatedText,
        learning_reply: translated.translatedText,
        // Back-compat: old clients expected `english_reply` for English learning.
        english_reply: targetLanguage.toLowerCase().startsWith("en")
          ? translated.translatedText
          : null,
        hint: null,
        audio_base64: null,
        audio_mime_type: null,
      }),
      {
        status: 200,
        headers: translated.responseHeaders,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to translate text";
    const isMissingKey =
      message.includes("Missing GOOGLE_TRANSLATE_API_KEY") ||
      message.includes("Missing AZURE_TRANSLATOR_KEY") ||
      message.includes("Missing AZURE_TRANSLATOR_REGION") ||
      message.includes("Missing required env:");
    const status = isMissingKey ? 500 : 502;
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          "X-Translation-Provider": translationProvider,
          "Access-Control-Expose-Headers": "X-Translation-Provider",
        },
      },
    );
  }
});
