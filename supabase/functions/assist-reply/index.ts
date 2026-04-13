/// <reference path="../_shared/editor-shims.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildLlmResponseHeaders,
  createLlmRuntime,
  withLlmDefaults,
} from "../_shared/llm.ts";

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

  const translationPrompt = [
    {
      role: "system" as const,
      content:
        "You are an English speaking helper for a live conversation. Convert the user's non-English intent into one short, natural English reply they can say immediately. Keep it simple, spoken, and concise. Output valid JSON only with keys english_reply and hint.",
    },
    {
      role: "user" as const,
      content: `Scene hint: ${sceneHint || "general conversation"}\nOriginal text: ${sourceText}`,
    },
  ];

  const translationCompletion = await llm.client.chat.completions.create(
    withLlmDefaults(llm, {
      messages: translationPrompt,
      max_tokens: 140,
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  );

  const translationRaw = translationCompletion.choices[0]?.message?.content ?? "{}";
  let englishReply = "";
  let hint = "";
  try {
    const parsed = JSON.parse(translationRaw);
    englishReply = typeof parsed.english_reply === "string" ? parsed.english_reply.trim() : "";
    hint = typeof parsed.hint === "string" ? parsed.hint.trim() : "";
  } catch {
    englishReply = translationRaw.trim();
  }

  if (!englishReply) {
    return new Response(
      JSON.stringify({ error: "Failed to generate English reply" }),
      { status: 502, headers: responseHeaders },
    );
  }

  let audioBase64: string | null = null;
  let audioMimeType: string | null = null;

  if (ttsMode === "cloud") {
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
        body: JSON.stringify({ text: englishReply }),
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
      english_reply: englishReply,
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
