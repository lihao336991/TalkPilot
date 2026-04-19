/// <reference path="../_shared/editor-shims.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildLlmResponseHeaders,
  createLlmRuntime,
  withLlmDefaults,
} from "../_shared/llm.ts";

type TranslationDirection = "to_en" | "to_native";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function normalizeDirection(raw: unknown): TranslationDirection {
  return raw === "to_native" ? "to_native" : "to_en";
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
  if (direction === "to_en") {
    return [
      {
        role: "system" as const,
        content:
          "You are a faithful real-time translator for a live conversation. Translate the user's utterance into natural, spoken English that an English speaker would actually say in this scene. Stay faithful to the speaker's intent; do not add or omit meaning. Keep it concise and conversational. Output valid JSON only with keys translated_text and hint (hint is optional and may be empty).",
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
      content: `You are a faithful real-time translator for a live conversation. Translate the English utterance into natural, spoken ${targetName}. Preserve the speaker's intent, tone, and register; do not add or omit meaning. Keep it concise. Output valid JSON only with keys translated_text and hint (hint is optional and may be empty).`,
    },
    {
      role: "user" as const,
      content: `Scene hint: ${sceneHint || "general conversation"}\nOriginal text: ${sourceText}`,
    },
  ];
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
  let direction: TranslationDirection = "to_en";
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
    direction = normalizeDirection(payload.direction);
    if (typeof payload.target_language === "string" && payload.target_language.trim()) {
      targetLanguage = payload.target_language.trim();
    } else if (typeof payload.targetLanguage === "string" && payload.targetLanguage.trim()) {
      targetLanguage = payload.targetLanguage.trim();
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

  const llm = createLlmRuntime();
  const responseHeaders = buildLlmResponseHeaders(llm, {
    "Content-Type": "application/json",
  });

  const translationPrompt = buildPrompt(
    direction,
    sourceText,
    sceneHint,
    targetLanguage,
  );

  const translationCompletion = await llm.client.chat.completions.create(
    withLlmDefaults(llm, {
      messages: translationPrompt,
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  );

  const translationRaw = translationCompletion.choices[0]?.message?.content ?? "{}";
  let translatedText = "";
  let hint = "";
  try {
    const parsed = JSON.parse(translationRaw);
    translatedText =
      typeof parsed.translated_text === "string"
        ? parsed.translated_text.trim()
        : typeof parsed.english_reply === "string"
          ? parsed.english_reply.trim()
          : "";
    hint = typeof parsed.hint === "string" ? parsed.hint.trim() : "";
  } catch {
    translatedText = translationRaw.trim();
  }

  if (!translatedText) {
    return new Response(
      JSON.stringify({ error: "Failed to generate translation" }),
      { status: 502, headers: responseHeaders },
    );
  }

  let audioBase64: string | null = null;
  let audioMimeType: string | null = null;

  if (ttsMode === "cloud" && direction === "to_en") {
    const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!deepgramApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing DEEPGRAM_API_KEY for cloud TTS" }),
        { status: 500, headers: responseHeaders },
      );
    }

    const ttsResponse = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: translatedText }),
      },
    );

    if (!ttsResponse.ok) {
      const body = await ttsResponse.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: "Failed to synthesize English audio",
          status: ttsResponse.status,
          body,
        }),
        { status: 502, headers: responseHeaders },
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    audioBase64 = arrayBufferToBase64(audioBuffer);
    audioMimeType = "audio/mpeg";
  }

  return new Response(
    JSON.stringify({
      source_text: sourceText,
      direction,
      target_language: direction === "to_en" ? "en" : targetLanguage,
      translated_text: translatedText,
      // Back-compat: old clients expected `english_reply` for to_en translation.
      english_reply: direction === "to_en" ? translatedText : null,
      hint: hint || null,
      audio_base64: audioBase64,
      audio_mime_type: audioMimeType,
    }),
    {
      status: 200,
      headers: responseHeaders,
    },
  );
});
