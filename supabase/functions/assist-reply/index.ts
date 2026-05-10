/// <reference path="../_shared/editor-shims.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseAnonKey, getSupabaseUrl } from "../_shared/env.ts";
import { translateWithAzure } from "../_shared/azureTranslate.ts";

type TranslationDirection = "to_learning" | "to_native";
const TRANSLATION_PROVIDER = "azure";

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

serve(async (req: Request) => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

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

  try {
    const translated = {
      translatedText: await translateWithAzure({
        text: sourceText,
        targetLanguage,
      }),
      responseHeaders: new Headers({
        "Content-Type": "application/json",
      }),
    };

    translated.responseHeaders.set(
      "X-Translation-Provider",
      TRANSLATION_PROVIDER,
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
      message.includes("Missing AZURE_TRANSLATOR_KEY") ||
      message.includes("Missing AZURE_TRANSLATOR_REGION");
    const status = isMissingKey ? 500 : 502;
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          "X-Translation-Provider": TRANSLATION_PROVIDER,
          "Access-Control-Expose-Headers": "X-Translation-Provider",
        },
      },
    );
  }
});
